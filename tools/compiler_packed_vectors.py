#!/usr/bin/env python3
"""Independent GALAX SPack byte/block expansion and planar pixel oracle.
No production decoder imports. Screen requests are retained, not applied here.
"""
from pathlib import Path
import struct, hashlib, json
root=Path(__file__).resolve().parent.parent
entries=[]
for name in ['PicPres','PicMenu','PicAst1','PicAst2','Puzzle']:
    source=root/'examples/CompilerExamples/Galax'/f'{name}.Abk'
    raw=source.read_bytes(); assert raw[:4]==b'AmBk'
    data=raw[20:]
    w=lambda at:struct.unpack_from('>H',data,at)[0]
    l=lambda at:struct.unpack_from('>I',data,at)[0]
    width,height,depth=w(4),w(6),w(24)
    assert l(0)==0x12031990 and l(90)==0x06071963
    row_bytes, bands, square=w(98),w(100),w(102)
    assert row_bytes*8==width and bands*square==height and w(104)==depth
    selectors=data[90+l(110):90+l(106)]
    masks=iter(data[90+l(106):]); literals=iter(data[114:90+l(110)])
    mask=next(masks); value=next(literals)
    count=row_bytes*height*depth
    expanded=[]
    for block in range((count+7)//8):
        if selectors[block//8] & (128>>(block%8)):mask=next(masks)
        for bit in range(min(8,count-len(expanded))):
            if mask & (128>>bit):value=next(literals)
            expanded.append(value)
    pixels=bytearray(width*height)
    for i,byte in enumerate(expanded):
        plane, rest=divmod(i,row_bytes*height)
        band, rest=divmod(rest,row_bytes*square)
        column, row=divmod(rest,square)
        y=band*square+row
        for bit in range(8):
            if byte & (128>>bit):pixels[y*width+column*8+bit] |= 1<<plane
    output=f'{name}.indices'
    (root/'test/fixtures/compiler-examples'/output).write_bytes(pixels)
    entries.append(dict(name=name,sourceSha256=hashlib.sha256(raw).hexdigest(),width=width,height=height,depth=depth,control=w(20),
        window=dict(zip(['x','y','width','height','offsetX','offsetY'],[w(i) for i in range(8,20,2)])),
        palette=[w(i) for i in range(26,90,2)],indexedSha256=hashlib.sha256(pixels).hexdigest(),file=output))
(root/'test/fixtures/compiler-examples/galax-packed.json').write_text(json.dumps(dict(evidence='independent Python block expansion; no native capture',images=entries),indent=2)+'\n')
