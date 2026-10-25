"""Independent original colour-collection pixels and byte/score expectations.
Uses raw asset and arbitrary-precision random oracles, no runtime/compiler imports.
"""
import runpy
import struct
import json
import hashlib
import zlib
from pathlib import Path
here = Path(__file__).resolve().parent
base = runpy.run_path(str(here / 'roller2_ball.py'))
root, panel, ball = base['root'], base['panel'], base['ball']
icons = base['assets']['images']
level = bytearray((root / 'examples/Roller2/levl/1').read_bytes()[20:])
start_pixels = base['pixels'][:]
scope = {}
exec((here.parent / 'random_vectors.py').read_text().split('vectors=[]')[0], scope)
random = scope['Oracle'](0)
choices = [random.rnd(1)+1 for _ in range(5)]
goals = {1:[0xf66,0xf00,0x900],2:[0x9f9,0x0d0,0x0a0],3:[0x66f,0x00f,0x009],4:[0xff6,0xdd0,0x990],5:[0x6ff,0x0dd,0x099]}

def paste(pixels, number, x, y):
    image = icons[number]
    for iy in range(image['height']):
        for ix in range(image['width']):
            at = iy*image['width']+ix
            if image['mask'][at]:
                pixels[(y+iy)*320+x+ix] = image['pixels'][at]

def text(pixels, row, message):
    pixels[row*8*320:(row+1)*8*320] = bytes(8*320)
    for column, char in enumerate(message):
        for y, bits in enumerate(panel['glyphs'][char]):
            for x in range(8):
                if bits & (1<<x):
                    pixels[(row*8+y)*320+column*8+x] = 1

def image(pixels, palette, local_x, name):
    rgba = bytearray()
    for at, value in enumerate(pixels):
        x, y = at%320, at//320
        rgb = palette[value&31]
        channels = [rgb>>shift&15 for shift in (8,4,0)]
        if value&32:
            channels = [c//2 for c in channels]
        if local_x<=x<local_x+16 and 144<=y<144+ball['height']:
            code = ball['pixels'][(y-144)*16+x-local_x]&15
            if code:
                rgb = palette[16+code]
                channels = [rgb>>shift&15 for shift in (8,4,0)]
        if value==1 and 200<=y<242:
            rgb = panel['rainbow'][y-200]
            channels = [rgb>>shift&15 for shift in (8,4,0)]
        rgba.extend([c*17 for c in channels]+[255])
    chunk = base['chunk']
    scan = b''.join(b'\0'+rgba[row*1280:(row+1)*1280] for row in range(250))
    png = b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',320,250,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b'')
    (root / 'test/fixtures/roller2' / name).write_bytes(png)
    return dict(png=name, rgbaSha256=hashlib.sha256(rgba).hexdigest(), indicesSha256=hashlib.sha256(pixels).hexdigest())

pixels = start_pixels[:]
paste(pixels, choices[0], 9*16, 9*16)
palette = list(base['palette'])
# First next-field component step of BCL[2]; no score Print has completed yet.
palette[17:20] = [sum(((a>>s&15)+((b>>s&15)>(a>>s&15))-((b>>s&15)<(a>>s&15)))<<s for s in (8,4,0)) for a,b in zip(palette[17:20],goals[2])]
transition = dict(time=5920,score=10,printedScore=0,colour=2,remaining=5,**image(pixels,palette,8*16,'colour-transition.png'))
frames = []
pixels = start_pixels[:]
for index, time in enumerate([6600,8000,9400,10800,12200]):
    tile = 9+index
    required = level[tile+9*20]-2
    assert required == index+1
    colour = level[240+tile+9*20]
    assert colour == [2,3,4,5,1][index]
    paste(pixels, choices[index], tile*16, 9*16)
    level[tile+9*20] = 1
    score, remaining, bx = (index+1)*10, 4-index, 8+index
    palette = list(base['palette']);palette[17:20] = goals[colour]
    # Source Timer resets at field 269. Final bonus guard follows GAMED before
    # further idle Prints, so its last countdown stays at the collection field.
    printed_at = time if index<4 else 11040
    countdown = (35*50-(printed_at//20-269))//50
    text(pixels,25,'Score  :'+str(score)+'  ')
    text(pixels,27,'Time   :'+str(countdown)+'  ')
    frames.append(dict(time=time,bx=bx,by=9,score=score,remaining=remaining,colour=colour,countdown=countdown,fillIcon=choices[index],payloadSha256=hashlib.sha256(level).hexdigest(),**image(pixels,palette,bx*16,f'colour-{index+1}.png')))
(root / 'test/fixtures/roller2/colours.json').write_text(json.dumps(dict(evidence='Independent raw assets, source KCWEG/Poke/score/count rules and zero-seed/beam random oracle; captured steady palettes on declared portable clock/font, not an Amiga capture.', transition=transition, frames=frames, guard='level-bonus', changedOffsets=list(range(189,194))),indent=2)+'\n')
