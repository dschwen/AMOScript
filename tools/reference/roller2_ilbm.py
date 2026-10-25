"""Independent bounded ILBM/ByteRun1 oracle for Roller II's first image.

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
source = root / 'examples/Roller2/iffp/terminator el'
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
assert (width, height) == (320, 256)
assert chunks[b'BMHD'][8:11] == bytes([5, 0, 1])
assert chunks[b'AMSC'] == bytes.fromhex('0081002a01400100000000000000')
body = chunks[b'BODY']
offset = 0
rgba = bytearray()
for y in range(height):
    planes = []
    for plane in range(5):
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
        colour = sum(((planes[p][x // 8] >> (7 - x % 8)) & 1) << p for p in range(5))
        rgb = chunks[b'CMAP'][colour * 3:colour * 3 + 3]
        rgba.extend((component >> 4) * 17 for component in rgb)
        rgba.append(255)
assert offset == len(body)

def chunk(tag, payload):
    return struct.pack('>I', len(payload)) + tag + payload + struct.pack('>I', zlib.crc32(tag + payload))

scanlines = b''.join(b'\0' + rgba[y * width * 4:(y + 1) * width * 4] for y in range(height))
png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
png += chunk(b'IDAT', zlib.compress(scanlines, 9)) + chunk(b'IEND', b'')
directory = root / 'test/fixtures/roller2'
directory.mkdir(exist_ok=True)
(directory / 'terminator-el.png').write_bytes(png)
metadata = {'evidence': 'Independent Python ILBM/ByteRun1 source analysis; no Amiga execution capture.',
            'sourceSha256': hashlib.sha256(data).hexdigest(), 'width': width, 'height': height,
            'rgbaSha256': hashlib.sha256(rgba).hexdigest(), 'pngSha256': hashlib.sha256(png).hexdigest(),
            'placement': {'x': 129, 'y': 42, 'width': 320, 'height': 256, 'offsetX': 0, 'offsetY': 0, 'flags': 0}}
(directory / 'terminator-el.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(json.dumps(metadata, indent=2))
