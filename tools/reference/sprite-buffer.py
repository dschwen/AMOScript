"""Independent direct-sprite matrix RGB and big-endian column expectations.
Literal two-row pixels and the documented channel-1 attached allocation;
no production compiler, bank decoder, renderer or AMOS execution imports.
"""
import hashlib,json
from pathlib import Path
frames=[]
for stage,left in enumerate([10,10,None,20,None]):
    pixels=bytearray([0,0,0,255])*320*200
    if left is not None:
        for y in range(2):
            for x in range(16):
                value=(x if y==0 else 15-x)*17
                pixels[((10+y)*320+left+x)*4:((10+y)*320+left+x)*4+4]=bytes([value,value,value,255])
    frames.append(dict(stage=stage,left=left,sha256=hashlib.sha256(pixels).hexdigest(),lineLimit=[48,48,64,64,128][stage],allocationBytes=[4800,4800,6336,6336,12480][stage],mouseVisible=stage in (2,4)))
(root:=Path(__file__).resolve().parents[2]).joinpath('test/fixtures/sprite-buffer.json').write_text(json.dumps(dict(frames=frames),indent=2)+'\n')
