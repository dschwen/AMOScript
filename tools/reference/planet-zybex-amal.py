"""Independent native 8.8 MOVE slope traces and original Bob-21 composites.
Decodes raw assets; imports no production JS and never uses rendered frames.
"""
import base64,hashlib,json,struct,zlib
from pathlib import Path
root=Path(__file__).resolve().parents[2];folder=root/'examples/PlanetZybex'
sha=lambda b:hashlib.sha256(b).hexdigest()
word=lambda n:(n+32768)%65536-32768
vectors=[]
for dx,dy,steps in [(0,161,12),(10,-10,3),(-1,1,3),(32767,-32768,1),(7,9,0),(300,-300,2)]:
    count=max(1,word(steps))
    def delta(n):
        q=abs(n)*256//count
        return 0 if q>65535 else word(q if n>=0 else -q)*256
    x=y=0;fx=fy=32768;positions=[]
    for _ in range(count):
        ax=(x%65536)*65536+fx+delta(dx);ay=(y%65536)*65536+fy+delta(dy)
        x=word(ax//65536);y=word(ay//65536);fx=ax%65536;fy=ay%65536
        positions.append([x,y])
    vectors.append(dict(dx=dx,dy=dy,steps=steps,positions=positions))
# Independent packed-screen pointer/flag expansion and plane reconstruction.
raw=(folder/'level1_screen.abk').read_bytes()[20:];width,height=struct.unpack_from('>HH',raw,4)
columns,bands,square,depth=struct.unpack_from('>4H',raw,98)
fa=90+struct.unpack_from('>I',raw,106)[0];pa=90+struct.unpack_from('>I',raw,110)[0]
literals=iter(raw[114:pa]);flags=iter(raw[fa:]);bits=[(b>>n)&1 for b in raw[pa:fa] for n in range(7,-1,-1)]
flag=next(flags);byte=next(literals);expanded=[];size=columns*height*depth
for group in range((size+7)//8):
    if bits[group]:flag=next(flags)
    for bit in range(7,-1,-1):
        if len(expanded)==size:break
        if flag&(1<<bit):byte=next(literals)
        expanded.append(byte)
planes=[bytearray(columns*height)for _ in range(depth)];stream=iter(expanded)
for plane in planes:
    for band in range(bands):
        for column in range(columns):
            for y in range(square):plane[(band*square+y)*columns+column]=next(stream)
background=bytes(sum(((planes[p][y*columns+x//8]>>(7-x%8))&1)<<p for p in range(depth))for y in range(height)for x in range(width))
assert sha(background)==json.loads((root/'test/fixtures/packed-picture.json').read_text())['levels'][0]['indexedSha256']
palette=struct.unpack_from('>32H',raw,26)
program=(folder/'Zybex.AMOS').read_bytes();at=20+struct.unpack_from('>I',program,16)[0]
assert program[at:at+4]==b'AmBs' and program[at+6:at+10]==b'AmSp';at+=10
images=struct.unpack_from('>H',program,at)[0];at+=2
for image in range(1,images+1):
    words,h,planes,hx,hy=struct.unpack_from('>5H',program,at);at+=10
    count=words*2*h;data=program[at:at+count*planes];at+=count*planes
    if image==27:
        iw=words*16;ih=h;hotx=(hx&16383)-16384 if hx&8192 else hx&16383;hoty=word(hy)
        icon=bytes(sum(((data[p*count+y*words*2+x//8]>>(7-x%8))&1)<<p for p in range(planes))for y in range(h)for x in range(iw))
assert (iw,ih,hotx,hoty)==(16,16,0,0)
frames=[];out=root/'test/fixtures/planet-zybex'
def chunk(k,d):return struct.pack('>I',len(d))+k+d+struct.pack('>I',zlib.crc32(k+d)&0xffffffff)
for frame,y in enumerate([0]+[p[1]for p in vectors[0]['positions']]+[161]):
    pixels=bytearray(background)
    for row in range(ih):
        for col in range(iw):
            colour=icon[row*iw+col];xx=146+col-hotx;yy=y+row-hoty
            if colour and 0<=xx<width and 0<=yy<height:pixels[yy*width+xx]=colour
    rgba=bytearray()
    for yy in range(160):
        for xx in range(320):
            c=palette[pixels[yy*width+xx]];rgba.extend([(c>>8&15)*17,(c>>4&15)*17,(c&15)*17,255])
    record=dict(frame=frame,x=146,y=y,remaining=0 if frame in (0,13) else 13-frame,ended=frame==13,indicesSha256=sha(pixels),rgbaSha256=sha(rgba))
    if frame in (0,1,6,12,13):
        name=f'amal-drop-{frame}.png';record['png']=name
        scan=b''.join(b'\0'+rgba[yy*1280:(yy+1)*1280]for yy in range(160))
        (out/name).write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',320,160,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b''))
    frames.append(record)
(out/'amal-drop.json').write_text(json.dumps(dict(vectors=vectors,frames=frames,imageSha256=sha(icon),sourceSha256=sha(program)),indent=2)+'\n')
