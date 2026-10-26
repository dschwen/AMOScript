"""Independent integer/Fraction transcription of Music Shout/EnvBoom/noise.
Pinned source efddf2c9a09bf61a45b7b096a9be84630853c2b1; no JS imports.
Portable beam/fetch/resampling choices, not an Amiga execution capture.
"""
import struct
import hashlib
import json
from fractions import Fraction
from pathlib import Path
root=Path(__file__).resolve().parents[2]
out=root/'test/fixtures/audio'
out.mkdir(exist_ok=True)
volumes=[0]
fixed=0
for steps,goal in [(1,64),(10,50),(50,0)]:
    numerator=((56*goal//64)-(fixed//65536))*256
    delta=(abs(numerator)//steps)*(-1 if numerator<0 else 1)*256
    for i in range(steps):
        fixed+=delta
        volumes.append(fixed//65536)
    fixed=fixed//65536*65536
cases=[]
for name,clock,hz,seed,beam,phase in [('pal',3546895,50,0,257,Fraction(0)),('phase',3546895,50,48879,4660,Fraction(13,20)),('ntsc',3579545,60,0,257,Fraction(0))]:
    wave=bytearray(510)
    def word():
        global seed
        seed=(((seed+beam)%65536)*12657//256)%65536
        return seed
    for offset in range(0,510,2):struct.pack_into('>H',wave,offset,word())
    initial_seed=seed
    snapshots=[bytes(wave)]
    pointer=0
    for field in range(1,65):
        for i in range(8):
            struct.pack_into('>H',wave,pointer,word())
            pointer=(pointer-2)%510
        snapshots.append(bytes(wave))
    voices=[]
    for voice,note in [(3,247),(2,262),(1,277),(0,294)]:
        frequency=2000*note//440
        period=clock//frequency
        duration=Fraction(510*period,clock)
        count=-(-(duration*44100).numerator//(duration*44100).denominator)
        samples=[]
        for at in range(count):
            elapsed=Fraction(at,44100)
            field=int(phase+elapsed*hz)
            position=int(elapsed*clock/period)
            value=snapshots[field][min(509,position)]
            if value>=128:value-=256
            volume=56 if field==0 else volumes[field]
            samples.append(value*volume/8192)
        pcm=b''.join(struct.pack('<f',value) for value in samples)
        filename='boom-'+str(voice)+'.f32'
        if name=='pal':(out/filename).write_bytes(pcm)
        voices.append(dict(voice=voice,mask=1<<voice,frequency=frequency,period=period,length=count,sha256=hashlib.sha256(pcm).hexdigest(),file=filename if name=='pal' else None))
    cases.append(dict(name=name,clock=clock,hz=hz,seed=0 if name!='phase' else 48879,beam=beam,phase=float(phase),initialSeed=initial_seed,initialWaveSha256=hashlib.sha256(snapshots[0]).hexdigest(),field1WaveSha256=hashlib.sha256(snapshots[1]).hexdigest(),field60WaveSha256=hashlib.sha256(snapshots[60]).hexdigest(),voices=voices))
(out/'boom.json').write_text(json.dumps(dict(evidence=__doc__,volumes=volumes,cases=cases),indent=2)+'\n')
