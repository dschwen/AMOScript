"""Independent original 609–617 board/ball/fade oracle; no runtime imports.
Raw AmIc/AmSp/AmBk data and source-derived expected pixels, not native captures.
"""
import runpy
import struct
import json
import hashlib
import zlib
from pathlib import Path
here = Path(__file__).resolve().parent
assets = runpy.run_path(str(here / 'roller2_boards.py'))
panel = runpy.run_path(str(here / 'roller2_game_panel.py'))
root = panel['root']
level = (root / 'examples/Roller2/levl/1').read_bytes()[20:]
indices = panel['pixels'][:]
for x in range(20):
    for y in range(12):
        value = level[240 + x + 20*y] * 3
        for row in range(y*16, y*16+16):
            indices[row*320+x*16:row*320+x*16+16] = bytes([value])*16
for x in range(20):
    for y in range(12):
        image = assets['images'][level[x+y*20]]
        for iy in range(image['height']):
            for ix in range(image['width']):
                at = iy*image['width']+ix
                if image['mask'][at]:
                    indices[(y*16+iy)*320+x*16+ix] = image['pixels'][at]
raw = (root / 'examples/Roller2/iffp/sprites.abk').read_bytes()
assert raw[:4] == b'AmSp'
count = struct.unpack_from('>H', raw, 4)[0]
offset, images = 6, [None]
for i in range(count):
    words, height, depth, hx, hy = struct.unpack_from('>5H', raw, offset)
    offset += 10
    if not words:
        assert not (height or depth or hx or hy)
        images.append(None)
        continue
    assert words == 1
    data = raw[offset:offset+2*height*depth]
    offset += len(data)
    pixels = bytearray(16*height)
    for p in range(depth):
        for at in range(len(pixels)):
            if data[p*2*height+at//8] & (128>>(at%8)):
                pixels[at] |= 1<<p
    images.append(dict(pixels=pixels, height=height, depth=depth, hx=hx, hy=hy))
assert offset+64 == len(raw)
ball = images[2]
assert ball['depth'] == 6 and ball['hx'] == 0 and ball['hy'] == 0
palette = list(assets['palette'])
palette[17:20] = [0xf66, 0xf00, 0x900]
frames = []
for step, border, name, time in [(2,False,'ball-fade-2.png',None),(7,False,'ball-fade-7.png',None),(15,True,'ball-start.png',None),(15,True,'ball-idle.png',34)]:
    pixels = indices[:]
    if border:
        for y, value in [(194,30),(193,31),(195,31),(192,23),(196,23)]:
            pixels[y*320:(y+1)*320] = bytes([value])*320
    if time is not None:
        pixels[27*8*320:28*8*320] = bytes(8*320)
        for column, char in enumerate('Time   :'+str(time)+' '):
            for y, bits in enumerate(panel['glyphs'][char]):
                for x in range(8):
                    if bits & (1<<x):
                        pixels[(27*8+y)*320+column*8+x] = 1
    rgba = bytearray()
    faded = [sum(min(rgb>>shift&15,step)<<shift for shift in (8,4,0)) for rgb in palette]
    for at, value in enumerate(pixels):
        x, y = at%320, at//320
        rgb = faded[value&31]
        channels = [rgb>>shift&15 for shift in (8,4,0)]
        if value&32:
            channels = [c//2 for c in channels]
        # Direct attached channels resolve the low four planes before transparency.
        if 80<=x<96 and 144<=y<144+ball['height']:
            code = ball['pixels'][(y-144)*16+x-80]&15
            if code:
                rgb = faded[16+code]
                channels = [rgb>>shift&15 for shift in (8,4,0)]
        if value==1 and 200<=y<242:
            rgb = panel['rainbow'][y-200]
            channels = [rgb>>shift&15 for shift in (8,4,0)]
        rgba.extend([c*17 for c in channels]+[255])
    chunk = assets['chunk']
    scan = b''.join(b'\0'+rgba[y*1280:(y+1)*1280] for y in range(250))
    png = b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',320,250,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b'')
    (root / 'test/fixtures/roller2' / name).write_bytes(png)
    frames.append(dict(png=name, step=step, border=border, rgbaSha256=hashlib.sha256(rgba).hexdigest(), indicesSha256=hashlib.sha256(pixels).hexdigest()))
words = []
for y in range(ball['height']):
    words.append([sum(((ball['pixels'][y*16+x]>>plane)&1)<<(15-x) for x in range(16)) for plane in range(4)])
(root / 'test/fixtures/roller2/ball.json').write_text(json.dumps(dict(evidence='Independent raw assets and original 609–617 palette/sprite/fade/border semantics; portable font and hardware origin, no native capture.', sourceDepth=6, hardware=[208,194], local=[80,144], spriteWords=words, frames=frames),indent=2)+'\n')
