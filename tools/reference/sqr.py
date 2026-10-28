"""Independent exact-integer square-root rounding oracle for normalized FFP.
No production JavaScript, host sqrt, or Motorola restoring recurrence is used.
"""
import hashlib
import json
import math
import struct
from pathlib import Path

root = Path(__file__).resolve().parents[2]
inputs = [0]
for exponent in [1, 2, 3, 32, 63, 64, 65, 66, 67, 126, 127]:
    for mantissa in [0x800000, 0x800001, 0xaaaaaa, 0xb504f2, 0xb504f3, 0xc00000, 0xfffffe, 0xffffff]:
        inputs.append((mantissa << 8) | exponent)
seed = 0x12345678
for _ in range(256):
    seed = (1664525 * seed + 1013904223) & 0xffffffff
    mantissa = 0x800000 | (seed & 0x7fffff)
    exponent = 1 + (seed >> 24) % 127
    inputs.append((mantissa << 8) | exponent)

def sqrt_bits(bits):
    if not bits:
        return 0
    mantissa, exponent = bits >> 8, bits & 127
    square = (mantissa * (1 if exponent & 1 else 2)) << 23
    answer = math.isqrt(square)
    if 4 * square >= (2 * answer + 1) ** 2:
        answer += 1
    answer = min(answer, 0xffffff)
    return (answer << 8) | ((exponent + 1) // 2 + 32)

sample = [0, 0x80000041, 0x80000042, 0xffffff7f]
code = bytearray()
for bits in sample:
    # Original Print/Sqr/( / FFP literal / ) opcodes, independent of JS tables.
    line = struct.pack('>HHHHIH', 0x476, 0x768, 0x74, 0x46, bits, 0x7c) + b'\0\0'
    code += bytes([(len(line) + 2) // 2, 0]) + line
program = b'AMOS Basic v1.00' + struct.pack('>I', len(code)) + code

def value(bits):
    return (bits >> 8) * 2.0 ** ((bits & 127) - 88) if bits else 0

result = dict(name='ffp-square-root',
              source='Print Sqr(0)\nPrint Sqr(1.0)\nPrint Sqr(2.0)\nPrint Sqr(9223371487098961920.0)\n',
              programHex=program.hex(),
              encoding=dict(kind='independent-bytes', notes='Literal Print/Sqr/parenthesis/FFP opcodes and line bounds, assembled without production encoder or token table.'),
              evidence=dict(kind='source-analysis', url='https://github.com/bayerf42/MotoFFP/blob/e3737f328cf1c9bae91469cce4686611ab7d56e7/FFPSQRT.asm',
                            notes='Exact Python integer-square-root/half-unit comparison oracle for the source-derived FFP rounding profile; not an AMOS capture.'),
              expected=dict(values=[[value(sqrt_bits(bits))] for bits in sample], halted=True),
              motorolaRevision='e3737f328cf1c9bae91469cce4686611ab7d56e7',
              vectors=[dict(input=f'{bits:08x}', output=f'{sqrt_bits(bits):08x}') for bits in inputs],
              kugelSha256=hashlib.sha256((root / 'examples/Introideen/Kugel.amos').read_bytes()).hexdigest(),
              kugelFailure=dict(line=14, offset=520, gx=89, gy=42, p=-1, ticks=240132))
(root / 'test/fixtures/conformance/sqr.json').write_text(json.dumps(result, indent=2) + '\n')
