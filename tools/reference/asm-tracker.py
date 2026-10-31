"""Independent original MOD word/field oracle for ASM's zoom pitch slides.
Direct bytes and native +Music.s mt_portup/down; no JavaScript imports or PCM.
"""
from pathlib import Path
import hashlib,json,struct
root=Path(__file__).resolve().parents[2]
b=(root/'examples/ASM/intro/Zoom.Mus').read_bytes()
assert b[1080:1084]==b'M.K.'
lengths=[struct.unpack_from('>H',b,42+i*30)[0]*2 for i in range(31)]
orders=b[952:952+b[950]]
periods=[0]*4; samples=[0]*4; effects=[0]*4; parameters=[0]*4
order=row=counter=0
trace=bytearray(); triggers=bytearray(); field=0; notes=0
while order<len(orders):
 field+=1;counter+=1
 if counter<6:
  for v in range(4):
   if effects[v]==1:periods[v]=max(113,periods[v]-parameters[v])
   if effects[v]==2:periods[v]=min(856,periods[v]+parameters[v])
 else:
  counter=0; br=False
  for v in range(4):
   at=1084+orders[order]*1024+row*16+v*4
   a,c,d,e=b[at:at+4]; sample=(a&240)|(d>>4); period=((a&15)<<8)|c
   effects[v]=d&15;parameters[v]=e
   assert effects[v] in [0,2,12,13] and (effects[v]!=0 or e==0)
   if sample:samples[v]=sample
   if period:periods[v]=period
   if period and samples[v] and lengths[samples[v]-1]:
    triggers+=struct.pack('>IBBH',field,1<<v,samples[v],period);notes+=1
   if effects[v]==13:br=True
  row+=1
  if row==64 or br:row=0;order+=1
 trace+=struct.pack('>4H',*periods)
assert field<10000
out=dict(evidence='Independent Python direct MOD parsing and native AMOS field/slide recurrence; not an Amiga audio capture',sourceSha256=hashlib.sha256(b).hexdigest(),fields=field,notes=notes,periodTraceSha256=hashlib.sha256(trace).hexdigest(),triggerTraceSha256=hashlib.sha256(triggers).hexdigest())
(root/'test/fixtures/asm-zoom-tracker.json').write_text(json.dumps(out,indent=2)+'\n')
print(out)
