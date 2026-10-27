"""Independent raw AmIc planar pixels for the final Roller II help page.
Source/asset-derived expectations, not native Amiga captures.
"""
import hashlib
import json
from pathlib import Path
import struct
root = Path(__file__).resolve().parents[2]
raw = (root / 'examples/Roller2/iffp/icons.abk').read_bytes()
assert raw[:4] == b'AmIc'
offset = 6
images = []
for number in range(1, struct.unpack_from('>H', raw, 4)[0] + 1):
    words, height, depth, hx, hy = struct.unpack_from('>5H', raw, offset)
    offset += 10
    plane = words * 2 * height
    data = raw[offset:offset + plane * depth]
    offset += len(data)
    if number not in (49, 50, 51, 52):
        continue
    assert (words, height, depth, hx, hy) == (1, 16, 6, 0, 0)
    pixels = bytearray(16 * height)
    for bit in range(depth):
        for pixel in range(len(pixels)):
            if data[bit * plane + pixel // 8] & (128 >> (pixel % 8)):
                pixels[pixel] |= 1 << bit
    images.append(dict(number=number, x=0, y=8 + (number - 49) * 24,
                       textRow=2 + (number - 49) * 3, pixelsHex=pixels.hex()))
assert offset + 64 == len(raw)
result = dict(evidence='Independent Python AmIc planar extraction; expected final-page positions derived from entries 49–52. No production decoder or native capture.',
              sourceSha256=hashlib.sha256(raw).hexdigest(), images=images)
(root / 'test/fixtures/roller2/help.json').write_text(json.dumps(result, indent=2) + '\n')
