#!/usr/bin/env python3
"""Independent bit addressing and TextFont spacing for the original Fonts demo.
Pass the checked, expanded FONT bank as the first argument. Its hash is pinned.
"""
import base64, hashlib, json, struct, sys
from pathlib import Path
root=Path(__file__).resolve().parents[2]
raw=(root/'examples/AMCAF/AMCAF_Examples/Fonts.AMOS').read_bytes()
font=Path(sys.argv[1]).read_bytes()
assert hashlib.sha256(font).hexdigest()=='eb290493ea691d47958308d19d753580b4704f11efc2e315b59943a45a3cdf70'
u16=lambda b,o:int.from_bytes(b[o:o+2],'big')
u32=lambda b,o:int.from_bytes(b[o:o+4],'big')
# Original Appendix-E generic bank records, independent of BankReader.
at=20+u32(raw,16);assert raw[at:at+4]==b'AmBs';count=u16(raw,at+4);at+=6;banks={}
for _ in range(count):
    assert raw[at:at+4]==b'AmBk'
    number=u16(raw,at+4);size=u32(raw,at+8)&0xfffffff
    banks[number]=raw[at+20:at+12+size];at+=12+size
assert len(banks[10])==2048
first=bytearray(320*256);second=bytearray(320*256)
def put(buffer,x,y,value):
    if 0<=x<320 and 0<=y<256:buffer[y*320+x]=value
x=0;height=u16(font,44);stride=u16(font,62)
for char in 'Hello World!':
    index=ord(char)-font[56]
    bearing=struct.unpack_from('>h',font,u32(font,20)+index*2)[0]
    spacing=struct.unpack_from('>h',font,u32(font,16)+index*2)[0]
    position=u16(font,u32(font,12)+index*4);width=u16(font,u32(font,12)+index*4+2)
    for y in range(height):
        for col in range(width):
            bit=position+col
            if font[u32(font,8)+y*stride+bit//8]&(128>>(bit%8)):put(first,x+bearing+col,y,1)
    x+=bearing+spacing
hello_width=x
for value,row,pen in [("What an ugly print-font, eh?",8,2),("But I don't care, so why should you?",10,2),('AMCAF - the next generation',13,3)]:
    x=((40-len(value))//2)*8
    for i,char in enumerate(value):
        for y in range(8):
            for col in range(8):
                if banks[10][ord(char)*8+y]&(128>>col):put(first,x+i*8+col,row*8+y,pen)
prepared=json.loads((root/'examples/AMCAF/fonts/topaz-16.json').read_text());atlas=base64.b64decode(prepared['data'])
for buffer,value,top,pen in [(first,'Waaahhh! Topaz 16!!!',112,1),(second,'Sometimes the',100,2),(second,'fonts come back!',132,2)]:
    for i,char in enumerate(value):
        for y in range(16):
            for col in range(16):
                if atlas[(ord(char)*16+y)*2+col//8]&(128>>(col%8)):put(buffer,i*16+col,top+y,pen)
regions=[]
for stage,buffer,top,height in [(0,first,0,50),(0,first,64,48),(0,first,112,16),(1,second,100,16),(1,second,132,16)]:
    regions.append(dict(stage=stage,top=top,height=height,rows=[list(buffer[y*320:(y+1)*320]) for y in range(top,top+height)]))
result=dict(evidence='Independent Python bit addressing and native spacing, with a declared AROS topaz-compatible host font.',sourceSha256=hashlib.sha256(raw).hexdigest(),fontSha256=hashlib.sha256(font).hexdigest(),helloWidth=hello_width,regions=regions)
(root/'test/fixtures/amcaf/fonts.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
