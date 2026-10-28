#!/usr/bin/env python3
"""Independent screen-coordinate circle spans and literal square/bow images.
No transpiler/runtime imports; portable raster expectations, not native captures.
"""
import math, json, base64, struct
from pathlib import Path
images = [[0]*1024 for _ in range(3)]
def outline(cx, cy, radius):
    points=set()
    for y in range(radius+1):
        x=int(math.sqrt(radius*radius-y*y)+0.5)
        if x<y: break
        for a,b in ((x,y),(y,x),(-y,x),(-x,y),(-x,-y),(-y,-x),(y,-x),(x,-y)):
            points.add((cx+a,cy+b))
    return points
ball=outline(15,15,14)
for y in range(1,30):
    xs=[x for x,yy in ball if yy==y]
    for x in range(min(xs),max(xs)+1): images[0][y*32+x]=2
for x,y in outline(10,10,3): images[0][y*32+x]=1
for y in range(24):
    for x in range(24): images[1][y*32+x]=1 if x in (0,23) or y in (0,23) else 5 if 8<=x<=15 and 8<=y<=15 else 4
for i in range(12):
    for y in (i,23-i):
        for x in range(24-i*2): images[2][y*32+x]=3
# Reuse only the independent word-arithmetic Oracle class, without executing
# that script's fixture-writing section.
exec(Path('tools/random_vectors.py').read_text().split('vectors=[]')[0])
rng=Oracle(0)
particles=[]
for i in range(64):
    x,y=20+rng.rnd(280),20+rng.rnd(130)
    dx,dy=1+rng.rnd(3),1+rng.rnd(3)
    particles.append([x,y,-dx if i&1 else dx,dy])
positions=bytearray()
for frame in range(501):
    for x,y,dx,dy in particles: positions.extend(struct.pack('<HH',x,y))
    for p in particles:
        p[0]+=p[2];p[1]+=p[3]
        if not 0<=p[0]<=319:p[2]=-p[2];p[0]+=p[2]
        if not 0<=p[1]<=199:p[3]=-p[3];p[1]+=p[3]
Path('test/fixtures/bob-test/images.json').write_text(json.dumps({'profile':'portable midpoint circle, solid seed-colour Paint, exclusive Get Bob; zero startup seed/beam', 'images':[base64.b64encode(bytes(i)).decode() for i in images], 'positions':base64.b64encode(positions).decode()},indent=2)+'\n')
