"""Independent level-2 starting frame after original bonus/LEVLOAD/ready.
Raw assets and portable glyphs only; no runtime imports or native captures.
"""
import runpy
import struct
import zlib
import json
import hashlib
from pathlib import Path
here = Path(__file__).resolve().parent
base = runpy.run_path(str(here / 'roller2_ball.py'))
assets, panel, root = base['assets'], base['panel'], base['root']
level = (root / 'examples/Roller2/levl/2').read_bytes()[20:]
pixels = panel['pixels'][:]
for row, message in [(25, 'Score  :227'), (26, 'Level  :2'), (27, 'Time   :29 ')]:
    pixels[row*8*320:(row+1)*8*320] = bytes(8*320)
    for column, char in enumerate(message):
        for y, bits in enumerate(panel['glyphs'][char]):
            for x in range(8):
                if bits & (1 << x):
                    pixels[(row*8+y)*320+column*8+x] = 1
for x in range(20):
    for y in range(12):
        for row in range(y*16, y*16+16):
            pixels[row*320+x*16:row*320+x*16+16] = bytes([level[240+x+20*y]*3])*16
for x in range(20):
    for y in range(12):
        image = assets['images'][level[x+20*y]]
        for iy in range(image['height']):
            for ix in range(image['width']):
                at = iy*image['width']+ix
                if image['mask'][at]:
                    pixels[(y*16+iy)*320+x*16+ix] = image['pixels'][at]
for y, value in [(194,30),(193,31),(195,31),(192,23),(196,23)]:
    pixels[y*320:(y+1)*320] = bytes([value])*320
palette = list(assets['palette'])
palette[17:20] = [0xf66,0xf00,0x900]
ball, rgba = base['ball'], bytearray()
bx, by = level[482]*16, level[483]*16
for at, value in enumerate(pixels):
    x, y = at%320, at//320
    rgb = palette[value&31]
    channels = [rgb>>shift&15 for shift in (8,4,0)]
    if value&32:
        channels = [c//2 for c in channels]
    if bx<=x<bx+16 and by<=y<by+ball['height']:
        code = ball['pixels'][(y-by)*16+x-bx]&15
        if code:
            rgb = palette[16+code]
            channels = [rgb>>shift&15 for shift in (8,4,0)]
    if value==1 and 200<=y<242:
        rgb = panel['rainbow'][y-200]
        channels = [rgb>>shift&15 for shift in (8,4,0)]
    rgba.extend([c*17 for c in channels]+[255])
chunk = assets['chunk']
scan = b''.join(b'\0'+rgba[y*1280:(y+1)*1280] for y in range(250))
png = b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',320,250,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b'')
(root / 'test/fixtures/roller2/level-2-start.png').write_bytes(png)
# In this declared replay, bonus starts at field 551, Timer=282. Integer
# division gives (35*50-282)/10+30 = 176; inclusive For 0..176 adds 177.
expected = dict(evidence='Independent raw assets and portable-font source composition; deterministic injected clock, not native timing/capture.', bonusTimer=282, bonusUpper=176, bonusPoints=177, score=227, level=2, remaining=3, bx=8, by=1, colour=1, time=30, png='level-2-start.png', payloadSha256=hashlib.sha256(level).hexdigest(), rgbaSha256=hashlib.sha256(rgba).hexdigest())
(root / 'test/fixtures/roller2/levels.json').write_text(json.dumps(expected,indent=2)+'\n')
