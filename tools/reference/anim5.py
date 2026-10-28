"""Independent ANIM-5 planes, two-frame history and palette oracle.
No production JavaScript, native AMOS run or generated image input.
"""
import hashlib
import json
from pathlib import Path
import struct
root = Path(__file__).resolve().parents[2]
folder = root / 'examples/Introideen'
raw = (folder/'KugelAnim').read_bytes()

def chunks(data, start, end):
    result = {}
    while start < end:
        tag, size = struct.unpack_from('>4sI', data, start)
        assert tag not in result and start+8+size <= end
        result[tag] = data[start+8:start+8+size]
        start += 8+size+(size&1)
    assert start == end
    return result

frames, history, position = [], [], 12
while position < len(raw):
    size = struct.unpack_from('>I', raw, position+4)[0]
    end = position+8+size
    c = chunks(raw, position+12, end)
    if not history:
        width, height = struct.unpack_from('>HH', c[b'BMHD'])
        depth = c[b'BMHD'][8]
        assert (width,height,depth) == (320,200,4)
        palette = [((r>>4)<<8) | ((g>>4)<<4) | (b>>4) for r,g,b in zip(c[b'CMAP'][::3],c[b'CMAP'][1::3],c[b'CMAP'][2::3])]
        planes = [bytearray(8000) for _ in range(4)]
        body, p = c[b'BODY'], 0
        for y in range(height):
            for plane in range(depth):
                row = bytearray()
                while len(row) < 40:
                    op = struct.unpack_from('b',body,p)[0]; p+=1
                    if op >= 0:
                        row += body[p:p+op+1]; p+=op+1
                    elif op != -128:
                        row += bytes([body[p]])*(1-op); p+=1
                assert len(row) == 40
                planes[plane][y*40:(y+1)*40] = row
        assert p == len(body)
    else:
        assert c[b'ANHD'][0] == 5 and c[b'ANHD'][18] == 0
        planes = [bytearray(p) for p in history[max(0,len(history)-2)]]
        delta = c[b'DLTA']
        for plane in range(depth):
            p = struct.unpack_from('>I',delta,plane*4)[0]
            if not p:
                continue
            for x in range(40):
                operations, p = delta[p], p+1
                y = 0
                for _ in range(operations):
                    op, p = delta[p], p+1
                    if 0 < op < 128:
                        y += op
                        continue
                    if op == 0:
                        n, value = delta[p],delta[p+1]; p+=2
                        values = [value]*n
                    else:
                        n = op&127
                        values = delta[p:p+n]; p+=n
                    for value in values:
                        assert y < 200
                        planes[plane][y*40+x] = value; y+=1
    history.append(planes)
    pixels = bytes(sum(((planes[plane][y*40+x//8]>>(7-x%8))&1)<<plane for plane in range(depth)) for y in range(height) for x in range(width))
    rgba = bytes(component for index in pixels for component in [(palette[index]>>8&15)*17,(palette[index]>>4&15)*17,(palette[index]&15)*17,255])
    frames.append(dict(frame=len(frames)+1,offset=position-12,sourceOffset=position,sha256=hashlib.sha256(pixels).hexdigest(),rgbaSha256=hashlib.sha256(rgba).hexdigest()))
    position=end+(end&1)
assert len(frames)==20 and frames[0]['sha256']==frames[18]['sha256'] and frames[1]['sha256']==frames[19]['sha256']
result=dict(evidence='Independent Python ByteRun1/column-plane ANIM-5 extraction with two-frame history; not an Amiga capture.',
            hashes={name:hashlib.sha256((folder/name).read_bytes()).hexdigest() for name in ['KugelAnim','Logoanim.amos','Logoanim.Bak','introroller']},
            width=width,height=height,depth=depth,palette=palette,frames=frames)
(root/'test/fixtures/anim5.json').write_text(json.dumps(result,indent=2)+'\n')
