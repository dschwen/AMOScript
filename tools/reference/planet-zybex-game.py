"""Independent full-game regions and original sample 4, from pinned raw bytes.
No production imports or renderer captures. Portable font and zero Rnd/beam.
"""
import hashlib,json,math,re,struct,zlib
from pathlib import Path
root=Path(__file__).resolve().parents[2];folder=root/'test/fixtures/planet-zybex'
sha=lambda b:hashlib.sha256(b).hexdigest()
raw=(root/'examples/PlanetZybex/level1_screen.abk').read_bytes()[20:]
width,height=struct.unpack_from('>HH',raw,4);columns,bands,square,depth=struct.unpack_from('>4H',raw,98)
fa=90+struct.unpack_from('>I',raw,106)[0];pa=90+struct.unpack_from('>I',raw,110)[0]
literals=iter(raw[114:pa]);flags=iter(raw[fa:]);bits=[(b>>n)&1 for b in raw[pa:fa]for n in range(7,-1,-1)]
flag=next(flags);value=next(literals);expanded=[];size=columns*height*depth
for group in range((size+7)//8):
    if bits[group]:flag=next(flags)
    for bit in range(7,-1,-1):
        if len(expanded)==size:break
        if flag&(1<<bit):value=next(literals)
        expanded.append(value)
planes=[bytearray(columns*height)for _ in range(depth)];stream=iter(expanded)
for plane in planes:
    for band in range(bands):
        for col in range(columns):
            for y in range(square):plane[(band*square+y)*columns+col]=next(stream)
background=bytes(sum(((planes[p][y*columns+x//8]>>(7-x%8))&1)<<p for p in range(depth))for y in range(height)for x in range(width))
palette=struct.unpack_from('>32H',raw,26)
font=(root/'test/fixtures/font/font8x8_basic.h').read_bytes()
assert sha(font)==json.loads((root/'test/fixtures/font/basic-source.json').read_text())['sha256']
glyphs=[[int(b,16)for b in re.findall(r'0x([0-9a-fA-F]{2})',row)]for row in re.findall(r'\{([^{}]+)\}',font.decode())]
def rgb(c):return bytes([(c>>8&15)*17,(c>>4&15)*17,(c&15)*17,255])
def score(lives):
    pixels=bytearray(640*10)
    for column,message in [(2,'Score:0'),(70,'Lives:'+str(lives))]:
        for pos,ch in enumerate(message):
            for y,bits in enumerate(glyphs[ord(ch)]):
                for x in range(8):pixels[y*640+(column+pos)*8+x]=int(bool(bits&(1<<x)))
    return b''.join(rgb(0xfff if v else 0)for v in pixels)
frames=[]
for name,scroll,lives in [('First field',0,5),('Field 6',5,5),('Field 15',14,5),('Field 25',24,5)]+[(f'Restart with {n} lives',0,n)for n in [4,3,2,1]]+[('Fresh game',0,5)]:
    left=b''.join(rgb(palette[background[y*width+x+scroll]])*2 for y in range(160)for x in range(32))
    frames.append(dict(name=name,regions=[dict(x=0,y=0,width=64,height=160,sha256=sha(left)),dict(x=0,y=161,width=640,height=10,sha256=sha(score(lives)))]))
# Full 320-pixel lowres GAME OVER, doubled beneath the mixed-resolution field.
pixels=bytearray(320*160)
for x,baseline,ink in [(123,80,4),(125,80,4),(124,79,4),(124,81,4),(124,80,7)]:
    for pos,ch in enumerate('GAME OVER'):
        for y,bits in enumerate(glyphs[ord(ch)]):
            for bit in range(8):
                if bits&(1<<bit):pixels[(baseline-7+y)*320+x+pos*8+bit]=ink
rgba=b''.join(rgb(0xb if p==4 else 0xadf if p==7 else 0)*2 for p in pixels)+rgb(0)*640*11
# The source Centre on the single-row hires window scrolls its line immediately.
def chunk(k,d):return struct.pack('>I',len(d))+k+d+struct.pack('>I',zlib.crc32(k+d)&0xffffffff)
name='game-over-full.png';scan=b''.join(b'\0'+rgba[y*2560:(y+1)*2560]for y in range(171))
(folder/name).write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',640,171,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b''))
frames.append(dict(name='Game over',regions=[dict(x=0,y=0,width=640,height=171,sha256=sha(rgba))],png=name))
program=(root/'examples/PlanetZybex/Zybex.AMOS').read_bytes();at=program.index(b'Samples ')
assert program[at-12:at-8]==b'AmBk' and struct.unpack_from('>H',program,at-8)[0]==5
length=struct.unpack_from('>I',program,at-4)[0]&0xfffffff;bank=program[at+8:at+length]
count=struct.unpack_from('>H',bank)[0];offset=struct.unpack_from('>I',bank,2+3*4)[0]
frequency,size=struct.unpack_from('>HI',bank,offset+8);data=bank[offset+14:offset+14+size]
assert size==4554 and len(data)==size and count>=4
pcm=b''.join(struct.pack('<f',(v if v<128 else v-256)/128)for v in data)
(folder/'sample4.f32').write_bytes(pcm)
audio=dict(number=4,mask=1,volume=56,length=size,frequency=frequency,sha256=sha(data),pcm='sample4.f32',pcmSha256=sha(pcm),periods={s:max(124,clock//frequency)for s,clock in [('PAL',3546895),('NTSC',3579545)]})
(folder/'game.json').write_text(json.dumps(dict(sourceSha256=sha(program),frames=frames,audio=audio),indent=2)+'\n')
