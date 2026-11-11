#!/usr/bin/env python3
"""Original GamePorts icons and Bzoom/ANIM byte addressing, independent of JS."""
import hashlib,json,struct
from pathlib import Path
root=Path(__file__).resolve().parents[2]
hash=lambda b:hashlib.sha256(b).hexdigest()
u16=lambda b,p:int.from_bytes(b[p:p+2],'big')
u32=lambda b,p:int.from_bytes(b[p:p+4],'big')
raw=(root/'examples/AMCAF/AMCAF_Examples/GamePorts.AMOS').read_bytes();at=20+u32(raw,16)
assert raw[at:at+4]==b'AmBs';count=u16(raw,at+4);at+=6;icons=[]
for _ in range(count):
 tag=raw[at:at+4];at+=4
 if tag==b'AmBk':at+=8+ (u32(raw,at+4)&0xfffffff);continue
 assert tag in [b'AmIc',b'AmSp'];n=u16(raw,at);at+=2;images=[]
 for i in range(n):
  words,h,d,hx,hy=struct.unpack_from('>5H',raw,at);at+=10;w=words*16;size=words*2*h
  data=raw[at:at+size*d];at+=size*d
  pixels=bytes(sum(((data[p*size+(y*w+x)//8]>>(7-x%8))&1)<<p for p in range(d)) for y in range(h) for x in range(w))
  images.append((w,h,pixels))
 at+=64
 if tag==b'AmIc':icons=images
assert at==len(raw)
def paste(a,num,x,y,width,height):
 w,h,pixels=icons[num-1]
 for yy in range(h):
  for xx in range(w):
   value=pixels[yy*w+xx]
   if value and 0<=x+xx<width and 0<=y+yy<height:a[(y+yy)*width+x+xx]=value
joy={};pads=[]
for mask in range(32):
 i=19;x=16
 if mask&1:i=20
 if mask&2:i=21
 if mask&4:i=23;x-=16
 if mask&8:i=22
 if mask&16:i+=5
 a=bytearray(80*68);paste(a,i,x,0,80,68);joy[str(mask)]=hash(a)
a=bytearray(128*47);paste(a,2,0,1,128,47)
for mask in [0,1,2,4,8,16,32,64,127,0]:
 for bit,x,y,icon in [(0,92,24,5),(1,103,22,7),(2,101,12,9),(3,90,14,11),(4,6,-1,15),(5,83,-1,17),(6,57,32,13)]:
  if bit in [4,5]:
   for yy in range(1,5):
    for xx in range(9 if bit==4 else 94,21 if bit==4 else 107):a[yy*128+xx]=0
  paste(a,icon+bool(mask&(1<<bit)),x,y+1,128,47)
 pads.append(dict(mask=mask,sha256=hash(a)))
(root/'test/fixtures/amcaf/gameports.json').write_text(json.dumps(dict(sourceSha256=hash(raw),joysticks=joy,pads=pads),indent=2)+'\n')
raw=(root/'examples/AMCAF/AMCAF_Examples/Data/AMCAF.Anim').read_bytes();assert hash(raw)=='049f14b963abedd80a98befbaa1a582b055fd38faddcffcf50bb25fa90ece8a3'
at=12;frames=[];planes=[];history=[];patches=[]
while at<len(raw):
 end=at+8+u32(raw,at+4);p=at+12;c={}
 while p<end:
  n=u32(raw,p+4);c[raw[p:p+4]]=raw[p+8:p+8+n];p+=8+n+(n&1)
 if not frames:
  w,h,d=u16(c[b'BMHD'],0),u16(c[b'BMHD'],2),c[b'BMHD'][8];assert(w,h,d)==(160,128,5)
  stride=20;body=c[b'BODY'];pos=0;planes=[bytearray(stride*h) for _ in range(d)]
  for y in range(h):
   for plane in range(d):
    row=bytearray()
    while len(row)<stride:
     op=body[pos];pos+=1
     if op<128:row+=body[pos:pos+op+1];pos+=op+1
     elif op>128:row+=bytes([body[pos]])*(257-op);pos+=1
    assert len(row)==stride;planes[plane][y*stride:(y+1)*stride]=row
  assert pos==len(body);patch=[]
 else:
  planes=[p[:] for p in history[max(0,len(history)-(c[b'ANHD'][18] or 2))]];delta=c[b'DLTA'];patch=[]
  for plane in range(d):
   pos=u32(delta,plane*4)
   if not pos:continue
   for col in range(stride):
    ops=delta[pos];pos+=1;y=0
    for _ in range(ops):
     op=delta[pos];pos+=1
     if 0<op<128:y+=op;continue
     if op==0:n=delta[pos];values=[delta[pos+1]]*n;pos+=2
     else:n=op&127;values=delta[pos:pos+n];pos+=n
     for value in values:
      assert y<h;offset=y*stride+col;planes[plane][offset]=value;patch.append((plane,offset,value));y+=1
 history.append([p[:] for p in planes]);patches.append(patch)
 def pixels(planes):return bytes(sum(((planes[p][y*stride+x//8]>>(7-x%8))&1)<<p for p in range(d)) for y in range(h) for x in range(w))
 frames.append(dict(offset=at,sha256=hash(pixels(planes))));at=end+(end&1)
assert len(frames)==42
buffers=[[p[:] for p in history[0]] for _ in range(2)];logical=0;index=0;app=[]
for cycle in range(90):
 pix=pixels(buffers[logical]);out=bytearray(320*256)
 for y in range(128):
  for x in range(320):out[(y+64)*320+x]=pix[(32+y//2)*160+x//2]
 app.append(hash(out));logical^=1;index+=1
 if index==42:index=2
 for plane,offset,value in patches[index]:buffers[logical][plane][offset]=value
(root/'test/fixtures/amcaf/bzoom.json').write_text(json.dumps(dict(assetSha256=hash(raw),frames=frames,application=app,evidence='Independent Python ILBM/ANIM columns, alternating raw patches and 2x central crop; not native capture.'),indent=2)+'\n')
