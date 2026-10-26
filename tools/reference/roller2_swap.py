"""Independent source-level high-score sorting and portable-font preview.
Original strict-max/exchange order, not a native AMOS execution capture.
"""
import json
import struct
import zlib
import hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[2]
initial=json.loads((root/'test/fixtures/roller2/initialization.json').read_text())
glyphs=json.loads((root/'test/fixtures/roller2/highscore-glyphs.json').read_text())['glyphs']
cases=[]
def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
def image(rows,name):
    pixels=bytearray(320*200)
    messages=[(12,1,'Roller II scores')]
    for rank,(score,label) in enumerate(rows,1):messages.append((2,rank+3,f'{rank:2d} '+('-' if score<0 else ' ')+str(abs(score)).rjust(10)+' '+label))
    for column,row,message in messages:
        for c,char in enumerate(message):
            for y,bits in enumerate(glyphs[char]):
                for x in range(8):
                    if bits&(1<<x):pixels[(row*8+y)*320+(column+c)*8+x]=2
    rgba=bytearray(v for pixel in pixels for v in ([255,255,255,255] if pixel else [0,0,0,255]))
    scan=b''.join(b'\0'+rgba[y*1280:(y+1)*1280] for y in range(200))
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',320,200,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b'')
    (root/'test/fixtures/roller2'/name).write_bytes(png)
    return dict(png=name,indicesSha256=hashlib.sha256(pixels).hexdigest(),rgbaSha256=hashlib.sha256(rgba).hexdigest())
for key,score,label in [('middle',750,'guest'),('tie',900,'equal'),('zero',0,'zero'),('maximum',2147483647,'winner'),('negative',-5,'negative')]:
    rows=list(zip(initial['defaultScores'],initial['defaultNames']))+[(0,'')]
    frames=[]
    for stage in ['defaults','inserted','sorted']:
        if stage=='inserted':rows[10]=(score,label)
        if stage=='sorted':
            for j in range(11):
                maximum=0
                for h in range(j,11):
                    if rows[h][0]>maximum:
                        maximum=rows[h][0]
                        rows[j],rows[h]=rows[h],rows[j]
        frames.append(dict(stage=stage,rows=[list(row) for row in rows],**image(rows,f'swap-{key}-{stage}.png')))
    cases.append(dict(key=key,score=score,name=label,frames=frames))
(root/'test/fixtures/roller2/swap.json').write_text(json.dumps(dict(evidence=__doc__,cases=cases),indent=2)+'\n')
