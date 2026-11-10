#!/usr/bin/env python3
"""Native W.s AniStos/StAni: independent cumulative frame-duration vectors."""
import hashlib,json,pathlib
root=pathlib.Path(__file__).resolve().parents[2]
raw=(root/'examples/AMCAF/AMCAF_Examples/Protracker.AMOS').read_bytes()
specs=[('hithihat',0,1,[(1,1),(2,1),(1,1),(3,1),(1,2),(2,2),(1,3),(3,3),(1,1)]),('openhihat',0,1,[(4,3),(5,3),(1,1)]),('hitbass',1,11,[(12,3),(13,3),(14,3),(11,3)]),('hitsnare',1,11,[(15,3),(16,3),(17,3),(11,3)]),('hitboth',1,11,[(18,3),(19,3),(20,3),(11,3)]),('clap',2,6,[(7,1),(8,1),(9,1),(10,1),(6,1)])]
cases=[]
for name,channel,initial,frames in specs:
    source=''.join(f'({image},{duration})' for image,duration in frames)
    assert source.encode() in raw
    ends=[];total=0
    for _,duration in frames: total+=duration;ends.append(total)
    values=[initial]+[next((frames[i][0] for i,end in enumerate(ends) if field<=end),frames[-1][0]) for field in range(1,total+3)]
    cases.append(dict(name=name,channel=channel,initial=initial,source=source,images=values,endField=total+1))
(root/'test/fixtures/amcaf/anim.json').write_text(json.dumps(dict(evidence='Independent cumulative intervals transcribed from W.s AniStos/StAni; original drum literals, not Amiga captures.',sourceSha256=hashlib.sha256(raw).hexdigest(),cases=cases),indent=2)+'\n')
