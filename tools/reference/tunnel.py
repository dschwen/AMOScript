"""Independent Tunneltest AmIc/ILBM decode and original 48-frame animation oracle.
Uses the supplied external icon bank and background. No production decoder/runtime
imports or Amiga execution capture. Blank IFF remains only a custom-upload fixture.
"""
from pathlib import Path
import struct, hashlib, json, zlib
root=Path(__file__).resolve().parents[2]
raw=(root/'examples/Tunnel/Tunneltest.amos').read_bytes()
end=20+struct.unpack_from('>I',raw,16)[0]
assert raw[end:end+10]==b'AmBs\x00\x01AmIc'
b=(root/'examples/Tunnel/intrtunic.abk').read_bytes(); assert b[:4]==b'AmIc'; count=struct.unpack_from('>H',b,4)[0]; at=6; images=[]
for i in range(count):
    words,h,depth,hx,hy=struct.unpack_from('>5H',b,at);at+=10
    w=words*16;size=words*2*h;data=b[at:at+size*depth];at+=size*depth
    pixels=[sum(((data[p*size+(y*w+x)//8]>>(7-x%8))&1)<<p for p in range(depth)) for y in range(h) for x in range(w)]
    images.append((w,h,hx&0x3fff,hy,pixels))
palette=struct.unpack_from('>32H',b,at);assert at+64==len(b)
out=root/'test/fixtures/tunnel';out.mkdir(exist_ok=True)
def chunk(tag,data):return tag+struct.pack('>I',len(data))+data+(b'\0' if len(data)%2 else b'')
bmhd=struct.pack('>HHhhBBBBHBBhh',320,256,0,0,5,0,0,0,0,1,1,320,256)
cmap=bytes(v for rgb in palette for v in ((rgb>>8)*17,((rgb>>4)&15)*17,(rgb&15)*17))
payload=b'ILBM'+chunk(b'BMHD',bmhd)+chunk(b'CMAP',cmap)+chunk(b'BODY',bytes(320*256*5//8))
(out/'blank.iff').write_bytes(b'FORM'+struct.pack('>I',len(payload))+payload)
def png(rgba):
    def part(t,d):return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d))
    rows=b''.join(b'\0'+rgba[y*1280:(y+1)*1280] for y in range(256))
    return b'\x89PNG\r\n\x1a\n'+part(b'IHDR',struct.pack('>IIBBBBB',320,256,8,6,0,0,0))+part(b'IDAT',zlib.compress(rows))+part(b'IEND',b'')
iff=(root/'examples/Tunnel/intrtunnel').read_bytes(); assert iff[:4]==b'FORM' and iff[8:12]==b'ILBM'
chunks={};pos=12
while pos<len(iff):
    tag=iff[pos:pos+4];length=struct.unpack_from('>I',iff,pos+4)[0];chunks[tag]=iff[pos+8:pos+8+length];pos+=8+length+length%2
assert chunks[b'BMHD'][:4]==struct.pack('>HH',320,256) and chunks[b'BMHD'][8:11]==bytes([5,0,1])
assert not struct.unpack_from('>H',chunks[b'CRNG'],4)[0]&1
body=chunks[b'BODY'];pos=0;backdrop=bytearray(320*256)
for y in range(256):
    planes=[]
    for plane in range(5):
        row=bytearray()
        while len(row)<40:
            n=struct.unpack_from('b',body,pos)[0];pos+=1
            if n>=0:row.extend(body[pos:pos+n+1]);pos+=n+1
            elif n!=-128:row.extend([body[pos]]*(1-n));pos+=1
        assert len(row)==40;planes.append(row)
    for x in range(320):backdrop[y*320+x]=sum(((planes[p][x//8]>>(7-x%8))&1)<<p for p in range(5))
assert pos==len(body)
buffers=[backdrop.copy(),backdrop.copy()];logical=0;frames=[]
def paste(dest,number,dx,dy):
    w,h,hx,hy,pixels=images[number-1]
    for y in range(h):
        for x in range(w):
            xx,yy=dx-hx+x,dy-hy+y
            if pixels[y*w+x] and 0<=xx<320 and 0<=yy<256:dest[yy*320+xx]=pixels[y*w+x]
for frame in range(48):
    dest=buffers[logical]
    # Original 95x30 exclusive restore, not an inclusive 96x31 rectangle.
    for y in range(30):dest[y*320:y*320+95]=backdrop[y*320:y*320+95]
    paste(dest,3,4,1)
    if frame//10%2:paste(dest,2,9,6)
    paste(dest,4+frame%24,67,7)
    rgba=bytes(v for code in dest for v in (cmap[code*3],cmap[code*3+1],cmap[code*3+2],255))
    name=f'frame-{frame:02}.png' if frame in [0,9,10,23,47] else None
    if name:(out/name).write_bytes(png(rgba))
    frames.append(dict(frame=frame,wheel=4+frame%24,overlay=bool(frame//10%2),indicesSha256=hashlib.sha256(dest).hexdigest(),rgbaSha256=hashlib.sha256(rgba).hexdigest(),png=name))
    logical^=1
(out/'frames.json').write_text(json.dumps(dict(evidence=__doc__,sourceSha256=hashlib.sha256(raw).hexdigest(),sourceBytes=len(raw),assets={name:hashlib.sha256((root/'examples/Tunnel'/name).read_bytes()).hexdigest() for name in ['intrtunic.abk','intrtunnel']},frames=frames),indent=2)+'\n')
