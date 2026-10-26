"""Independent raw-icon/pattern capture oracle; not native Amiga execution.
Exclusive 106-pixel capture, word padding and original masked requester images.
"""
import runpy
import struct
import zlib
import hashlib
import json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
a=runpy.run_path(str(Path(__file__).resolve().parent/'roller2_boards.py'))
frames=[]
for mode,top,height,number in [('missing',100,40,69),('overwrite',80,70,68)]:
    pixels=bytearray(v for y in range(200) for v in [(y*3)%63+1]*320)
    saved=bytearray(112*height)
    for y in range(height):saved[y*112:y*112+106]=pixels[(top+y)*320+110:(top+y)*320+216]
    captured_hash=hashlib.sha256(saved).hexdigest()
    for stage in ['before','popup','restored']:
        if stage=='popup':
            if mode=='overwrite':
                for y in range(80,149):pixels[y*320+110:y*320+216]=bytes(106)
            image=a['images'][number]
            for y in range(image['height']):
                for x in range(image['width']):
                    value=image['pixels'][y*image['width']+x]
                    if value:pixels[(top+y)*320+110+x]=value
        if stage=='restored':
            # Original Make Icon Mask 118 makes zero padding transparent.
            for y in range(height):
                for x in range(112):
                    value=saved[y*112+x]
                    if value:pixels[(top+y)*320+110+x]=value
        rgba=bytearray()
        for value in pixels:
            rgb=a['palette'][value&31];channels=[rgb>>shift&15 for shift in (8,4,0)]
            if value&32:channels=[c//2 for c in channels]
            rgba.extend([c*17 for c in channels]+[255])
        name=f'get-icon-{mode}-{stage}.png';chunk=a['chunk']
        scan=b''.join(b'\0'+rgba[y*1280:(y+1)*1280] for y in range(200))
        png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',320,200,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b'')
        (root/'test/fixtures/roller2'/name).write_bytes(png)
        frames.append(dict(mode=mode,stage=stage,png=name,width=112,height=height,captureSha256=captured_hash,indicesSha256=hashlib.sha256(pixels).hexdigest(),rgbaSha256=hashlib.sha256(rgba).hexdigest()))
(root/'test/fixtures/roller2/get-icon.json').write_text(json.dumps(dict(evidence=__doc__,frames=frames),indent=2)+'\n')
