"""Independent bounded ILBM/ByteRun1 oracle for Roller II's first image and EHB title.

No AMOScript imports. Reproduce from the repository root with:
python3 tools/reference/roller2_ilbm.py
Expected pixels are source-derived, not an Amiga execution capture.
"""
import hashlib
import json
from pathlib import Path
import struct
import zlib

root = Path(__file__).resolve().parents[2]
def chunk(tag, payload):
    return struct.pack('>I', len(payload)) + tag + payload + struct.pack('>I', zlib.crc32(tag + payload))


def decode(name, label, rows, depth, source_directory=None):
    source = (source_directory or root / 'examples/Roller2/iffp') / name
    data = source.read_bytes()
    assert data[:4] == b'FORM' and data[8:12] == b'ILBM'
    assert struct.unpack_from('>I', data, 4)[0] + 8 == len(data)
    chunks = {}
    position = 12
    while position < len(data):
        tag, length = struct.unpack_from('>4sI', data, position)
        assert position + 8 + length <= len(data) and tag not in chunks
        chunks[tag] = data[position + 8:position + 8 + length]
        position += 8 + length + (length % 2)
    width, height = struct.unpack_from('>HH', chunks[b'BMHD'])
    assert (width, height) == (320, rows)
    assert chunks[b'BMHD'][8:11] == bytes([depth, 0, 1])
    if depth == 5:
        assert chunks[b'AMSC'] == bytes.fromhex('0081002a01400100000000000000')
    else:
        assert b'AMSC' not in chunks and chunks[b'CAMG'] == bytes.fromhex('00004080')
    body = chunks[b'BODY']
    offset = 0
    rgba = bytearray()
    indices = bytearray()
    for y in range(height):
        planes = []
        for plane in range(depth):
            row = bytearray()
            while len(row) < 40:
                count = struct.unpack_from('b', body, offset)[0]
                offset += 1
                if count >= 0:
                    row.extend(body[offset:offset + count + 1])
                    offset += count + 1
                elif count != -128:
                    row.extend(bytes([body[offset]]) * (1 - count))
                    offset += 1
            assert len(row) == 40
            planes.append(row)
        for x in range(width):
            colour = sum(((planes[p][x // 8] >> (7 - x % 8)) & 1) << p for p in range(depth))
            indices.append(colour)
            base = colour & 31
            rgb = chunks[b'CMAP'][base * 3:base * 3 + 3]
            rgba.extend(((component >> 4) >> (1 if colour >= 32 else 0)) * 17 for component in rgb)
            rgba.append(255)
    assert offset == len(body)

    scanlines = b''.join(b'\0' + rgba[y * width * 4:(y + 1) * width * 4] for y in range(height))
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(scanlines, 9)) + chunk(b'IEND', b'')
    directory = root / 'test/fixtures/roller2'
    directory.mkdir(exist_ok=True)
    (directory / f'{label}.png').write_bytes(png)
    metadata = {'evidence': 'Independent Python ILBM/ByteRun1 source analysis; no Amiga execution capture.',
                'sourceSha256': hashlib.sha256(data).hexdigest(), 'width': width, 'height': height,
                'rgbaSha256': hashlib.sha256(rgba).hexdigest(), 'pngSha256': hashlib.sha256(png).hexdigest(),
                'placement': {'x': 129, 'y': 42, 'width': 320, 'height': 256, 'offsetX': 0, 'offsetY': 0, 'flags': 0} if depth == 5 else None}
    if depth == 6:
        (directory / f'{label}.indices').write_bytes(indices)
        metadata['indicesSha256'] = hashlib.sha256(indices).hexdigest()
    (directory / f'{label}.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(json.dumps(metadata, indent=2))

if __name__ == '__main__':
    decode('terminator el', 'terminator-el', 256, 5)
    decode('roller titel', 'roller-title', 512, 6)
    decode('roller titel', 'current-roller-title', 512, 6, root / 'examples/Roller2/current/iffp')
