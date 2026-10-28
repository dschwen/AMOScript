"""Independent ZooTab recurrence, planar asset extraction and intro simulation.
Source-derived expectations only; no production JS or native Amiga capture.
"""
import hashlib
import json
from pathlib import Path
import struct

root = Path(__file__).resolve().parents[2]
raw = (root / 'examples/Introideen/R.abk').read_bytes()
source = (root / 'examples/Introideen/RollerIIIntroIdee.amos').read_bytes()
assert raw[:6] == b'AmIc\0\1'
words, height, depth, hx, hy = struct.unpack_from('>5H', raw, 6)
assert (words, height, depth, hx, hy) == (1, 16, 4, 0, 0)
pixels = bytearray(256)
for plane in range(4):
    for at in range(256):
        if raw[16 + plane * 32 + at // 8] & (128 >> (at % 8)):
            pixels[at] |= 1 << plane
assert len(raw) == 16 + 128 + 64

def table(size, count):
    # Transcribe ZooTab's subtraction/carry decisions into source increments.
    steps = []
    if count < size:
        advance, residue = -1, size - 1
        for _ in range(size):
            advance += 1
            residue -= count
            if residue < 0:
                residue += size
                steps.append(advance)
                advance = 0
    else:
        steps.append(0)
        residue = count - 1
        for _ in range(count - 1):
            residue -= size
            carry = residue < 0
            if carry:
                residue += count
            steps.append(1 if carry else 0)
    position, indices = 0, []
    for step in steps:
        position += step
        indices.append(position)
    assert len(indices) == count
    return indices

icons = [pixels]
for width in range(1, 17):
    image = bytearray(256)
    for y in range(16):
        for x, sx in enumerate(table(16, width)):
            image[y * 16 + x] = width - 1 if pixels[y * 16 + sx] else 0
    icons.append(image)

logical, physical = bytearray(64000), bytearray(64000)
ani = [0] * 10
frames = []
for stage, bounds in [('arrival', range(1, 10)), ('settle', range(1, 21))]:
    for step in bounds:
        for k in range(1, (step if stage == 'arrival' else 9) + 1):
            ani[k] = min(15, ani[k] + 1)
            image = icons[ani[k]]
            x = k * 25 + 30 - ani[k] // 2
            for y in range(16):
                logical[(100 + y) * 320 + x:(100 + y) * 320 + x + 16] = image[y * 16:y * 16 + 16]
        logical, physical = physical, logical
        frames.append(dict(frame=len(frames) + 1, stage=stage, step=step,
                           sha256=hashlib.sha256(physical).hexdigest()))

result = dict(evidence='Independent Python ZooTab carry recurrence, raw AmIc bitplanes and literal intro-loop simulation; no production compiler/decoder or native capture.',
              sourceSha256=hashlib.sha256(source).hexdigest(), assetSha256=hashlib.sha256(raw).hexdigest(),
              maps=[dict(source=s, destination=d, indices=table(s, d)) for s in range(1, 18) for d in range(1, 18)],
              icons=[dict(number=i + 1, pixelsHex=bytes(image).hex()) for i, image in enumerate(icons)],
              palette=[i * 0x111 if i != 10 else 0xfff for i in range(16)], frames=frames)
(root / 'test/fixtures/zoom.json').write_text(json.dumps(result, indent=2) + '\n')
