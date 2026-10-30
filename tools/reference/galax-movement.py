"""Independent forward AMAL PLay traces from GALAX's unchanged Moves.Abk.

Each axis is expanded separately into field deltas, then combined in X/Y order.
Native reference: W.s AmPli/AmPl0/AmPWx/AmPWy. No production runtime imports.
"""
import hashlib
import json
import struct
from pathlib import Path

root = Path(__file__).resolve().parents[2]
raw = (root / 'examples/CompilerExamples/Galax/Moves.Abk').read_bytes()
assert raw[:4] == b'AmBk' and raw[12:20] == b'Amal    '
data = raw[20:]
word = lambda at: struct.unpack_from('>H', data, at)[0]

def expand(start):
    result = []
    while data[start]:
        value = data[start]
        start += 1
        if value & 128:
            result.extend([0] * ((value & 127) + 1))
        else:
            result.append(value if value < 64 else value - 128)
    return result

traces = []
for number in range(1, word(4) + 1):
    offset = word(4 + number * 2)
    if not offset:
        continue
    record = 4 + offset * 2
    speed = word(record)
    xs = expand(record + 5)
    ys = expand(record + 1 + word(record + 2))
    x, y = 250, 80
    positions = []
    for field in range(min(len(xs), len(ys)) + 1):
        # A terminal X byte skips Y; a terminal Y byte retains this field's X.
        if field < len(xs):
            x = (x + xs[field] + 32768) % 65536 - 32768
            if field < len(ys):
                y = (y + ys[field] + 32768) % 65536 - 32768
        positions.append([x, y])
        if field < min(len(xs), len(ys)):
            positions.extend([[x, y]] * (speed - 1))
    traces.append(dict(number=number, speed=speed, positions=positions))

output = dict(sourceSha256=hashlib.sha256(raw).hexdigest(), traces=traces)
(root / 'test/fixtures/compiler-examples/galax-movements.json').write_text(
    json.dumps(output, separators=(',', ':')) + '\n')
print(f'{len(traces)} movements, {sum(len(t["positions"]) for t in traces)} field positions')
