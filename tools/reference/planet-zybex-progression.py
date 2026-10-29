"""Independent raw-map raster strips for the frozen input-only docking route.
Checkpoints describe the replay; pixel bytes come only from supplied ABK files.
"""
import hashlib,json,struct
from pathlib import Path
root=Path(__file__).resolve().parents[2];folder=root/'test/fixtures/planet-zybex'
def decode(level):
    raw=(root/f'examples/PlanetZybex/level{level}_screen.abk').read_bytes()[20:]
    width,height=struct.unpack_from('>HH',raw,4);cols,bands,square,depth=struct.unpack_from('>4H',raw,98)
    fa=90+struct.unpack_from('>I',raw,106)[0];pa=90+struct.unpack_from('>I',raw,110)[0]
    literals=iter(raw[114:pa]);flags=iter(raw[fa:]);pointers=[(b>>n)&1 for b in raw[pa:fa]for n in range(7,-1,-1)]
    flag=next(flags);byte=next(literals);expanded=[];size=cols*height*depth
    for group in range((size+7)//8):
        if pointers[group]:flag=next(flags)
        for bit in range(7,-1,-1):
            if len(expanded)==size:break
            if flag&(1<<bit):byte=next(literals)
            expanded.append(byte)
    planes=[bytearray(cols*height)for _ in range(depth)];stream=iter(expanded)
    for plane in planes:
        for band in range(bands):
            for col in range(cols):
                for y in range(square):plane[(band*square+y)*cols+col]=next(stream)
    pixels=bytes(sum(((planes[p][y*cols+x//8]>>(7-x%8))&1)<<p for p in range(depth))for y in range(height)for x in range(width))
    return width,pixels,struct.unpack_from('>32H',raw,26)
worlds={n:decode(n)for n in [1,2]};records=[]
checkpoints=[('Departure',1,0,0,[176,129,3]),('Enemy corridor',300,0,80,[176,134,2]),('Dock approach',600,0,450,[336,149,2]),('Scroll limit',640,0,460,[336,134,2]),('Dock reached',701,0,470,[336,174,3]),('Dock hold',702,0,470,[336,174,3]),('Dock image 20',703,0,470,[336,174,20]),('Dock image 21',704,0,470,[336,174,21]),('Dock image 22',705,0,470,[336,174,22]),('Vertical entry',706,1,470,[336,174,22]),('Vertical up',711,6,470,[336,169,23]),('Vertical left',716,11,470,[331,149,22]),('Vertical hold',721,16,470,[311,149,23]),('Vertical scroll',730,25,470,[311,149,22])]
for name,frame,vertical,score,sprite in checkpoints:
    level=2 if vertical else 1;width,pixels,palette=worlds[level]
    sx=0 if vertical else min(frame-1,640);sy=vertical-1 if vertical else 0
    w,h=(640,32)if vertical else (64,16)
    data=bytearray()
    for y in range(h):
        for x in range(w//2):
            c=palette[pixels[(sy+y)*width+sx+x]];data.extend(bytes([(c>>8&15)*17,(c>>4&15)*17,(c&15)*17,255])*2)
    records.append(dict(name=name,level=level,frame=frame,vertical=vertical,score=score,sprite=sprite,regions=[dict(x=0,y=0,width=w,height=h,sha256=hashlib.sha256(data).hexdigest())]))
source=(root/'examples/PlanetZybex/Zybex.AMOS').read_bytes()
(folder/'progression.json').write_text(json.dumps(dict(sourceSha256=hashlib.sha256(source).hexdigest(),frames=records),indent=2)+'\n')
