"""Independent original GAME OVER passes and explicit opaque comparison.
Portable public-domain font rows, not native Topaz or rendered runtime inputs.
"""
import hashlib,json,re,struct,zlib
from pathlib import Path
root=Path(__file__).resolve().parents[2]
font=(root/'test/fixtures/font/font8x8_basic.h').read_bytes()
assert hashlib.sha256(font).hexdigest()==json.loads((root/'test/fixtures/font/basic-source.json').read_text())['sha256']
glyphs=[[int(b,16)for b in re.findall(r'0x([0-9a-fA-F]{2})',row)]for row in re.findall(r'\{([^{}]+)\}',font.decode())]
assert len(glyphs)==128 and all(len(row)==8 for row in glyphs)
palette=[0x000,0xf80,0xfff,0x00f,0x00b,0x0f0,0x080,0xadf,0x888,0x444,0xaaa,0x666,0x0ff,0xf0f,0x800,0x008]+[0]*16
pixels=bytearray(320*160);frames=[];folder=root/'test/fixtures/planet-zybex'
def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
for stage,mode in enumerate([0,1,0]):
    for x,baseline,ink in [(123,80,4),(125,80,4),(124,79,4),(124,81,4),(124,80,7)]:
        for char,ch in enumerate('GAME OVER'):
            for y,bits in enumerate(glyphs[ord(ch)]):
                for bit in range(8):
                    at=(baseline-7+y)*320+x+char*8+bit
                    if bits&(1<<bit):pixels[at]=ink
                    elif mode==1:pixels[at]=0
    rgba=bytearray()
    for index in pixels:
        colour=palette[index];rgba.extend([(colour>>8&15)*17,(colour>>4&15)*17,(colour&15)*17,255])
    scan=b''.join(b'\0'+rgba[y*1280:(y+1)*1280] for y in range(160))
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',320,160,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b'')
    name=f'game-over-{stage}.png';(folder/name).write_bytes(png)
    frames.append(dict(stage=stage,mode=mode,png=name,indicesSha256=hashlib.sha256(pixels).hexdigest(),rgbaSha256=hashlib.sha256(rgba).hexdigest()))
assert frames[0]['indicesSha256']==frames[2]['indicesSha256']!=frames[1]['indicesSha256']
(folder/'game-over.json').write_text(json.dumps(dict(frames=frames),indent=2)+'\n')
