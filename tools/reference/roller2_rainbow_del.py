"""Independent PAL row-colour oracle for the declared original-557 preview.
Prepared grayscale slot 0/red slot 1 over colour 1; not a native capture.
"""
import struct
import zlib
import json
import hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[2]
def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
frames=[]
for stage,slots in [('overlap',[0,1]),('slot-zero-deleted',[1]),('all-deleted',[])]:
    rgba=bytearray()
    for y in range(256):
        rgb=0x135
        if stage=='overlap' and 200<=y<205:rgb=(y-200+3)*0x111
        elif stage!='all-deleted' and 200<=y<210:rgb=0xf00
        pixel=bytes([(rgb>>shift&15)*17 for shift in (8,4,0)]+[255]);rgba.extend(pixel*320)
    scan=b''.join(b'\0'+rgba[y*1280:(y+1)*1280] for y in range(256))
    name=f'rainbow-del-{stage}.png'
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',320,256,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b'')
    (root/'test/fixtures/roller2'/name).write_bytes(png)
    frames.append(dict(stage=stage,png=name,slots=slots,rgbaSha256=hashlib.sha256(rgba).hexdigest()))
(root/'test/fixtures/roller2/rainbow-del.json').write_text(json.dumps(dict(evidence=__doc__,frames=frames),indent=2)+'\n')
