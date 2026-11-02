"""Independent ILBM/AMOS packed bitmap and AmSp oracle for declared room entries.
No runtime imports. INITRAUM initial Bob placements are transcribed below.
"""
import struct,json,base64
from pathlib import Path
root=Path(__file__).resolve().parents[2];folder=root/'examples/ASM/game';profile=json.loads((folder/'asset-profile.json').read_text())
def word(b,p):return struct.unpack_from('>H',b,p)[0]
def long(b,p):return struct.unpack_from('>I',b,p)[0]
def planar_pixels(data,w,h,d,row):
 return bytearray(sum(((data[p*h*row+y*row+x//8]>>(7-x%8))&1)<<p for p in range(d)) for y in range(h) for x in range(w))
def packed(b):
 assert b[:4]==b'AmBk';b=b[20:];at=90 if long(b,0)==0x12031990 else 0
 assert long(b,at)==0x06071963
 columns,bands,square,d=struct.unpack_from('>4H',b,at+8);h=bands*square;row=columns
 fpos=at+long(b,at+16);ppos=at+long(b,at+20);pos=at+24
 flag=b[fpos];fpos+=1;value=b[pos];pos+=1;fb=7;pb=7
 if b[ppos]&(1<<pb):flag=b[fpos];fpos+=1
 pb-=1
 data=bytearray(columns*h*d)
 for p in range(d):
  for band in range(bands):
   for column in range(columns):
    for y in range(square):
     if flag&(1<<fb):value=b[pos];pos+=1
     data[p*h*columns+(band*square+y)*columns+column]=value
     fb-=1
     if fb<0:
      fb=7
      if b[ppos]&(1<<pb):flag=b[fpos];fpos+=1
      pb-=1
      if pb<0:pb=7;ppos+=1
 return columns*8,h,planar_pixels(data,columns*8,h,d,row)
def ilbm(b):
 chunks={};pos=12
 while pos+8<=len(b):
  tag=b[pos:pos+4];n=long(b,pos+4);chunks[tag]=b[pos+8:pos+8+n];pos+=8+n+(n&1)
 w,h=struct.unpack_from('>HH',chunks[b'BMHD']);d=chunks[b'BMHD'][8];compression=chunks[b'BMHD'][10];row=((w+15)//16)*2
 body=chunks[b'BODY'];at=0;planes=[bytearray() for _ in range(d)]
 for y in range(h):
  for p in range(d):
   out=bytearray()
   while len(out)<row:
    if not compression:out+=body[at:at+row];at+=row;break
    code=body[at];at+=1
    if code<128:out+=body[at:at+code+1];at+=code+1
    elif code>128:out+=bytes([body[at]])*(257-code);at+=1
   assert len(out)==row;planes[p]+=out
 return w,h,planar_pixels(b''.join(planes),w,h,d,row)
def bitmap(name):
 recipe=profile['recovered'].get(name)
 if recipe:
  w,h,pixels=packed((folder/recipe['file']).read_bytes())
  if recipe['swap17And31']:
   for i,c in enumerate(pixels):
    lo=c&31
    if lo in (17,31):pixels[i]=(c&32)|(31 if lo==17 else 17)
 else:w,h,pixels=ilbm((folder/name).read_bytes())
 assert w>=320 and h>=128
 return bytearray(pixels[y*w+x] for y in range(128) for x in range(320))
def sprites(name):
 b=(folder/name).read_bytes();assert b[:4]==b'AmSp';pos=6;images=[]
 for i in range(word(b,4)):
  words,h,d,hx,hy=struct.unpack_from('>5H',b,pos);pos+=10;w=words*16;n=words*2*h*d
  hx=hx&0x3fff;hx=hx-0x4000 if hx&0x2000 else hx;hy=hy-65536 if hy&0x8000 else hy
  pixels=planar_pixels(b[pos:pos+n],w,h,d,words*2) if w else bytearray();pos+=n
  images.append((w,h,d,hx,hy,pixels))
 return images
# (Bob number, X, Y, image), fresh original variable/DATA defaults, previous room 1.
calls={1:[(2,54,41,3),(5,305,34,5),(8,57,123,2)],2:[(13,205,19,2)],4:[(1,145,55,7)],
 6:[(5,110,57,6),(6,145,64,7),(7,200,65,5),(18,37,13,8),(15,122,6,2),(13,89,0,11)],
 7:[(1,249,38,2)],12:[(1,24,3,2),(2,72,2,3),(3,152,6,4)],14:[(2,55,35,2)],15:[(3,17,105,9)],
 16:[(13,272,93,2)],17:[(1,53,72,5),(6,235,82,3),(7,261,105,2)],20:[(8,168,67,14),(4,118,41,3)],
 22:[(7,163,98,2),(8,215,46,2),(9,241,46,2)]}
result={}
for room in range(1,6):
 pixels=bitmap(f'Room{room}.Pic');images=sprites(f'Room{room}.Sprites.Abk')
 # Original Priority Reverse On: descending Bob numbers, lower numbers on top.
 for number,x,y,index in sorted(calls.get(room,[]),reverse=True):
  w,h,d,hx,hy,image=images[index-1];x-=hx;y-=hy;mask=(1<<d)-1
  for yy in range(h):
   for xx in range(w):
    dx=x+xx;dy=y+yy;c=image[yy*w+xx]
    if 0<=dx<320 and 0<=dy<128 and c:pixels[dy*320+dx]=(pixels[dy*320+dx]&~mask)|c
 result[str(room)]=base64.b64encode(pixels).decode()
(root/'test/fixtures/asm/rooms.json').write_text(json.dumps({'evidence':'Independent Python ILBM/compactor/AmSp decoding and declared original INITRAUM placements; no native capture','rooms':result},indent=2)+'\n')
