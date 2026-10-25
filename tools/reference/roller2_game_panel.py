"""Independent portable-font/Roller II score-panel oracle; no runtime imports."""
import json
from pathlib import Path
import struct
import zlib

root = Path(__file__).resolve().parents[2]
glyphs = json.loads((root / 'test/fixtures/roller2/panel-glyphs.json').read_text())['glyphs']
# Original 584–588 followed by whole-row Cline replacements 598–600. Numeric
# strings follow the portable runtime's current Print subset, not native captures.
text = {25: 'Score  :0', 26: 'Level  :1', 27: 'Time   :0', 28: 'HiScore:4406', 29: 'LoScore:400'}
pixels = bytearray(320 * 250)
for row, message in text.items():
    for column, char in enumerate(message):
        for y, bits in enumerate(glyphs[char]):
            for x in range(8):
                if bits & (1 << x):
                    pixels[(row * 8 + y) * 320 + column * 8 + x] = 1
rainbow = [0] * 64
for base in (0, 8, 16):
    for j in range(9):
        rainbow[base + j] = 3840 - 16 * (15 - j)
for base in (24, 32):
    for j in range(9):
        rainbow[base + j] = 15 + 16 * j + 16
rgba = bytearray()
for at, value in enumerate(pixels):
    row = at // 320
    # Current portable screen hardware Y=50, original Rainbow Y=250, height=42.
    rgb = rainbow[row - 200] if value and 200 <= row < 242 else 0
    rgba.extend([(rgb >> shift & 15) * 17 for shift in (8, 4, 0)] + [255])
def chunk(tag, data):
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data))
scan = b''.join(b'\x00' + rgba[row * 1280:(row + 1) * 1280] for row in range(250))
png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 320, 250, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(scan, 9)) + chunk(b'IEND', b'')
(root / 'test/fixtures/roller2/game-load-panel.png').write_bytes(png)
(root / 'test/fixtures/roller2/game-load-panel.indices').write_bytes(pixels)
