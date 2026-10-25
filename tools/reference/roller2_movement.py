"""Independent first-level source trajectory and low-four-plane sprite images.
No AMOScript imports or captures; uses the independent raw asset/board oracle.
"""
import runpy
import struct
import json
import hashlib
import zlib
from pathlib import Path
base = runpy.run_path(str(Path(__file__).resolve().with_name('roller2_ball.py')))
root, pixels, palette, ball, panel = [base[key] for key in ['root','pixels','palette','ball','panel']]
level = (root / 'examples/Roller2/levl/1').read_bytes()[20:]
x, y = level[482:484]
assert (x,y) == (5,9)
trajectory = []
while level[x+1+y*20] in (1,2,18,29,50):
    for step in range(1,9):
        trajectory.append(dict(field=len(trajectory)+1, bx=x, by=y, x=128+x*16+step*2, y=50+y*16))
    x += 1
assert x == 8 and level[x+1+y*20] == 3
frames = []
for field, hardware, name in [(2,212,'movement-2.png'),(8,224,'movement-8.png'),(16,240,'movement-16.png'),(25,256,'movement-guard.png')]:
    rgba = bytearray()
    for at, value in enumerate(pixels):
        sx, sy = at%320, at//320
        rgb = palette[value&31]
        channels = [rgb>>shift&15 for shift in (8,4,0)]
        if value&32:
            channels = [c//2 for c in channels]
        local = hardware-128
        if local<=sx<local+16 and 144<=sy<144+ball['height']:
            code = ball['pixels'][(sy-144)*16+sx-local]&15
            if code:
                rgb = palette[16+code]
                channels = [rgb>>shift&15 for shift in (8,4,0)]
        if value==1 and 200<=sy<242:
            rgb = panel['rainbow'][sy-200]
            channels = [rgb>>shift&15 for shift in (8,4,0)]
        rgba.extend([c*17 for c in channels]+[255])
    chunk = base['chunk']
    scan = b''.join(b'\0'+rgba[row*1280:(row+1)*1280] for row in range(250))
    png = b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',320,250,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b'')
    (root / 'test/fixtures/roller2' / name).write_bytes(png)
    frames.append(dict(field=field, png=name, hardwareX=hardware, rgbaSha256=hashlib.sha256(rgba).hexdigest()))
(root / 'test/fixtures/roller2/movement.json').write_text(json.dumps(dict(evidence='Independent raw map and original floor-handler step=2/Wait Vbl trajectory; portable palette/font composition, not native timing/capture.', trajectory=trajectory, frames=frames, guard=dict(bx=8,by=9,hd=3,hc=2,handler='KCWEG')),indent=2)+'\n')
