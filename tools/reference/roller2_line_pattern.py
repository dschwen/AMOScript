"""Independent portable Set Line/Box preview, not native graphics capture.
Original 333/354/356, raw AmIc palette, declared blank preview and phase 15.
"""
import runpy
import struct
import zlib
import hashlib
import json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
assets=runpy.run_path(str(Path(__file__).resolve().parent/'roller2_boards.py'))
pixels=bytearray(320*200)
phase=15
frames=[]
for name,pattern,colour,cell in [('line-selected.png',0xcccc,20,(2,0)),('line-erased.png',0xffff,0,(2,0)),('line-moved.png',0xcccc,20,(4,2))]:
    x,y=cell[0]*17-1,cell[1]*17-1
    for x1,y1,x2,y2 in [(x,y,x,y+17),(x,y+17,x+17,y+17),(x+17,y+17,x+17,y),(x+17,y,x,y)]:
        distance=max(abs(x2-x1),abs(y2-y1))
        for step in range(distance+1):
            px=x1+(step if x2>x1 else -step if x2<x1 else 0)
            py=y1+(step if y2>y1 else -step if y2<y1 else 0)
            if 0<=px<320 and 0<=py<200:pixels[py*320+px]=colour if pattern&(1<<((phase-step)%16)) else 0
        phase=(phase-distance)%16
    rgba=bytearray()
    for value in pixels:
        rgb=assets['palette'][value&31]
        rgba.extend([(rgb>>shift&15)*17 for shift in (8,4,0)]+[255])
    chunk=assets['chunk'];scan=b''.join(b'\0'+rgba[y*1280:(y+1)*1280] for y in range(200))
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',320,200,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b'')
    (root/'test/fixtures/roller2'/name).write_bytes(png)
    frames.append(dict(png=name,pattern=pattern,phase=phase,cell=list(cell),indicesSha256=hashlib.sha256(pixels).hexdigest(),rgbaSha256=hashlib.sha256(rgba).hexdigest()))
(root/'test/fixtures/roller2/line-pattern.json').write_text(json.dumps(dict(evidence=__doc__,frames=frames),indent=2)+'\n')
