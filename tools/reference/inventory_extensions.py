#!/usr/bin/env python3
"""Inventory extension calls without enabling them in the production compiler."""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
from turbo_plus import scan_program


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('program', type=Path)
    parser.add_argument('--extension', action='append', default=[], metavar='SLOT=CATALOG',
                        help='Explicit slot/library mapping; repeat for multiple libraries')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    core = json.loads((root / 'amos-pro-tokens.json').read_text())
    libraries = {}
    for mapping in args.extension:
        slot_text, filename = mapping.split('=', 1)
        slot = int(slot_text)
        if not 1 <= slot <= 255 or slot in libraries:
            parser.error('Extension slots must be distinct integers in 1..255')
        catalog = json.loads(Path(filename).read_text())
        libraries[slot] = catalog
    data = args.program.read_bytes()
    # A sentinel outside the byte range walks all calls before resolving any.
    result = scan_program(data, {}, core['main'], extension_slot=-1)
    groups = collections.defaultdict(list)
    for call in result.pop('occurrences'):
        groups[(call['slot'], call['offset'])].append(call)
    commands = []
    for (slot, offset), calls in sorted(groups.items()):
        catalog = libraries.get(slot)
        token = next((t for t in catalog['tokens'] if t['offset'] == offset), None) if catalog else None
        standard = core['extensions'].get(str(slot), {}).get(f'{offset:04x}') if not catalog else None
        entry = token or standard or {}
        commands.append(dict(slot=slot, offset=f'{offset:04x}',
                             librarySha256=catalog['library']['sha256'] if catalog else None,
                             name=entry.get('name'), signature=entry.get('signature'),
                             occurrences=len(calls),
                             locations=[dict(line=c['line'], byte=c['fileOffset'],
                                             reference=c['reference']) for c in calls]))
    print(json.dumps(dict(version=1, evidence='Static inventory; not compilation or native execution.',
                          source=args.program.name, sha256=hashlib.sha256(data).hexdigest(),
                          bytes=len(data), **result, commands=commands), indent=2))


if __name__ == '__main__':
    main()
