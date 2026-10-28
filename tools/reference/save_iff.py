"""Independent literal ILBM chunk/bitplane expectations, not a native capture."""
import hashlib
import json
from pathlib import Path
import struct

root = Path(__file__).resolve().parents[2]
word = lambda n: struct.pack('>H', n)
long = lambda n: struct.pack('>I', n)
def chunk(name, data):
    return name.encode() + long(len(data)) + data + (b'\0' if len(data) & 1 else b'')

def image(width, height, depth, pixels, body, compression):
    bmhd = struct.pack('>HHhhBBBBHBBhh', width, height, 0, 0, depth, 0, compression, 0, 0, 20, 22, width, height)
    cmap = bytes(channel << 4 for colour in range(32) for channel in [colour % 16] * 3)
    amsc = b''.join(word(n) for n in [128, 50, width, height, 0, 0, 0])
    chunks = chunk('BMHD', bmhd) + chunk('CAMG', long(0)) + chunk('AMSC', amsc) + chunk('CMAP', cmap) + chunk('BODY', body)
    encoded = b'FORM' + long(len(chunks) + 4) + b'ILBM' + chunks
    return dict(width=width, height=height, depth=depth, pixelsHex=bytes(pixels).hex(), fileHex=encoded.hex())

width, height, depth = 17, 3, 4
pixels = [(3*x + 5*y) % 16 for y in range(height) for x in range(width)]
body = bytearray()
for y in range(height):
    for plane in range(depth):
        row = bytearray(4)
        for x in range(width):
            if pixels[y*width+x] & (1 << plane):
                row[x//8] |= 128 >> (x % 8)
        body += row
matrix = image(width, height, depth, pixels, body, 0)

# One literal packet of four distinct bytes: payload length 5 plus external pad.
raw = bytes.fromhex('12345678')
odd_pixels = [1 if raw[x//8] & (128 >> (x % 8)) else 0 for x in range(32)]
odd = image(32, 1, 1, odd_pixels, bytes.fromhex('0312345678'), 1)
result = dict(evidence='Independent Python struct packing and planar extraction; literal ByteRun1 packet and canonical external padding; not AMOS execution.',
              generatorSha256=hashlib.sha256((root / 'examples/Introideen/KugelanimBerech.amos').read_bytes()).hexdigest(),
              uncompressed=matrix, compressedOdd=odd)
(root / 'test/fixtures/save-iff.json').write_text(json.dumps(result, indent=2) + '\n')
