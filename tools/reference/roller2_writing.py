"""Independent indexed-plane Writing oracle, portable font/blank fixtures.
Pinned AMOS source w/windows.cpp writing/draw/combine; not native captures.
"""
import runpy
import struct
import zlib
import json
import hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[2]
line=runpy.run_path(str(Path(__file__).resolve().parent/'roller2_line_pattern.py'))
assets=line['assets']
glyphs=json.loads((root/'test/fixtures/roller2/panel-glyphs.json').read_text())['glyphs']
frames=[]
def save(name,pixels):
    rgba=bytearray()
    for value in pixels:
        rgb=assets['palette'][value&31]
        channels=[rgb>>shift&15 for shift in (8,4,0)]
        if value&32:channels=[c//2 for c in channels]
        rgba.extend([c*17 for c in channels]+[255])
    chunk=assets['chunk'];scan=b''.join(b'\0'+rgba[y*1280:(y+1)*1280] for y in range(200))
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',320,200,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b'')
    (root/'test/fixtures/roller2'/name).write_bytes(png)
    frames.append(dict(png=name,indicesSha256=hashlib.sha256(pixels).hexdigest(),rgbaSha256=hashlib.sha256(rgba).hexdigest()))
def print_at(pixels,column,row,message,pen,paper,parts=2,mode=0):
    for c,char in enumerate(message):
        for y,bits in enumerate(glyphs[char]):
            for x in range(8):
                at=(row*8+y)*320+(column+c)*8+x
                fore=bool(bits&(1<<x))
                for plane in range(6):
                    source=((pen if fore else paper)>>plane)&1
                    if (fore and parts==1) or (not fore and parts==2):source=0
                    old=(pixels[at]>>plane)&1
                    result=source if mode==0 else old|source if mode==1 else old^source if mode==2 else old&source if mode==3 else old
                    pixels[at]=(pixels[at]&~(1<<plane))|(result<<plane)
pixels=bytearray(320*200)
# Original selection, using the independent left/bottom/right/top step oracle.
phase=15
for x1,y1,x2,y2 in [(33,-1,33,16),(33,16,50,16),(50,16,50,-1),(50,-1,33,-1)]:
    distance=max(abs(x2-x1),abs(y2-y1))
    for step in range(distance+1):
        x=x1+(step if x2>x1 else -step if x2<x1 else 0);y=y1+(step if y2>y1 else -step if y2<y1 else 0)
        if 0<=x<320 and 0<=y<200:pixels[y*320+x]=20 if 0xcccc&(1<<((phase-step)%16)) else 0
    phase=(phase-distance)%16
save('writing-selection.png',pixels)
for row,message in [(11,'Level:1'),(17,'Time:300')]:
    pixels[row*8*320:(row+1)*8*320]=bytes(8*320)
    print_at(pixels,0,row,message,16,0)
save('writing-panel.png',pixels)
print_at(pixels,1,3,'A',5,7)
save('writing-pen-only.png',pixels)
pixels=bytearray([36])*(320*200)
for parts in range(3):
    for mode in range(5):print_at(pixels,mode*8+3,parts*6+3,'A',21,10,parts,mode)
save('writing-matrix.png',pixels)
(root/'test/fixtures/roller2/writing.json').write_text(json.dumps(dict(evidence=__doc__,frames=frames),indent=2)+'\n')
