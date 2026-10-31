"""Independent ILBM/AmSp pixel oracle for original ASM first-room startup.
Top 128 rows, original three Bobs, and the handle-removal state. No JS imports.
"""
import struct,json,base64
from pathlib import Path
root=Path(__file__).resolve().parents[2];folder=root/'examples/ASM/game'
b=(folder/'Room1.Pic').read_bytes();pos=12;chunks={}
while pos<len(b):
 tag=b[pos:pos+4];size=struct.unpack_from('>I',b,pos+4)[0];chunks[tag]=b[pos+8:pos+8+size];pos+=8+size+(size&1)
w,h=struct.unpack_from('>HH',chunks[b'BMHD']);depth=chunks[b'BMHD'][8];assert (w,h,depth)==(320,256,6)
body=chunks[b'BODY'];at=0;planes=[[bytearray(40) for y in range(h)] for p in range(depth)]
for y in range(h):
 for p in range(depth):
  row=bytearray()
  while len(row)<40:
   code=body[at];at+=1
   if code<128:row+=body[at:at+code+1];at+=code+1
   elif code>128:row+=bytes([body[at]])*(257-code);at+=1
  assert len(row)==40;planes[p][y]=row
pixels=bytearray(sum(((planes[p][y][x//8]>>(7-x%8))&1)<<p for p in range(depth)) for y in range(128) for x in range(320))
s=(folder/'Room1.Sprites.Abk').read_bytes();assert s[:4]==b'AmSp';count=struct.unpack_from('>H',s,4)[0];pos=6;images=[]
for i in range(count):
 words,ih,d,x,y=struct.unpack_from('>5H',s,pos);pos+=10;iw=words*16;size=words*2*ih
 x=x&0x3fff;x=x-0x4000 if x&0x2000 else x;y=y-65536 if y&0x8000 else y
 if not words:images.append((0,0,bytearray(),0,0));continue
 data=s[pos:pos+size*d];pos+=size*d
 image=bytearray(sum(((data[p*size+yy*words*2+xx//8]>>(7-xx%8))&1)<<p for p in range(d)) for yy in range(ih) for xx in range(iw))
 images.append((iw,ih,image,x,y))
def draw(calls):
 result=bytearray(pixels)
 for x,y,index in calls:
  iw,ih,img,hx,hy=images[index-1];x-=hx;y-=hy
  for yy in range(ih):
   for xx in range(iw):
    dx=x+xx;dy=y+yy;c=img[yy*iw+xx]
    if 0<=dx<320 and 0<=dy<128 and c:result[dy*320+dx]=c
 return base64.b64encode(result).decode()
out=dict(evidence='Independent Python ILBM/AmSp expansion and declared original Bob placement; no native capture',initial=draw([(54,41,3),(305,34,5),(57,123,2)]),handleRemoved=draw([(305,34,5),(57,123,2)]))
(root/'test/fixtures/asm/room1.json').write_text(json.dumps(out,indent=2)+'\n')
