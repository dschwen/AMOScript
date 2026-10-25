"""Independent Roller II GAMEDISP oracle: AmIc planes, AmBk maps, stale masks.
No AMOScript decoder, runtime or renderer imports. Source/asset-derived output.
"""
import hashlib
import json
from pathlib import Path
import struct
import zlib

root = Path(__file__).resolve().parents[2]
raw = (root / 'examples/Roller2/iffp/icons.abk').read_bytes()
assert raw[:4] == b'AmIc'
count = struct.unpack_from('>H', raw, 4)[0]
images = [None]
offset = 6
for index in range(count):
    words, height, depth, hx, hy = struct.unpack_from('>5H', raw, offset)
    offset += 10
    if not words:
        assert (height, depth, hx, hy) == (0, 0, 0, 0)
        images.append(None)
        continue
    width, plane = words * 16, words * 2 * height
    data = raw[offset:offset + plane * depth]
    offset += len(data)
    pixels = bytearray(width * height)
    for p in range(depth):
        for pixel in range(len(pixels)):
            if data[p * plane + pixel // 8] & (128 >> (pixel % 8)):
                pixels[pixel] |= 1 << p
    images.append(dict(width=width, height=height, pixels=pixels,
                       mask=bytes(value != 0 for value in pixels)))
assert offset + 64 == len(raw)
palette = struct.unpack_from('>32H', raw, offset)
for source, destination in ((76, 18), (74, 29)):
    assert (images[source]['width'], images[source]['height']) == (images[destination]['width'], images[destination]['height'])
    images[destination]['pixels'] = images[source]['pixels'][:]

def chunk(tag, data):
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data))

results = []
for file in sorted((root / 'examples/Roller2/levl').iterdir(), key=lambda file: int(file.name)):
    bank = file.read_bytes()
    assert bank[:4] == b'AmBk' and len(bank) == 510
    level = bank[20:]
    pixels = bytearray(320 * 200)
    for x in range(20):
        for y in range(12):
            colour = level[240 + x + y * 20] * 3
            for row in range(y * 16, y * 16 + 16):
                pixels[row * 320 + x * 16:row * 320 + x * 16 + 16] = bytes([colour]) * 16
    counted = 0
    for x in range(20):
        for y in range(12):
            number = level[x + y * 20]
            counted += (2 < number < 15) or number == 51
            image = images[number]
            assert image
            for iy in range(image['height']):
                for ix in range(image['width']):
                    at = iy * image['width'] + ix
                    dx, dy = x * 16 + ix, y * 16 + iy
                    if image['mask'][at] and 0 <= dx < 320 and 0 <= dy < 200:
                        pixels[dy * 320 + dx] = image['pixels'][at]
    rgba = bytearray()
    for value in pixels:
        rgb = palette[value & 31]
        colour = [(rgb >> shift) & 15 for shift in (8, 4, 0)]
        if value & 32:
            colour = [channel // 2 for channel in colour]
        rgba.extend([channel * 17 for channel in colour] + [255])
    scan = b''.join(b'\x00' + rgba[y * 1280:(y + 1) * 1280] for y in range(200))
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 320, 200, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(scan, 9)) + chunk(b'IEND', b'')
    name = 'board-' + file.name + '.png'
    (root / 'test/fixtures/roller2' / name).write_bytes(png)
    results.append(dict(level=file.name, countedTiles=counted, sourceSha256=hashlib.sha256(bank).hexdigest(),
                        indicesSha256=hashlib.sha256(pixels).hexdigest(), rgbaSha256=hashlib.sha256(rgba).hexdigest(), png=name))
(root / 'test/fixtures/roller2/boards.json').write_text(json.dumps(dict(evidence='Independent raw AmIc/AmBk extraction and source-derived GAMEDISP composition, including entry copies, original masks and EHB. Palette restoration is a declared preview harness; no native/gameplay capture.', levels=results), indent=2) + '\n')
