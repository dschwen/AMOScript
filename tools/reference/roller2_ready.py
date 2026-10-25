"""Source-derived ready popup pixels; raw AmIc decoder, no runtime imports.
Imports the independent board/panel oracles (regenerating their identical files).
Native captures and the later palette fade/gameplay are not claimed.
"""
import runpy
import struct
import zlib
from pathlib import Path
here = Path(__file__).resolve().parent
assets = runpy.run_path(str(here / 'roller2_boards.py'))
panel = runpy.run_path(str(here / 'roller2_game_panel.py'))
rgba = panel['rgba'][:]
image = assets['images'][79]
pixels = bytearray(320 * 32)
for y in range(image['height']):
    for x in range(image['width']):
        at = y * image['width'] + x
        if image['mask'][at] and x + 105 < 320 and y + 5 < 32:
            pixels[(y + 5) * 320 + x + 105] = image['pixels'][at]
for y in range(32):
    for x in range(320):
        value = pixels[y * 320 + x]
        rgb = assets['palette'][value & 31]
        channels = [(rgb >> shift & 15) for shift in (8, 4, 0)]
        if value & 32:
            channels = [c // 2 for c in channels]
        at = ((y + 90) * 320 + x) * 4
        rgba[at:at + 4] = bytes([c * 17 for c in channels] + [255])
chunk = assets['chunk']
scan = b''.join(b'\0' + rgba[y * 1280:(y + 1) * 1280] for y in range(250))
png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 320, 250, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(scan, 9)) + chunk(b'IEND', b'')
(panel['root'] / 'test/fixtures/roller2/ready-prompt.png').write_bytes(png)
