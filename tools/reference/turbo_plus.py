#!/usr/bin/env python3
"""Recover AMOS extension metadata and relocation-aware disassembly; no compiler changes.

Input is the original distribution directory. Addresses in outputs are FILE offsets.
The supplied Turbo Plus V2.15 and AMCAF V1.50beta4 images are pinned by SHA-256.
"""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import re
import shutil
import struct
import subprocess
import tempfile


def u16(b, p):
    return struct.unpack_from('>H', b, p)[0]


def u32(b, p):
    return struct.unpack_from('>I', b, p)[0]


def digest(b):
    return hashlib.sha256(b).hexdigest()


def library(b):
    if u32(b, 0) != 0x3f3 or u32(b, 24) != 0x3e9:
        raise ValueError('Expected a single Amiga CODE hunk')
    sizes_size, tokens_size, code_size, title_size = struct.unpack_from('>4I', b, 32)
    sizes_at = 50 + (4 if b[50:54] == b'AP20' else 0)
    tokens_at = sizes_at + sizes_size
    code_at = tokens_at + tokens_size
    title_at = code_at + code_size
    if title_at + title_size > len(b) or sizes_size % 2:
        raise ValueError('Invalid section sizes')
    sizes = struct.unpack_from('>' + 'H' * (sizes_size // 2), b, sizes_at)
    if sum(sizes) * 2 != code_size:
        raise ValueError('Routine lengths do not cover code')
    routines, p = [], code_at
    for i, words in enumerate(sizes):
        routines.append(dict(id=i, label=f'R{i:03x}', fileOffset=p,
                             byteLength=words * 2, tokens=[], relocations=[]))
        p += words * 2
    tokens, p, recalled = [], tokens_at + 6, None
    while u16(b, p):
        start = p
        instruction, function = struct.unpack_from('>HH', b, p)
        p += 4
        ns = p
        while b[p] < 128:
            p += 1
        raw = b[ns:p + 1]
        p += 1
        name = ''.join(chr(c & 127) for c in raw)
        if raw == b'\x80':
            if recalled is None:
                raise ValueError('Missing recalled token name')
            name = recalled
        elif name.startswith('!'):
            name = recalled = name[1:]
        ns = p
        while b[p] < 128:
            p += 1
        signature = b[ns:p].decode('latin1')
        terminator = b[p]
        p += 1
        p += p % 2
        if p > code_at:
            raise ValueError('Token table crossed code')
        offset = start - tokens_at
        routine = instruction if instruction != 0xffff else function
        if routine >= len(routines) or not signature:
            raise ValueError('Invalid command entry')
        args = signature[1::2]
        if len(signature) > 1 and (not all(c in '02' for c in args) or
                                  not all(c in ',t' for c in signature[2::2])):
            raise ValueError('Unexpected signature grammar')
        token = dict(offset=offset, hexOffset=f'{offset:04x}', name=name,
                     signature=signature, kind='statement' if signature[0] == 'I' else 'function',
                     returnType=None if signature[0] == 'I' else {'0':'integer', '2':'string'}[signature[0]],
                     args=[{'0':'integer', '2':'string'}[c] for c in args],
                     separators=[{'t':'To', ',':','}[c] for c in signature[2::2]],
                     signatureTerminator=terminator, instructionRoutine=instruction,
                     functionRoutine=function, routine=routine,
                     fileOffset=routines[routine]['fileOffset'])
        tokens.append(token)
        routines[routine]['tokens'].append(offset)
    return dict(version=1, evidence='Static binary analysis; no native execution or runtime support implied.',
                library=dict(bytes=len(b), sha256=digest(b), format='AMOS old extension (no AP20)',
                             defaultSlot=12, sizesOffset=sizes_at, sizesBytes=sizes_size,
                             tokenTableOffset=tokens_at, tokenTableBytes=tokens_size,
                             codeOffset=code_at, codeBytes=code_size, titleOffset=title_at,
                             titleBytes=title_size,
                             title=b[title_at:title_at+title_size].decode('latin1')),
                tokens=tokens, routines=routines)


BRANCHES = ['bra', 'bsr', 'beq', 'bne', 'bcs', 'bcc', 'blt', 'bge', 'bls', 'bhi', 'ble', 'bpl', 'bmi']
OPCODES = [0x6000, 0x6100, 0x6700, 0x6600, 0x6500, 0x6400, 0x6d00,
           0x6c00, 0x6300, 0x6200, 0x6f00, 0x6a00, 0x6b00]
CORE = {1024:'Error', 1025:'ErrorExt', 207:'Test_PaSaut', 956:'WaitRout',
        287:'GetEc', 46:'Demande', 432:'RamFast', 433:'RamChip', 434:'RamFast2',
        435:'RamChip2', 436:'RamFree', 1100:'Bnk_GetAdr', 1101:'Bnk_GetBobs',
        1102:'Bnk_GetIcons', 1103:'Bnk_Reserve', 1104:'Bnk_Eff', 1105:'Bnk_EffA0',
        1106:'Bnk_EffTemp', 1107:'Bnk_EffAll', 1234:'Bnk_Change',
        1119:'Dsk_PathIt', 1120:'Dsk_FileSelector', 1121:'Bnk_OrAdr'}


def relocate(b, catalog):
    """Follow AMOS loader's word scan, stopping at Rdata. Preserve marker evidence.

    Local branches use original FILE offsets. Absolute core-call addresses are
    diagnostic sentinels, never real executable host pointers.
    """
    patched = bytearray(b)
    routines = catalog['routines']
    for r in routines:
        p, end = r['fileOffset'], r.get('dataOffset', r['fileOffset'] + r['byteLength'])
        while p + 4 <= end:
            if b[p] != 0xfe or b[p + 1] & 15 != 1:
                p += 2
                continue
            op = b[p + 1] >> 4
            marker = dict(fileOffset=p, opcode=op)
            if 2 <= op <= 14:
                target = u16(b, p + 2)
                if target >= len(routines):
                    p += 2
                    continue
                addr = routines[target]['fileOffset']
                displacement = addr - p - 2
                if not -32768 <= displacement <= 32767:
                    raise ValueError('Local branch overflow')
                struct.pack_into('>Hh', patched, p, OPCODES[op - 2], displacement)
                marker.update(kind=BRANCHES[op - 2], targetRoutine=target,
                              targetFileOffset=addr, text=f'R{BRANCHES[op-2]} R{target:03x}')
                length = 4
            elif op <= 1 and p + 6 <= end and b[p + 2] == 0xf7 and b[p + 3] < 27:
                slot, target = b[p + 3], u16(b, p + 4)
                addr = 0xf0000000 | slot << 16 | target
                struct.pack_into('>HI', patched, p, 0x4eb9 if op else 0x4ef9, addr)
                name = CORE.get(target, f'old_{target}') if slot == 0 else f'library_{slot}_{target}'
                marker.update(kind='external-jsr' if op else 'external-jmp', targetSlot=slot,
                              targetRoutine=target, text=f'R{"jsr" if op else "jmp"} slot {slot} {name} ({target})')
                length = 6
            elif op <= 1 and p + 6 <= end and b[p + 2] == 0xf5 and b[p + 3] < 16:
                # Preserve width with diagnostic instructions; actual jump-table
                # displacement is unknown here. Keep the operand in metadata.
                register, target = b[p + 3], u16(b, p + 4)
                if register < 8:
                    struct.pack_into('>HHH', patched, p, 0x206c | register << 9, 0,
                                     (0x4e90 if op else 0x4ed0) | register)
                else:
                    struct.pack_into('>HI', patched, p, 0x41f9 | (register-8) << 9,
                                     0xf1000000 | target)
                marker.update(kind='indirect', targetRoutine=target, register=register,
                              text=f'AMOS indirect marker register {register}, routine {target}')
                length = 6
            elif op == 15 and u16(b, p + 2) == 0x6543:
                marker.update(kind='data', text='Rdata: remaining routine bytes are data')
                length = 4
                r['dataOffset'] = p
            else:
                p += 2
                continue
            marker['originalHex'] = b[p:p+length].hex()
            marker['byteLength'] = length
            r['relocations'].append(marker)
            p += length
            if marker['kind'] == 'data':
                break
    return patched


def scan_program(b, tokens, core, extension_slot=12):
    """Bounded physical-line token walk, independently of production TokenReader."""
    if not b[:16].startswith((b'AMOS Basic', b'AMOS Pro')):
        raise ValueError('Bad AMOS header')
    stop, start, line, occurrences = 20 + u32(b, 16), 20, 0, []
    if stop > len(b):
        raise ValueError('Truncated AMOS code')
    while start < stop:
        line += 1
        end = start + b[start] * 2
        if end > stop or end < start + 4:
            raise ValueError('Invalid line length')
        p, terminated = start + 2, False
        while p < end:
            at, code = p, u16(b, p)
            p += 2
            def need(n):
                if p + n > end:
                    raise ValueError(f'Truncated line {line} at {at}')
            if code == 0:
                if p != end:
                    raise ValueError('Data after line terminator')
                terminated = True
                break
            n = 0
            if code in (6,12,18,24):
                need(4)
                n = 4 + b[p+2] + b[p+2] % 2
            elif code in (38,46,0x64a,0x652):
                need(2)
                size = u16(b,p) if code in (38,46) else b[p+1]
                n = 2 + size + size % 2
            elif code in (30,54,62,70):
                n = 4
            elif code == 0x4e:
                need(4)
                slot, reference, offset = b[p], b[p+1], u16(b,p+2)
                if slot == extension_slot and offset not in tokens:
                    raise ValueError(f'Unknown Turbo offset {offset:04x}')
                occurrences.append(dict(line=line, fileOffset=at, slot=slot, reference=reference,
                                        offset=offset, name=tokens[offset]['name'] if slot == extension_slot else None))
                n = 4
            elif code in (0x23c,0x250,0x268,0x27e,0x2be,0x2d0,0x25a4,0x404):
                n = 2
            elif code in (0x290,0x29e,0x316):
                n = 4
            elif code == 0x376:
                need(8)
                if b[p+6] & 0x30:
                    raise ValueError('Encrypted/compiled procedure')
                n = 8
            elif code == 0x2b6a:
                n = 8
            elif code in (0x2a40,0x2a4a,0x2a54,0x2a64):
                n = 6
            elif f'{code:04x}' not in core and code not in (0xff3e,0xff4c,0xff58,0xff66,0xff7a,0xff8e,0xff98,0xff84,0xffa2,0xffac,0xffb6,0xffc0,0xffca,0xffd4,0xffe2,0xffec,0xfff6):
                raise ValueError(f'Unknown core token {code:04x}')
            need(n)
            p += n
        if not terminated:
            raise ValueError('Missing line terminator')
        start = end
    return dict(physicalLines=line, codeBytes=stop-20, trailingBytes=len(b)-stop,
                occurrences=occurrences)


def main(profile='turbo-plus'):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('distribution', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--objdump', default=shutil.which('m68k-amigaos-objdump'))
    parser.add_argument('--ira', default=shutil.which('ira'))
    parser.add_argument('--listamos', default='/home/daniel/Programs/amostools/listamos')
    parser.add_argument('--token-reference', type=Path, help='Optional independent amostools token-table image')
    parser.add_argument('--check', action='store_true', help='Compare regenerated artifacts without changing them')
    args = parser.parse_args()
    root = args.distribution.resolve()
    amcaf = profile == 'amcaf'
    slot = 8 if amcaf else 12
    title = 'AMCAF V1.50beta4' if amcaf else 'Turbo Plus V2.15'
    lib = root / ('AMCAF_Install/AMOSPro_AMCAF.Lib' if amcaf else 'APSystem/AMOSPro_TURBO_Plus.Lib')
    b = lib.read_bytes()
    catalog = library(b)
    expected = '9894a7e216ff501244bbcdc47d3830abdbcf4382d4f4a6daa43551faa87917e4' if amcaf else 'ddc8abb16f35cd2fb4230e2c70dc85e6bcbbfe5f73ebcc6712135471faaafb07'
    if digest(b) != expected:
        raise ValueError(f'This analysis targets the supplied {title} binary')
    catalog['library']['defaultSlot'] = slot
    inline = ((0x18d, 0xafb4),) if amcaf else ((0x12e, 0x570a), (0x152, 0x6e64))
    for rid, data_at in inline:
        catalog['routines'][rid]['dataOffset'] = data_at
        catalog['routines'][rid]['dataEvidence'] = 'curated inline state/table area or error strings'
    patched = relocate(b, catalog)
    tokens = {t['offset']:t for t in catalog['tokens']}
    core = json.loads(Path(__file__).with_name('amos-pro-tokens.json').read_text())['main']
    manual_file = 'AMCAF_Install/AMCAF.Guide' if amcaf else 'Docs/TURBO_DocsV2.15.Asc'
    docs = (root / manual_file).read_bytes()
    doclines = docs.decode('latin1').splitlines()
    inventory = []
    outputs = {}
    for file in sorted((root / ('AMCAF_Examples' if amcaf else 'Examples')).glob('*.AMOS')):
        data = file.read_bytes()
        item = dict(file=str(file.relative_to(root)), sha256=digest(data), bytes=len(data))
        item.update(scan_program(data, tokens, core, slot))
        result = subprocess.run([args.listamos, str(file)], capture_output=True)
        listing = result.stdout.decode('latin1')
        def replace(match):
            source_slot, offset = int(match[1]), int(match[2],16)
            return tokens[offset]['name'].title() if source_slot == slot else match[0]
        listing = re.sub(r'Extension_(\d+)_([0-9A-Fa-f]{4})', replace, listing)
        if f'Extension_{slot}_' in listing or len(listing.splitlines()) != item['physicalLines']:
            raise ValueError(f'Incomplete listing: {file.name}')
        # listamos signals missing extension definitions before our replacement;
        # other errors are not allowed. Bounded scanning above checks payloads.
        if result.returncode not in (0,4):
            raise ValueError(f'listamos failed: {result.stderr.decode("latin1")}')
        item['listing'] = f'examples/{file.stem}.amos.txt'
        outputs[item['listing']] = listing
        inventory.append(item)
    for token in catalog['tokens']:
        token['examples'] = [dict(file=i['file'], line=o['line'], fileOffset=o['fileOffset'])
                             for i in inventory for o in i['occurrences']
                             if o['slot'] == slot and o['offset'] == token['offset']]
        token['manualHeadingLines'] = [n for n,line in enumerate(doclines,1)
                                      if line.strip().lstrip('=').strip().lower() == token['name']]
    if amcaf:
        nodes = []
        for match in re.finditer(r'(?mi)^@node\s+(\S+)\s+"([^"\n]+)"[^\n]*\n(.*?)^@endnode', docs.decode('latin1'), re.S | re.M):
            node_id, heading, body = match.groups()
            line = docs[:match.start()].count(b'\n') + 1
            nodes.append(dict(id=node_id, title=heading, line=line, body=body))
        manual = ['# AMCAF supplied manual: command/function nodes and history', '',
                  'Transcribed from the supplied AmigaGuide, whose main reference is V1.40.',
                  'History supplements it for the V1.50beta4 binary. This is documentation evidence, not a behavioral verification.', '']
        for node in nodes:
            if node['title'].startswith(('Function:', 'Command:')) or node['id'] in ('shistory','sbuglist'):
                body = re.sub(r'@\{"([^"}]+)"\s+link\s+(\S+)\s*}',
                              lambda m: '['+m[1].strip()+'](#'+m[2]+')', node['body'])
                body = re.sub(r'@\{[^}]*}', '', body)
                manual += [f'<a id="{node["id"]}"></a>', '', '## '+node['title'], '', body.strip(), '']
        outputs['manual.md'] = '\n'.join(manual)+'\n'
        for token in catalog['tokens']:
            token['manualNodes'] = [dict(id=n['id'], title=n['title'], line=n['line']) for n in nodes
                                    if token['name'] in [v.strip().lstrip('=').lower() for v in
                                       re.sub(r'^(?:Function|Command):\s*', '', n['title']).split('/')]]
            token['manualMentions'] = [i for i,line in enumerate(doclines,1)
                                       if re.search(r'(?<![a-z])'+re.escape(token['name'])+r'(?![a-z])',line,re.I)]
    catalog['profile'] = profile
    catalog['documentation'] = dict(file=manual_file, sha256=digest(docs))
    asset_inventory = [dict(file=str(f.relative_to(root)), bytes=f.stat().st_size,
                            sha256=digest(f.read_bytes()))
                       for f in sorted(root.rglob('*')) if f.is_file() and
                       ((amcaf and f.suffix.lower() != '.info' or f.suffix.lower() in ('.abk','.scene','.vec','.asc','.amos')) and
                        'reverse-engineering' not in f.parts)]
    summary = dict(programs=len(inventory), tokens=len(tokens), routines=len(catalog['routines']),
                   coveredExtensionTokens=len({o['offset'] for i in inventory for o in i['occurrences'] if o['slot']==slot}),
                   extensionOccurrences=sum(o['slot']==slot for i in inventory for o in i['occurrences']),
                   relocationMarkers=sum(len(r['relocations']) for r in catalog['routines']),
                   foreignSlots=sorted({o['slot'] for i in inventory for o in i['occurrences'] if o['slot']!=slot}),
                   evidence='Structural checks and static decoding only; examples have not been run in AMOS.')
    with tempfile.TemporaryDirectory(prefix='turbo-plus-') as temp:
        temp = Path(temp)
        image = temp / 'turbo.bin'
        image.write_bytes(patched)
        asm = [f'; {title} relocation-aware diagnostic disassembly',
               '; ALL ADDRESSES ARE ORIGINAL FILE OFFSETS (subtract $20 for hunk offsets).',
               '; Relocation bytes are patched ONLY in temporary analysis input.',
               '; External $f000xxxx addresses are sentinels, NOT real AMOS addresses.',
               '; Inline data without Rdata may still be decoded as instructions.',
               '; Raw original markers and routine boundaries are in catalog.json.', '']
        config = ['MACHINE 68000']
        for r in catalog['routines']:
            if not r['byteLength']:
                continue
            start, end = r['fileOffset'], r['fileOffset'] + r['byteLength']
            names = ', '.join(tokens[o]['name'] for o in r['tokens']) or 'internal'
            asm += [f'; {r["label"]} file ${start:04x}..${end:04x} exclusive: {names}', r['label'] + ':']
            code_end = r.get('dataOffset', end)
            if code_end > start:
                result = subprocess.run([args.objdump, '-D', '-b', 'binary', '-m', 'm68k:68000',
                                         '--insn-width=10', f'--start-address={start}',
                                         f'--stop-address={code_end}', str(image)],
                                        capture_output=True, text=True, check=True)
                annotations = {m['fileOffset']:m for m in r['relocations']}
                for line in result.stdout.splitlines():
                    match = re.match(r'^\s*([0-9a-f]+):\s', line)
                    if match:
                        at = int(match[1],16)
                        if at in annotations:
                            marker = annotations[at]
                            asm.append(f'; original {marker["originalHex"]}: {marker["text"]}')
                        asm.append(line)
                config += [f'CODE ${start:x} ${code_end:x}', f'SYMBOL {r["label"]} ${start:x}']
                config.append(f'COMMENT ${start:x} {names}')
            for p in range(code_end, end, 16):
                asm.append(f'    ; ${p:04x} data: {b[p:min(p+16,end)].hex(" ")}')
            asm.append('')
        outputs['disassembly.txt'] = '\n'.join(asm) + '\n'
        for r in catalog['routines']:
            for m in r['relocations']:
                if m['kind'] != 'data':
                    config.append(f'COMMENT ${m["fileOffset"]:x} original {m["originalHex"]}: {m["text"]}')
        config.append('END')
        ira_image = temp / 'ira-input.raw'
        ira_image.write_bytes(patched[catalog['library']['codeOffset']:catalog['library']['titleOffset'] + catalog['library']['titleBytes']])
        config.insert(0, f"OFFSET ${catalog['library']['codeOffset']:x}")
        (temp / 'ira-input.cnf').write_text('\n'.join(config)+'\n')
        result = subprocess.run([args.ira, '-BINARY', '-M68000', '-A', '-CONFIG', str(ira_image), str(temp/'turbo.s')],
                                cwd=temp, capture_output=True, text=True)
        if result.returncode or not (temp/'turbo.s').exists():
            raise ValueError(f'IRA failed: {result.stdout} {result.stderr}')
        outputs['ira.s'] = '; Relocation-patched diagnostic image, original FILE addresses.\n; Core-call addresses are SENTINELS. See ../../../../docs/turbo-plus.md.\n' + (temp/'turbo.s').read_text()
        outputs['ira.cnf'] = '\n'.join(config)+'\n'
    if amcaf:
        quarter = list(struct.unpack_from('>256h', b, 0xaba2))
        sine = quarter[:255] + [256] + quarter[::-1] + [-v for v in quarter[:255]] + [-256] + [-v for v in quarter[::-1]]
        if len(sine) != 1024:
            raise ValueError('Invalid reconstructed sine table')
        outputs['tables.json'] = json.dumps(dict(
            evidence='Raw binary data and transcription of R18c initialization; not native execution.',
            sineQuarterFileOffset=0xaba2, sineQuarterWords=quarter,
            sineStateOffset=0x6b2, sineWords=sine,
            arcFileOffset=0xada2, arcRatioBytes=list(b[0xada2:0xafa3]),
            fireAverageStateOffset=0x1cb2,
            fireAverageBytes=[min(255,(i+2)//5) for i in range(1280)]), indent=2)+'\n'
    if args.token_reference:
        reference = args.token_reference.read_bytes()
        refbase = 50 + u32(reference,32) + (4 if reference[50:54] == b'AP20' else 0)
        if u32(reference,36) != catalog['library']['tokenTableBytes']:
            raise ValueError('Independent token-table size differs')
        for i,t in enumerate(catalog['tokens']):
            start = t['offset'] + 4
            end = catalog['tokens'][i+1]['offset'] if i+1 < len(catalog['tokens']) else catalog['library']['tokenTableBytes']
            full = b[catalog['library']['tokenTableOffset']+start:catalog['library']['tokenTableOffset']+end]
            other = reference[refbase+start:refbase+end]
            if full != other:
                raise ValueError(f'Independent token-table mismatch at {t["hexOffset"]}')
        outputs['validation.json'] = json.dumps(dict(reference=args.token_reference.name,
            referenceSha256=digest(reference), matchedRecords=len(catalog['tokens']),
            compared='Every name/signature/terminator/padding byte after the routine-pointer fields, at exact original token offsets.',
            evidence='Independent preexisting amostools token image agrees with original library. This validates metadata, not command execution.'), indent=2)+'\n'
    outputs['catalog.json'] = json.dumps(catalog, indent=2)+'\n'
    outputs['examples.json'] = json.dumps(dict(summary=summary, programs=inventory, assets=asset_inventory), indent=2)+'\n'
    rows = [f'# {title} command inventory', '',
            'Generated from the supplied binary. Addresses are file offsets. Example counts are token occurrences, not execution coverage.', '',
            f'| Slot {slot} offset | Name | Signature | Routine | File address | Example uses |',
            '|---|---|---|---|---|---|']
    for t in catalog['tokens']:
        rows.append(f'| `${t["hexOffset"]}` | {t["name"]} | `{t["signature"]}` | R{t["routine"]:03x} | `${t["fileOffset"]:04x}` | {len(t["examples"])} |')
    outputs['commands.md'] = '\n'.join(rows)+'\n'
    for name, content in outputs.items():
        path = args.output / name
        if args.check:
            if not path.exists() or path.read_text() != content:
                raise ValueError(f'Stale artifact: {path}')
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
