"""Independent original PFEIL level-2 frames; raw assets/portable glyphs only."""
import runpy
import struct
import zlib
import hashlib
import json
from pathlib import Path
base=runpy.run_path(str(Path(__file__).resolve().parent/'roller2_progression.py'))
root,panel,assets=base['root'],base['panel'],base['assets']
frames=[]
for name,x0,y0,countdown,time,bx,by in [('arrow-step-7.png',135,16,29,13140,8,1),('arrow-down.png',144,64,28,14000,9,4),('arrow-left.png',80,48,27,15400,5,3)]:
    pixels=base['pixels'][:]
    pixels[27*8*320:28*8*320]=bytes(8*320)
    for column,char in enumerate('Time   :'+str(countdown)+' '):
        for y,bits in enumerate(panel['glyphs'][char]):
            for x in range(8):
                if bits&(1<<x):pixels[(27*8+y)*320+column*8+x]=1
    rgba=bytearray()
    for at,value in enumerate(pixels):
        x,y=at%320,at//320
        rgb=base['palette'][value&31]
        channels=[rgb>>shift&15 for shift in (8,4,0)]
        if value&32:channels=[c//2 for c in channels]
        if x0<=x<x0+16 and y0<=y<y0+base['ball']['height']:
            code=base['ball']['pixels'][(y-y0)*16+x-x0]&15
            if code:
                rgb=base['palette'][16+code];channels=[rgb>>shift&15 for shift in (8,4,0)]
        if value==1 and 200<=y<242:
            rgb=panel['rainbow'][y-200];channels=[rgb>>shift&15 for shift in (8,4,0)]
        rgba.extend([c*17 for c in channels]+[255])
    chunk=assets['chunk'];scan=b''.join(b'\0'+rgba[y*1280:(y+1)*1280] for y in range(250))
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',320,250,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b'')
    (root/'test/fixtures/roller2'/name).write_bytes(png)
    frames.append(dict(png=name,time=time,bx=bx,by=by,x=x0+128,y=y0+50,countdown=countdown,rgbaSha256=hashlib.sha256(rgba).hexdigest()))
(root/'test/fixtures/roller2/arrows.json').write_text(json.dumps(dict(evidence='Independent raw assets and source PFEIL 930–947/N34 767–768; portable font/origin and injected clock, not native timing/capture.',frames=frames,trajectory=[dict(time=13000+20*step,x=256+step,y=66,bx=8,by=1) for step in range(1,17)]),indent=2)+'\n')
