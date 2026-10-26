"""Independent raw-bank AMOS Music decode and register-state trace.
Pinned src/ext/music.cpp and music_play.cpp rules; not an Amiga audio capture.
"""
from pathlib import Path
import struct
import hashlib
import json
from collections import Counter
root=Path(__file__).resolve().parents[2]
def digest(value):return hashlib.sha256(value).hexdigest()
def jsonhash(rows):return digest(json.dumps(rows,separators=(',',':')).encode())
results=[]
for filename in ['Over.mus','Ywon.mus']:
    raw=(root/'examples/Roller2/music'/filename).read_bytes();b=raw[20:]
    assert raw[:4]==b'AmBk' and raw[4:8]==bytes.fromhex('00030000') and raw[12:20]==b'Music   '
    w=lambda at:struct.unpack_from('>H',b,at)[0]
    l=lambda at:struct.unpack_from('>I',b,at)[0]
    ib,sb,pb,_=struct.unpack_from('>4I',b)
    instruments=[]
    for i in range(w(ib)):
        at=ib+2+i*32;start,repeat=ib+l(at),ib+l(at+4);length,rlen,volume,stored=struct.unpack_from('>4H',b,at+8)
        instruments.append(dict(number=i,name=b[at+16:at+32].split(b'\0')[0].decode('latin1'),offset=start,repeatOffset=repeat,length=length*2,repeatLength=rlen*2,storedLength=stored*2,volume=volume,
          pcmSha256=digest(b[start:start+length*2]),repeatSha256=digest(b[repeat:repeat+rlen*2]),storedSha256=digest(b[start:start+stored*2])))
    patterns=[];commands=Counter()
    for p in range(w(pb)):
        streams=[]
        for v in range(4):
            start=pb+w(pb+2+p*8+v*2);words=[]
            while True:
                value=w(start);start+=2;words.append(value)
                if value&0x8000:commands[f'{(value>>8)&127:02x}']+=1
                if value==0x8000:break
            streams.append(words)
        patterns.append(streams)
    song=sb+l(sb+2);orders=[]
    for v in range(4):
        at=song+w(song+v*2);sequence=[]
        while w(at)<0x8000:sequence.append(w(at));at+=2
        assert w(at)==0xfffe
        orders.append(sequence)
    traces={}
    for standard,base in [('PAL',100),('NTSC',120)]:
        voices=[dict(delay=1,order=-1,pc=0,inst=None,period=0,vol=0,gain=0,slide=0,effect=False,loops=0) for _ in range(4)]
        accumulator=base;tempo=17;field=0;notes=[];controls=[]
        while not all(voice['loops'] for voice in voices):
            field+=1;accumulator=(accumulator+tempo)&65535
            if accumulator<base:
                for v,s in enumerate(voices):
                    if s['effect']:
                        if not s['slide']:s['effect']=False
                        else:
                            candidate=(s['period']+s['slide'])&65535
                            s['period']=min(0x358,max(0x71,candidate))
                            if candidate<0x71 or candidate>0x358:s['effect']=False
                    s['gain']=(s['vol']*56)>>6
                    controls.append([field,v,s['period'],s['gain']])
                continue
            accumulator-=base
            for v,s in enumerate(voices):
                if not s['delay']:continue
                s['delay']-=1
                if s['delay']:continue
                for _ in range(4096):
                    if s['order']<0:value=0x8000
                    else:
                        value=patterns[orders[v][s['order']]][v][s['pc']];s['pc']+=1
                    if not value&0x8000:
                        s['period']=value&4095
                        notes.append([field,v,s['inst'],s['period'],s['gain']])
                        continue
                    op,arg=(value>>8)&127,value&255
                    if op==0:
                        s['delay']=0;s['pc']=0;s['effect']=False;s['order']+=1
                        if s['order']==len(orders[v]):s['order']=0;s['loops']+=1
                    elif op==3:s['vol']=min(63,arg)
                    elif op==8:tempo=arg
                    elif op==9:s['inst']=arg;s['vol']=min(63,instruments[arg]['volume'])
                    elif op==14:s['slide']=-arg;s['effect']=True
                    elif op==16:s['delay']=arg;break
                    else:raise AssertionError(op)
                else:raise AssertionError('unbounded stream')
            assert field<50000
        traces[standard]=dict(fields=field,noteCount=len(notes),notesSha256=jsonhash(notes),controlsSha256=jsonhash(controls),controlCount=len(controls),firstNotes=notes[:12],perVoice=[sum(note[1]==v for note in notes) for v in range(4)],lastNotes=notes[-8:])
    results.append(dict(file=filename,byteLength=len(b),sourceSha256=digest(raw),instrumentCount=len(instruments),songName=b[song+12:song+28].split(b'\0')[0].decode(),orders=orders,patternCount=len(patterns),commands=dict(sorted(commands.items())),instruments=instruments,traces=traces))
(root/'test/fixtures/roller2/music.json').write_text(json.dumps(dict(evidence=__doc__,banks=results),indent=2)+'\n')
