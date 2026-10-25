"""Independent original Roller II icon planar/mask/pixel oracle; no AMOScript imports."""
import hashlib
import json
from pathlib import Path
import struct
import zlib

root = Path(__file__).resolve().parents[2]
raw = (root / 'examples/Roller2/iffp/icons.abk').read_bytes()
assert raw[:4] == b'AmIc'
count = struct.unpack_from('>H', raw, 4)[0]
offset = 6
images = {}
for index in range(1, count + 1):
    words, height, depth, hx, hy = struct.unpack_from('>5H', raw, offset)
    offset += 10
    if not words:
        assert (height, depth, hx, hy) == (0, 0, 0, 0)
        continue
    width = words * 16
    plane = words * 2 * height
    planar = raw[offset:offset + plane * depth]
    assert len(planar) == plane * depth
    offset += len(planar)
    if index not in (18, 29, 74, 76):
        continue
    pixels = bytearray(width * height)
    for p in range(depth):
        for pixel in range(len(pixels)):
            if planar[p * plane + pixel // 8] & (128 >> (pixel % 8)):
                pixels[pixel] |= 1 << p
    assert (width, height, depth) == (16, 16, 6)
    images[str(index)] = dict(width=width, height=height, depth=depth, hotspotX=hx, hotspotY=hy,
                              dataOffset=offset - len(planar), planarHex=planar.hex(), pixelsHex=pixels.hex())
assert offset + 64 == len(raw)
palette = list(struct.unpack_from('>32H', raw, offset))
fixture = dict(evidence='Independent Python byte/planar extraction from pinned AmIc records, plus source-derived stale-mask ICCOPY composition. No production decoder and no Amiga capture.',
               sourceSha256=hashlib.sha256(raw).hexdigest(), palette=palette, images=images)
out = root / 'test/fixtures/roller2'
(out / 'icon-copy.json').write_text(json.dumps(fixture, indent=2) + '\n')
def chunk(tag, data):
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data))
for changed in (False, True):
    pixels = bytearray(320 * 200)
    for slot, number in enumerate((18, 29, 76, 74)):
        original = bytes.fromhex(images[str(number)]['pixelsHex'])
        source = bytes.fromhex(images[str({18: 76, 29: 74}.get(number, number) if changed else number)]['pixelsHex'])
        for i, value in enumerate(source):
            if original[i]:
                pixels[(i // 16) * 320 + slot * 32 + i % 16] = value
    rgba = bytearray()
    for value in pixels:
        rgb = palette[value & 31]
        components = [(rgb >> shift) & 15 for shift in (8, 4, 0)]
        if value & 32:
            components = [component // 2 for component in components]
        rgba.extend([component * 17 for component in components] + [255])
    scan = b''.join(b'\x00' + rgba[row * 1280:(row + 1) * 1280] for row in range(200))
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 320, 200, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(scan, 9)) + chunk(b'IEND', b'')
    (out / ('icon-copy-after.png' if changed else 'icon-copy-before.png')).write_bytes(png)
