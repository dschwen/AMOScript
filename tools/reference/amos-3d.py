"""Independent ray/plane oracle for the portable AMOS 3D profile.
Uses original model bytes and transcribed original Anim poses. This is not an
Amiga capture or a claim about native blitter edge/BSP/fixed-point equivalence.
"""
import hashlib, json, math, struct
from pathlib import Path
root = Path(__file__).resolve().parents[2]
assets = root / 'examples/Amos3D'
def payload(name):
    data = (assets / name).read_bytes()
    end = data.index(b')') + 1
    size = int(data[1:end-1])
    return data[end:end+size]
def word(data, at): return struct.unpack_from('>H', data, at)[0]
def long(data, at): return struct.unpack_from('>I', data, at)[0]

def read_model(name):
    data = payload(name + '.3DO')
    blocks, colours, vertices, faces = [word(data, at) for at in (56,58,60,62)]
    template = payload('p8.3DT')
    mesh = []
    for block in range(data[32]):
        points = [struct.unpack_from('>hhh', data, vertices + (block*8 + i)*6) for i in range(8)]
        planes = data[colours+block*2:colours+block*2+2]
        masks = [0 if v==0 else 2**(v-1) for v in planes]
        for face in range(6):
            ids = template[word(template,34)+face*4:word(template,34)+face*4+4]
            variant = template[word(template,32) + 2**face]
            shade = template[word(template,28)+variant*10+9]
            shade = 3 if shade==7 else shade
            colour = 8 | (masks[0] if shade & 1 else 0) | (masks[1] if shade & 2 else 0)
            surface = None
            record = faces + (block*6+face)*16
            # The two external surface references in the supplied hero.
            surface_name = {922:'pq236002',1194:'pq236001'}.get(record) if name=='hero' else None
            if surface_name:
                raw = payload(surface_name+'.3DS'); base=long(raw,18)
                idx=lambda p:(p-base)//10
                at=word(raw,12); steps=[]
                while long(raw,at):
                    steps.append(tuple(idx(long(raw,at+j)) for j in (0,4,8))); at+=12
                at=word(raw,16); contours=[]; contour=[]
                while True:
                    pointer=long(raw,at); flags=word(raw,at+4);at+=6
                    if pointer:
                        contour.append(idx(pointer))
                        if not flags:contours.append(contour);break
                    else:contours.append(contour);contour=[]
                surface=([word(data,record+4+j*2)//32 for j in range(4)],steps,contours)
            mesh.append(dict(points=points,ids=list(ids),colour=colour,toggle=masks[0],surface=surface))
    return mesh

def dot(a,b):return sum(x*y for x,y in zip(a,b))
def sub(a,b):return [x-y for x,y in zip(a,b)]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def rotate(v,angles):
    # Independent successive rotations rather than the runtime matrix product.
    a,b,c=[n*math.pi/32768 for n in angles]
    x,y,z=v
    y,z=math.cos(a)*y-math.sin(a)*z,math.sin(a)*y+math.cos(a)*z
    x,z=math.cos(b)*x+math.sin(b)*z,-math.sin(b)*x+math.cos(b)*z
    x,y=math.cos(c)*x-math.sin(c)*y,math.sin(c)*x+math.cos(c)*y
    return [x,y,z]
def inside(points,x,y):
    hits=0
    for a,b in zip(points,points[1:]+points[:1]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:hits+=1
    return hits%2

def frame(name,position,angles):
    pixels=bytearray(64000); nearest=[float('inf')]*64000
    for face in read_model(name):
        vertices=[[v[i]+position[i] for i in range(3)] for v in [rotate(p,angles) for p in face['points']]]
        quad=[vertices[i] for i in face['ids']]
        assert min(p[2] for p in quad)>16
        project=lambda v:[160+256*v[0]/v[2],100-256*v[1]/v[2]]
        polygon=[project(v) for v in quad]
        contours=[]
        if face['surface']:
            anchors,steps,paths=face['surface'];points={i+1:project(vertices[j]) for i,j in enumerate(anchors)}
            for dest,a,b in steps:points[dest]=[(points[a][i]+points[b][i])/2 for i in (0,1)]
            contours=[[points[i] for i in path] for path in paths]
        for tri_indices in [(0,1,2),(0,2,3)]:
            triangle=[quad[i] for i in tri_indices];outline=[project(v) for v in triangle]
            normal=cross(sub(triangle[1],triangle[0]),sub(triangle[2],triangle[0]));numerator=dot(normal,triangle[0])
            for y in range(max(0,math.ceil(min(p[1] for p in outline)-.5)),min(199,math.floor(max(p[1] for p in outline)-.5))+1):
                for x in range(max(0,math.ceil(min(p[0] for p in outline)-.5)),min(319,math.floor(max(p[0] for p in outline)-.5))+1):
                    if not inside(outline,x+.5,y+.5):continue
                    denominator=dot(normal,[(x+.5-160)/256,(100-y-.5)/256,1])
                    if abs(denominator)<1e-8:continue
                    z=numerator/denominator;at=y*320+x
                    if z>=nearest[at]-1e-6:continue
                    nearest[at]=z;colour=face['colour']
                    for contour in contours:
                        if inside(contour,x+.5,y+.5):colour^=face['toggle']
                    pixels[at]=colour
    return pixels

poses=[(1,'auto',[350,70,3400],[16000,0,7000]),(20,'auto',[244,70,2680],[12400,2700,4120]),(65,'auto',[-17,70,880],[3400,9450,62456]),(66,'auto',[-17,70,880],[3250,9563,62336]),(80,'auto',[-17,70,880],[3250,13063,62336]),(104,'hero',[-22,70,2850],[3250,64536,62336])]
frames=[]
for number,name,position,angles in poses:
    pixels=frame(name,position,angles)
    frames.append(dict(frame=number,name=name,position=position,angles=angles,sha256=hashlib.sha256(pixels).hexdigest(),counts={str(i):pixels.count(i) for i in range(16) if pixels.count(i)}))
(root/'test/fixtures/amos-3d.json').write_text(json.dumps(dict(description=__doc__,frames=frames),indent=2)+'\n')
