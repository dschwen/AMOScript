import json
class Oracle:
 def __init__(self,seed): self.seed=seed&0xffffffff;self.last=0;self.draws=0
 def rnd(self,n,beam=0):
  if not n:return self.last
  maximum=abs(n);mask=(1<<min(24,maximum.bit_length()))-1
  while True:
   a=self.seed;b=0xbb40e62d
   swap=lambda v:((v&65535)<<16)|((v>>16)&65535)
   self.seed=((a&65535)*(b&65535)+swap((a>>16)*(b&65535))+swap((a&65535)*(b>>16))+1)&0xffffffff;self.draws+=1
   v=self.seed>>8
   if n>0:v=(v&0xff0000)|((v+beam)&65535)
   v&=mask
   if v<=maximum:self.last=v;return v
vectors=[]
for seed,bounds,beam in [(0,[-6,-10,-6,-10,0,-1,-16777215,-2147483648],0),(12345,[-6,-10,-2,-50,-1000,-16777216,0],0),(-1,[6,10,2,50,0,16777215],65535),(0,[2]*12,0),(-1,[16777215],65535)]:
 o=Oracle(seed);values=[o.rnd(n,beam)for n in bounds];vectors.append({'seed':seed,'bounds':bounds,'beam':beam,'values':values,'finalSeed':o.seed,'draws':o.draws})
enemies=[]
for kind in ['blob','green','green-right']:
 for seed in [0,12345,-1]:
  for beam in [0,65535]:
   o=Oracle(seed);rows=[]
   for i in range(12):
    if kind=='blob': rows.append([o.rnd(6,beam)-3,-6-o.rnd(10,beam),7,288])
    if kind!='blob':
     vy=max(-16,-4-o.rnd(16,beam));vx=(o.rnd(2,beam)+1)*(1 if kind=='green-right' else -1);rows.append([vx,vy,2,288])
   enemies.append({'kind':kind,'seed':seed,'beam':beam,'rows':rows,'finalSeed':o.seed})
open('test/fixtures/random-vectors.json','w').write(json.dumps({'evidence':'Source-analysis expectations generated independently with Python arbitrary-precision word arithmetic; not production encoder/runtime output or Amiga execution.','vectors':vectors,'enemies':enemies},indent=2)+'\n')
print(f'Wrote {len(vectors)} RNG vectors and {len(enemies)} enemy streams.')
