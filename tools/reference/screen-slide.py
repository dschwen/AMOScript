"""Independent ILBM decoding and native clipped-window pixels for RolIntrIdee2.
No production compiler/runtime and no native capture.
"""
import hashlib, json, struct
from pathlib import Path
root = Path(__file__).resolve().parents[2]
folder = root/'examples/Introideen'
raw = (folder/'rolIntr').read_bytes()
chunks = {}; at = 12
while at < len(raw):
    tag, size = struct.unpack_from('>4sI', raw, at)
    chunks[tag] = raw[at+8:at+8+size]; at += 8+size+(size&1)
assert struct.unpack_from('>HH',chunks[b'BMHD']) == (320,256)
assert chunks[b'BMHD'][8:11] == bytes([6,0,1])
palette = [((r>>4)<<8)|((g>>4)<<4)|(b>>4) for r,g,b in zip(chunks[b'CMAP'][::3],chunks[b'CMAP'][1::3],chunks[b'CMAP'][2::3])]
planes = [bytearray(40*256) for _ in range(6)]; body = chunks[b'BODY']; at=0
for y in range(256):
    for plane in planes:
        row = bytearray()
        while len(row)<40:
            code=struct.unpack_from('b',body,at)[0]; at+=1
            if code>=0: row+=body[at:at+code+1]; at+=code+1
            elif code!=-128: row+=bytes([body[at]])*(1-code); at+=1
        assert len(row)==40
        plane[y*40:y*40+40]=row
assert at==len(body)
pixels=bytes(sum(((planes[p][y*40+x//8]>>(7-x%8))&1)<<p for p in range(6)) for y in range(256) for x in range(320))
one=bytearray(pixels[80*320:120*320]); two=bytearray(pixels[119*320:159*320])
for y in range(3,40):
    for x in range(3,318): one[y*320+x]=13
for y in range(37):
    for x in range(3,311): two[y*320+x]=13

def rgba(index):
    colour=palette[index&31]
    if index&32: colour=(colour>>1)&0x777
    return bytes([(colour>>8)*17,((colour>>4)&15)*17,(colour&15)*17,255])
frames=[]
variants={'RolIntrIdee2.amos':(one,two), 'RolIntrIdee2.Bak':(pixels[80*320:120*320],pixels[119*320:159*320])}
for name,(one,two) in variants.items():
 for standard,end in [('PAL',310),('NTSC',260)]:
     for step in range(50):
         y1,y2=-76+step*4,359-step*4
         windows=[(y2,two),(y1,one)]
         visible=[(y,data) for y,data in windows if y<end and y+39>26]
         top=max(26,min(y for y,_ in visible)) if visible else 0
         bottom=min(end,max(y+39 for y,_ in visible)) if visible else end
         out=bytearray()
         for y in range(top,bottom):
             data=next((data for start,data in windows if 26<=y<end and start<=y<start+39),None)
             start=next((start for start,_ in windows if 26<=y<end and start<=y<start+39),0)
             for x in range(320): out+=rgba(data[(y-start)*320+x] if data is not None else 0)
         frames.append(dict(name=name,standard=standard,step=step,y1=y1,y2=y2,top=top,height=bottom-top,sha256=hashlib.sha256(out).hexdigest()))
result=dict(hashes={name:hashlib.sha256((folder/name).read_bytes()).hexdigest() for name in ['RolIntrIdee2.amos','RolIntrIdee2.Bak','rolIntr','RolIntrSam.abk']}, palette=palette,
    bitmapSha256=hashlib.sha256(pixels).hexdigest(), bitmaps={name:[hashlib.sha256(one).hexdigest(),hashlib.sha256(two).hexdigest()] for name,(one,two) in variants.items()},frames=frames)
(root/'test/fixtures/screen-slide.json').write_text(json.dumps(result,indent=2)+'\n')
