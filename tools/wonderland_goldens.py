"""Independent original-asset ILBM -> OCS RGB PNG oracle; no AMOS execution.

Only the four pinned, opaque, four-plane ByteRun1 images are accepted. This
decoder writes chunky pixels directly, independently of the JS snapshot codec.
Run: python3 tools/wonderland_goldens.py
"""
import hashlib
import json
from pathlib import Path
import struct
import zlib

root = Path(__file__).resolve().parent.parent
source = root / 'examples/Wonderland'
destination = root / 'test/fixtures/wonderland'
destination.mkdir(parents=True, exist_ok=True)
records = []
title_setup = None

def chunk(tag, data):
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data))

def save_png(name, rows, width, height):
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(b''.join(b'\0' + row for row in rows), 9)) + chunk(b'IEND', b'')
    (destination / name).write_bytes(png)
    return {'file': name, 'width': width, 'height': height, 'sha256': hashlib.sha256(png).hexdigest()}

for filename in ['Title_Screen.Iff', 'Landscape.Iff', 'Score_Panel.Iff', 'Editor_Panel.Iff']:
    raw = (source / filename).read_bytes()
    assert raw[:4] == b'FORM' and raw[8:12] == b'ILBM'
    assert struct.unpack_from('>I', raw, 4)[0] + 8 == len(raw)
    chunks, pos = {}, 12
    while pos < len(raw):
        size = struct.unpack_from('>I', raw, pos + 4)[0]
        chunks[raw[pos:pos + 4]] = raw[pos + 8:pos + 8 + size]
        pos += 8 + size + (size & 1)
    width, height = struct.unpack_from('>HH', chunks[b'BMHD'])
    assert chunks[b'BMHD'][8:11] == bytes([4, 0, 1])
    palette = [((value >> 4) * 17) for value in chunks[b'CMAP']]
    body, pos, rows = chunks[b'BODY'], 0, []
    stride = ((width + 15) // 16) * 2
    for y in range(height):
        planes = []
        for plane in range(4):
            row = bytearray()
            while len(row) < stride:
                control = body[pos]; pos += 1
                if control < 128:
                    count = control + 1
                    row.extend(body[pos:pos + count]); pos += count
                elif control > 128:
                    row.extend([body[pos]] * (257 - control)); pos += 1
                assert len(row) <= stride
            planes.append(row)
        rgb = bytearray()
        for x in range(width):
            index = sum(((planes[p][x // 8] >> (7 - x % 8)) & 1) << p for p in range(4))
            # ABI native output uses two horizontal samples per lowres pixel.
            rgb.extend(palette[index * 3:index * 3 + 3] * 2)
        rows.append(bytes(rgb))
    assert all(value == 128 for value in body[pos:])
    name = filename + '.png'
    records.append({'source': filename, **save_png(name, rows, width * 2, height)})
    if filename == 'Title_Screen.Iff':
        # Independent original AmSp traversal and opaque Bob 74 placement.
        # No Mask 74 and Bob 0,84,92,74 come from the original title setup.
        program = (source / 'Wonderland.AMOS').read_bytes()
        at = 20 + struct.unpack_from('>I', program, 16)[0]
        assert program[at:at + 4] == b'AmBs' and program[at + 6:at + 10] == b'AmSp'
        at += 12
        for number in range(1, 75):
            words, h, depth, hx, hy = struct.unpack_from('>5H', program, at)
            at += 10
            planes = program[at:at + words * 2 * h * depth]
            at += len(planes)
            if number != 74:
                continue
            hx &= 0x3fff
            hx = hx - 0x4000 if hx & 0x2000 else hx
            hy = hy - 0x10000 if hy & 0x8000 else hy
            composite = [bytearray(row) for row in rows]
            for y in range(h):
                for x in range(words * 16):
                    index = sum(((planes[p * words * 2 * h + y * words * 2 + x // 8] >> (7 - x % 8)) & 1) << p for p in range(depth))
                    start = (84 - hx + x) * 6
                    composite[92 - hy + y][start:start + 6] = bytes(palette[index * 3:index * 3 + 3] * 2)
            title_setup = save_png('title-setup.png', composite, width * 2, height)
            title_setup['evidence'] = 'Original title pixels plus independently decoded opaque Bob 74 at (84,92); source-derived composition, not an Amiga capture.'
(destination / 'manifest.json').write_text(json.dumps({
    'evidence': 'Original ILBM assets independently decoded by tools/wonderland_goldens.py; OCS high-nibble palette, doubled lowres samples. No Amiga execution capture.',
    'images': records, 'titleSetup': title_setup}, indent=2) + '\n')
