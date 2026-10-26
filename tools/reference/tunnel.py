"""Independent Tunneltest AmIc decode and original 48-frame animation oracle.
Prepared blank ILBM replaces missing df1:intrtunnel; embedded icons replace
missing df1:intrtunic.abk. No production decoder/runtime imports or Amiga capture.
"""
from pathlib import Path
import struct, hashlib, json, zlib
root=Path(__file__).resolve().parents[2]
raw=(root/'examples/Tunnel/Tunneltest.amos').read_bytes()
end=20+struct.unpack_from('>I',raw,16)[0]
assert raw[end:end+10]==b'AmBs\x00\x01AmIc'
b=raw[end+6:]; count=struct.unpack_from('>H',b,4)[0]; at=6; images=[]
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
buffers=[bytearray(320*256),bytearray(320*256)];logical=0;frames=[]
def paste(dest,number,dx,dy):
    w,h,hx,hy,pixels=images[number-1]
    for y in range(h):
        for x in range(w):
            xx,yy=dx-hx+x,dy-hy+y
            if pixels[y*w+x] and 0<=xx<320 and 0<=yy<256:dest[yy*320+xx]=pixels[y*w+x]
for frame in range(48):
    dest=buffers[logical]
    # Original 95x30 exclusive restore, not an inclusive 96x31 rectangle.
    for y in range(30):dest[y*320:y*320+95]=bytes(95)
    paste(dest,3,4,1)
    if frame//10%2:paste(dest,2,9,6)
    paste(dest,4+frame%24,67,7)
    rgba=bytes(v for code in dest for v in (cmap[code*3],cmap[code*3+1],cmap[code*3+2],255))
    name=f'frame-{frame:02}.png' if frame in [0,9,10,23,47] else None
    if name:(out/name).write_bytes(png(rgba))
    frames.append(dict(frame=frame,wheel=4+frame%24,overlay=bool(frame//10%2),indicesSha256=hashlib.sha256(dest).hexdigest(),rgbaSha256=hashlib.sha256(rgba).hexdigest(),png=name))
    logical^=1
(out/'frames.json').write_text(json.dumps(dict(evidence=__doc__,sourceSha256=hashlib.sha256(raw).hexdigest(),sourceBytes=len(raw),frames=frames),indent=2)+'\n')
