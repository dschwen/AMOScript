#!/usr/bin/env python3
"""Independent closed-form line points and suffix-parity exclusive fills.
From AMCAF R15a/b and R048..04b plus Commodore blitter equations.
No production JS imports, hardware emulation or Amiga captures.
"""
import json

def points(x1,y1,x2,y2):
    if y2<=y1:x1,x2,y1,y2=x2,x1,y2,y1
    dx,dy=abs(x2-x1),y2-y1
    major,minor=max(dx,dy),min(dx,dy)
    sx=1 if x2>=x1 else -1
    return [(x1+(sx*t if dx>=dy else sx*((2*minor*t+major)//(2*major) if major else 0)),
             y1+(((2*minor*t+major)//(2*major) if major else 0) if dx>=dy else t)) for t in range(major+1)]
def draw(a,line,colour,mask,pattern=65535,single=False):
    seen=set()
    for step,(x,y) in enumerate(points(*line)):
        if single:
            if y in seen or step==0:seen.add(y);continue
            seen.add(y);a[y][x]^=mask
        else:a[y][x]=(a[y][x]&~mask)|((colour&mask) if pattern&(32768>>(step%16)) else 0)
def rows(a):return [''.join(format(v,'x') for v in row) for row in a]
def hex_string(value,width):
    skip=width if width<0 else 8-width;started=False;out='$';bits=value&0xffffffff
    for pos in range(7,-1,-1):
        digit=(bits>>(pos*4))&15
        if skip>0:skip-=1;continue
        if skip<0 and not started and pos and not digit:continue
        started=True;out+='0123456789ABCDEF'[digit]
    return out
if __name__=='__main__':
    base=[[4]*64 for _ in range(64)];normal=[r[:] for r in base]
    commands=[([4,4,28,12],3,7,65535),([4,28,28,20],1,1,65535),([20,4,20,28],0,2,65535),([6,32,26,32],3,3,0xa55a)]
    for line,c,m,p in commands:draw(normal,line,c,m,p)
    normal[31][31]=7
    edges=[r[:] for r in base]
    for line in [[12,40,8,60],[13,40,19,60],[35,35,33,60],[36,35,40,60]]:draw(edges,line,1,1,single=True)
    filled=[r[:] for r in edges]
    for y in range(32,64):
        for x in range(64):filled[y][x]=(filled[y][x]&~1)|(sum(v&1 for v in edges[y][x:64])%2)
    frames=[dict(logical=rows(normal),physical=rows(base)),dict(logical=rows(base),physical=rows(normal)),dict(logical=rows(edges),physical=rows(normal)),dict(logical=rows(normal),physical=rows(filled))]
    ends=[(29,22),(22,29),(10,29),(3,22),(3,10),(10,3),(22,3),(29,10),(30,16),(16,30),(16,16)]
    lines=[]
    for x,y in ends:
        for coords in [(16,16,x,y),(x,y,16,16)]:lines.append([list(coords),points(*coords)])
    # Original Protracker2 first twelve VBLs. The only sounding cell is
    # channel 2, instrument 4: raw periods 428/320, native fine-2 words 422/316.
    # Literal source table words avoid importing the JS pitch/query engine.
    histogram=[[0]*32 for _ in range(4)];original=[]
    for field in range(13):
        if field>=6:
            period=422 if field<10 else 316
            bucket=max(0,min(31,(3546895//period-5000)//800))
            for f,boost in [(bucket,16),(bucket-1,4),(bucket+1,4)]:
                if 0<=f<32:histogram[2][f]=min(32,histogram[2][f]+boost)
        image=[[0]*320 for _ in range(160)]
        for voice in range(4):
            for f,h in enumerate(histogram[voice]):
                if h:
                    draw(image,[f*8+35,32-h+voice*40,f*8+32,32+voice*40],1,1,single=True)
                    draw(image,[f*8+36,32-h+voice*40,f*8+39,32+voice*40],1,1,single=True)
                histogram[voice][f]=max(h-2,0)
            image[34+voice*40][287]=1
        bars=[]
        for y in range(160):bars.append(''.join(str(sum(image[y][x:288])%2) for x in range(32,288)))
        if field in [0,6,9,12]:original.append(dict(field=field,rows=bars))
    print(json.dumps(dict(evidence='Independent rational line positions, suffix parity and native hex digit-loop transcription; not native capture.',frames=frames,lines=lines,protracker2=original,
        hex=[[v,w,hex_string(v,w)] for v in [0,1,10,255,256,0x12345678,2147483647,-1,-2147483648] for w in [-2147483648,-1,0,1,2,7,8,9,2147483647]]),indent=2))
