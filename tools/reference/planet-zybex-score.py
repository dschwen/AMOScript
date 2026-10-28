"""Independent packed level, literal score text and mixed-raster expectations.
No compiler/runtime imports. Portable pinned font, not native Topaz/captures.
"""
import base64, hashlib, json, math, struct, zlib
from pathlib import Path
root=Path(__file__).resolve().parents[2]
raw=(root/'examples/PlanetZybex/level1_screen.abk').read_bytes()[20:]
width,height=struct.unpack_from('>HH',raw,4)
columns,bands,square,planes=struct.unpack_from('>4H',raw,98)
flag_at=90+struct.unpack_from('>I',raw,106)[0];pointer_at=90+struct.unpack_from('>I',raw,110)[0]
literals=iter(raw[114:pointer_at]); flags=iter(raw[flag_at:]); pointers=raw[pointer_at:flag_at]
last_flag=next(flags);last_byte=next(literals);expanded=[];count=columns*height*planes
for group in range(math.ceil(count/8)):
    if pointers[group//8]&(128>>(group%8)):last_flag=next(flags)
    for bit in range(7,-1,-1):
        if len(expanded)==count:break
        if last_flag&(1<<bit):last_byte=next(literals)
        expanded.append(last_byte)
planar=[bytearray(columns*height) for _ in range(planes)];source=iter(expanded)
for plane in planar:
    for band in range(bands):
        for column in range(columns):
            for dy in range(square):plane[(band*square+dy)*columns+column]=next(source)
palette=struct.unpack_from('>32H',raw,26)
def rgb(code):
    colour=palette[code]
    return bytes([(colour>>8&15)*17,(colour>>4&15)*17,(colour&15)*17,255])
field=bytearray()
for y in range(160):
    for x in range(320):
        code=sum(((planar[p][y*columns+x//8]>>(7-x%8))&1)<<p for p in range(planes))
        field.extend(rgb(code)*2)
glyphs=json.loads((root/'test/fixtures/roller2/panel-glyphs.json').read_text())['glyphs']
folder=root/'test/fixtures/planet-zybex';folder.mkdir(exist_ok=True)
def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
frames=[]
for number,(score,lives) in enumerate([(1234,5),(9876,4)],1):
    indices=bytearray(640*10)
    for column,message in [(2,'Score:'+str(score)),(70,'Lives:'+str(lives))]:
        for pos,char in enumerate(message):
            for y,bits in enumerate(glyphs[char]):
                for x in range(8):indices[y*640+(column+pos)*8+x]=1 if bits&(1<<x) else 0
    rgba=field+bytes([0,0,0,255])*640+b''.join(bytes([255,255,255,255]) if c else bytes([0,0,0,255]) for c in indices)
    scan=b''.join(b'\0'+rgba[y*640*4:(y+1)*640*4] for y in range(171))
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',640,171,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b'')
    name=f'score-{number}.png';(folder/name).write_bytes(png)
    frames.append(dict(score=score,lives=lives,png=name,scoreSha256=hashlib.sha256(indices).hexdigest(),rgbaSha256=hashlib.sha256(rgba).hexdigest()))
(folder/'score.json').write_text(json.dumps(dict(width=640,height=171,origin=[128,50],gapRow=160,scoreRow=161,frames=frames),indent=2)+'\n')
