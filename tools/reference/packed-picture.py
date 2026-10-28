"""Independent AMOS packed-screen oracle for Planet Zybex.
Expand pointer bits into flag bytes, then flag bits into byte runs, before
mapping the square-column traversal back to planar/indexed pixels.
No production compiler/runtime imports or rendered-image inputs.
"""
import hashlib, json, struct
from pathlib import Path
root = Path(__file__).resolve().parents[2]
folder = root/'examples/PlanetZybex'
records = []
for level in range(1,8):
    name=f'level{level}_screen.abk'; file=(folder/name).read_bytes()
    assert file[:4]==b'AmBk' and file[12:20]==b'Pac.Pic.'
    raw=file[20:]; assert raw[:4]==bytes.fromhex('12031990') and raw[90:94]==bytes.fromhex('06071963')
    width,height=struct.unpack_from('>HH',raw,4); depth=struct.unpack_from('>H',raw,24)[0]
    columns,bands,square,planes=struct.unpack_from('>4H',raw,98)
    assert width==columns*8 and height==bands*square and planes==depth==4
    flag_at=90+struct.unpack_from('>I',raw,106)[0]; pointer_at=90+struct.unpack_from('>I',raw,110)[0]
    literals=iter(raw[114:pointer_at]); compressed_flags=iter(raw[flag_at:]); pointer_bytes=raw[pointer_at:flag_at]
    pointer_bits=[(byte>>bit)&1 for byte in pointer_bytes for bit in range(7,-1,-1)]
    last_flag=next(compressed_flags); last_byte=next(literals); expanded=[]
    count=columns*height*planes
    for group in range((count+7)//8):
        if pointer_bits[group]: last_flag=next(compressed_flags)
        for bit in range(7,-1,-1):
            if len(expanded)==count: break
            if last_flag&(1<<bit): last_byte=next(literals)
            expanded.append(last_byte)
    planar=[bytearray(columns*height) for _ in range(planes)]; source=iter(expanded)
    for plane in planar:
        for band in range(bands):
            for column in range(columns):
                for dy in range(square): plane[(band*square+dy)*columns+column]=next(source)
    pixels=bytes(sum(((planar[p][y*columns+x//8]>>(7-x%8))&1)<<p for p in range(planes)) for y in range(height) for x in range(width))
    palette=list(struct.unpack_from('>32H',raw,26))
    def rgba(code):
        value=palette[code]
        return bytes([(value>>8&15)*17,(value>>4&15)*17,(value&15)*17,255])
    offsets=[(offset,0) for offset in [0,1,127,320,640]] if width>320 else [(0,offset) for offset in [0,1,127,320,480]]
    windows=[]
    for x0,y0 in offsets:
        window=b''.join(rgba(pixels[(y0+y)*width+x0+x]) for y in range(160) for x in range(320))
        windows.append(dict(x=x0,y=y0,sha256=hashlib.sha256(window).hexdigest()))
    records.append(dict(level=level,file=name,byteLength=len(file),sourceSha256=hashlib.sha256(file).hexdigest(),width=width,height=height,depth=depth,
        palette=palette,indexedSha256=hashlib.sha256(pixels).hexdigest(),rgbaSha256=hashlib.sha256(b''.join(map(rgba,pixels))).hexdigest(),windows=windows))
fixture=dict(programSha256=hashlib.sha256((folder/'Zybex.AMOS').read_bytes()).hexdigest(),levels=records)
(root/'test/fixtures/packed-picture.json').write_text(json.dumps(fixture,indent=2)+'\n')
manifest=dict(source=dict(path='Zybex.AMOS',byteLength=len((folder/'Zybex.AMOS').read_bytes()),sha256=fixture['programSha256']),
    files={record['file']:dict(path=record['file'],byteLength=record['byteLength'],sha256=record['sourceSha256']) for record in records})
(folder/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
