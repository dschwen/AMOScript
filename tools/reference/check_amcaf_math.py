#!/usr/bin/env python3
"""Independent integer transcription of AMCAF R10f/R111/R112/R113.
Uses recovered literal tables, never imports production JS; not an Amiga capture.
"""
import json
from pathlib import Path
TABLES = json.loads((Path(__file__).parent/'amcaf-v1.50beta4/tables.json').read_text())
def word(v): return ((v+32768)&65535)-32768
def sine(a,r):
    p=TABLES['sineWords'][a&1023]*word(r)
    return word((p//256)+((p>>7)&1))
def root(v):
    shift=0
    while v>=65536: v//=4;shift+=1
    if not v:return 0
    g=v
    while True:
        n=(g+v//g+1)//2
        if n==g:return n*(1<<shift)
        g=n
def arc(x,y):
    if not x and not y:return 0
    ax,ay=abs(x),abs(y)
    angle=TABLES['arcRatioBytes'][(ay*512)//ax] if ax>=ay else 256-TABLES['arcRatioBytes'][(ax*512)//ay]
    if x<0:angle=angle-512 if y<0 else 512-angle
    elif y<0:angle=-angle
    return angle&1023
if __name__=='__main__':
    angles=[-2049,-1024,-513,-256,-1,0,1,127,255,256,511,512,513,768,1023,1024,65535,65536]
    radii=[-32768,-1000,-32,-1,0,1,32,32767,65536]
    deltas=[-32768,-300,-160,-1,0,1,160,300,32767]
    values=[0,1,2,3,4,8,9,15,16,17,65534,65535,65536,65537,262143,262144,2147483647]
    print(json.dumps({'evidence':'Recovered table bytes and independent integer transcript; not native execution.',
        'trig':[[a,r,sine(a,r),sine(a+256,r)] for a in angles for r in radii],
        'sqrt':[[v,root(v)] for v in values], 'arc':[[x,y,arc(x,y)] for x in deltas for y in deltas]},indent=2))
