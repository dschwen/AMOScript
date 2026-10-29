"""Independent native 8.8 MOVE slope traces and original Bob-21 composites.
Decodes raw assets; imports no production JS and never uses rendered frames.
"""
import hashlib,json,struct,zlib
from pathlib import Path
root=Path(__file__).resolve().parents[2];folder=root/'examples/PlanetZybex'
sha=lambda b:hashlib.sha256(b).hexdigest()
word=lambda n:(n+32768)%65536-32768
vectors=[]
for dx,dy,steps in [(0,161,12),(10,-10,3),(-1,1,3),(32767,-32768,1),(7,9,0),(300,-300,2)]:
    count=max(1,word(steps))
    def delta(n):
        q=abs(n)*256//count
        return 0 if q>65535 else word(q if n>=0 else -q)*256
    x=y=0;fx=fy=32768;positions=[]
    for _ in range(count):
        ax=(x%65536)*65536+fx+delta(dx);ay=(y%65536)*65536+fy+delta(dy)
        x=word(ax//65536);y=word(ay//65536);fx=ax%65536;fy=ay%65536
        positions.append([x,y])
    vectors.append(dict(dx=dx,dy=dy,steps=steps,positions=positions))
# Independent packed-screen pointer/flag expansion and plane reconstruction.
raw=(folder/'level1_screen.abk').read_bytes()[20:];width,height=struct.unpack_from('>HH',raw,4)
columns,bands,square,depth=struct.unpack_from('>4H',raw,98)
fa=90+struct.unpack_from('>I',raw,106)[0];pa=90+struct.unpack_from('>I',raw,110)[0]
literals=iter(raw[114:pa]);flags=iter(raw[fa:]);bits=[(b>>n)&1 for b in raw[pa:fa] for n in range(7,-1,-1)]
flag=next(flags);byte=next(literals);expanded=[];size=columns*height*depth
for group in range((size+7)//8):
    if bits[group]:flag=next(flags)
    for bit in range(7,-1,-1):
        if len(expanded)==size:break
        if flag&(1<<bit):byte=next(literals)
        expanded.append(byte)
planes=[bytearray(columns*height)for _ in range(depth)];stream=iter(expanded)
for plane in planes:
    for band in range(bands):
        for column in range(columns):
            for y in range(square):plane[(band*square+y)*columns+column]=next(stream)
background=bytes(sum(((planes[p][y*columns+x//8]>>(7-x%8))&1)<<p for p in range(depth))for y in range(height)for x in range(width))
assert sha(background)==json.loads((root/'test/fixtures/packed-picture.json').read_text())['levels'][0]['indexedSha256']
palette=struct.unpack_from('>32H',raw,26)
program=(folder/'Zybex.AMOS').read_bytes();at=20+struct.unpack_from('>I',program,16)[0]
assert program[at:at+4]==b'AmBs' and program[at+6:at+10]==b'AmSp';at+=10
images=struct.unpack_from('>H',program,at)[0];at+=2
decoded={}
for image in range(1,images+1):
    words,h,planes,hx,hy=struct.unpack_from('>5H',program,at);at+=10
    count=words*2*h;data=program[at:at+count*planes];at+=count*planes
    pic=bytes(sum(((data[p*count+y*words*2+x//8]>>(7-x%8))&1)<<p for p in range(planes))for y in range(h)for x in range(words*16))
    decoded[image]=(words*16,h,(hx&16383)-16384 if hx&8192 else hx&16383,word(hy),pic)
    if image==27:
        iw=words*16;ih=h;hotx=(hx&16383)-16384 if hx&8192 else hx&16383;hoty=word(hy)
        icon=bytes(sum(((data[p*count+y*words*2+x//8]>>(7-x%8))&1)<<p for p in range(planes))for y in range(h)for x in range(iw))
assert (iw,ih,hotx,hoty)==(16,16,0,0)
frames=[];out=root/'test/fixtures/planet-zybex'
def chunk(k,d):return struct.pack('>I',len(d))+k+d+struct.pack('>I',zlib.crc32(k+d)&0xffffffff)
for frame,y in enumerate([0]+[p[1]for p in vectors[0]['positions']]+[161]):
    pixels=bytearray(background)
    for row in range(ih):
        for col in range(iw):
            colour=icon[row*iw+col];xx=146+col-hotx;yy=y+row-hoty
            if colour and 0<=xx<width and 0<=yy<height:pixels[yy*width+xx]=colour
    rgba=bytearray()
    for yy in range(160):
        for xx in range(320):
            c=palette[pixels[yy*width+xx]];rgba.extend([(c>>8&15)*17,(c>>4&15)*17,(c&15)*17,255])
    record=dict(frame=frame,x=146,y=y,remaining=0 if frame in (0,13) else 13-frame,ended=frame==13,indicesSha256=sha(pixels),rgbaSha256=sha(rgba))
    if frame in (0,1,6,12,13):
        name=f'amal-drop-{frame}.png';record['png']=name
        scan=b''.join(b'\0'+rgba[yy*1280:(yy+1)*1280]for yy in range(160))
        (out/name).write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',320,160,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b''))
    frames.append(record)
(out/'amal-drop.json').write_text(json.dumps(dict(vectors=vectors,frames=frames,imageSha256=sha(icon),sourceSha256=sha(program)),indent=2)+'\n')

# Independent channel-20 state machine: generator suspension points represent
# Pause and repeating Next, not a translation of the production AMAL IR.
missiles=[]
for with_bullet in (False,True):
    st=dict(x=243,y=145,r0=0,r1=0,score=0,remaining=0,autotest=False)
    def delay():
        bound=st['r1'];st['r0']=1
        while True:
            yield # first P
            yield # second P
            st['r0']=word(st['r0']+1)
            if st['r0']>bound:break
            yield # repeating Next yields; last Next falls through
    def flight():
        while True:
            st['autotest']=True;st['x']=243;st['y']=145
            for step in range(1,25):
                st['y']-=6;st['remaining']=25-step
                yield
            st['remaining']=0;st['r1']=5
            yield from delay()
    def finish():
        st['x']=243;st['y']=145;st['remaining']=0;st['r1']=20;st['score']+=10
        yield from delay()
        yield from flight()
    def collision():
        if not with_bullet:return False
        aw,ah,ax,ay,ap=decoded[16];bw,bh,bx,by,bp=decoded[25]
        for yy in range(max(st['y']-ay,91-by),min(st['y']-ay+ah,91-by+bh)):
            for xx in range(max(243-ax,243-bx),min(243-ax+aw,243-bx+bw)):
                if ap[(yy-st['y']+ay)*aw+xx-243+ax] and bp[(yy-91+by)*bw+xx-243+bx]:return True
        return False
    body=flight();records=[]
    for frame in range(81):
        hit=frame>0 and st['autotest'] and collision()
        if frame:
            if hit:body=finish()
            next(body)
        pixels=bytearray(background)
        objects=([(1,243,91,25)]if with_bullet else [])+[(20,st['x'],st['y'],16),(30,240,0,14),(31,240,144,15)]
        for _,x,y,index in objects:
            iw,ih,hx,hy,image=decoded[index]
            for row in range(ih):
                for col in range(iw):
                    colour=image[row*iw+col];xx=x+col-hx;yy=y+row-hy
                    if colour and 0<=xx<width and 0<=yy<height:pixels[yy*width+xx]=colour
        rgba=bytearray()
        for yy in range(160):
            for xx in range(320):
                c=palette[pixels[yy*width+xx]];rgba.extend([(c>>8&15)*17,(c>>4&15)*17,(c&15)*17,255])
        record=dict(frame=frame,**st,collision=bool(hit),indicesSha256=sha(pixels),rgbaSha256=sha(rgba))
        if frame in (0,5,6,39,70):
            name=f'amal-missile-{int(with_bullet)}-{frame}.png';record['png']=name
            scan=b''.join(b'\0'+rgba[yy*1280:(yy+1)*1280]for yy in range(160))
            (out/name).write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',320,160,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b''))
        records.append(record)
    assert [r['frame']for r in records if r['collision']]==([6,70]if with_bullet else [])
    missiles.append(dict(bullet=with_bullet,frames=records))
(out/'amal-missile.json').write_text(json.dumps(dict(cases=missiles,sourceSha256=sha(program)),indent=2)+'\n')

# AMAL Z: unsigned MULU, two low-word additions with discarded carries, then
# a logical long shift and a signed-word mask. It is separate from Basic Rnd.
def z_draw(seed,mask,beam):
    product=seed*0x3171
    low=((product%65536)+beam+1)%65536
    mixed=(product//65536)*65536+low
    return low,word((mixed//256)&(mask%65536))
z_vectors=[]
masks=[0,-1,1,2,10,103,104,105,255,32767,-32768,-1,0]*4
for beams in ([0]*len(masks),[65535]*len(masks),[(i*7919)%65536 for i in range(len(masks))]):
    seed=0x1234;draws=[]
    for mask,beam in zip(masks,beams):
        seed,result=z_draw(seed,mask,beam);draws.append(dict(mask=mask,beam=beam,seed=seed,value=result))
    z_vectors.append(draws)
(out/'amal-random-vectors.json').write_text(json.dumps(dict(vectors=z_vectors),indent=2)+'\n')

hunters=[]
for beam in (0,65535):
    rng=dict(seed=0x1234,calls=0);score=[0]
    states=[dict(number=n,x=580,y=116,remaining=0,autotest=False,locals=[0]*10)for n in (23,24,25)]
    def random(mask):
        rng['seed'],value=z_draw(rng['seed'],mask,beam);rng['calls']+=1
        return value
    def hunter(st):
        while True:
            st['x']=580;st['y']=116;st['locals'][2]=random(80+st['number'])
            if st['locals'][2]>0:
                yield 'jump'
                continue
            st['autotest']=True;st['locals'][0]=410;st['locals'][1]=80
            steps=random(10)+12
            def slope(n):
                q=abs(n)*256//steps
                return 0 if q>65535 else word(q if n>=0 else -q)*256
            dx=slope(-170);dy=slope(-36);fx=fy=32768
            for step in range(1,steps+1):
                vx=(st['x']%65536)*65536+fx+dx;vy=(st['y']%65536)*65536+fy+dy
                st['x']=word(vx//65536);st['y']=word(vy//65536);fx=vx%65536;fy=vy%65536
                st['remaining']=steps+1-step
                yield 'wait'
            st['remaining']=0;st['x']=580;st['y']=116;bound=random(10)+5
            for counter in range(1,bound+1):
                st['locals'][3]=counter
                yield 'wait' # P
                st['locals'][3]=word(counter+1)
                if counter<bound:yield 'wait' # repeating Next
            score[0]+=10
            yield 'jump' # RN=250 <570, so the original If jumps to Begin
    bodies=[hunter(st)for st in states];records=[]
    for frame in range(81):
        if frame:
            for body in bodies:
                jumps=10
                while True:
                    if next(body)=='wait':break
                    jumps-=1
                    if not jumps:break
        pixels=bytearray(background)
        iw,ih,hx,hy,image=decoded[34]
        for st in states:
            for row in range(ih):
                for col in range(iw):
                    colour=image[row*iw+col];xx=st['x']+col-hx;yy=st['y']+row-hy
                    if colour and 0<=xx<width and 0<=yy<height:pixels[yy*width+xx]=colour
        rgba=bytearray()
        for yy in range(160):
            for xx in range(320,640):
                c=palette[pixels[yy*width+xx]];rgba.extend([(c>>8&15)*17,(c>>4&15)*17,(c&15)*17,255])
        record=dict(frame=frame,score=score[0],seed=rng['seed'],calls=rng['calls'],hunters=json.loads(json.dumps(states)),indicesSha256=sha(pixels),rgbaSha256=sha(rgba))
        if frame in (0,1,10,30,60):
            name=f'amal-hunters-{beam}-{frame}.png';record['png']=name
            scan=b''.join(b'\0'+rgba[yy*1280:(yy+1)*1280]for yy in range(160))
            (out/name).write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',320,160,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b''))
        records.append(record)
    hunters.append(dict(beam=beam,frames=records))
(out/'amal-hunters.json').write_text(json.dumps(dict(cases=hunters,sourceSha256=sha(program)),indent=2)+'\n')

# Wide/computed ship preview: independent raw-plane composites. All full ships
# fit in six channels. Three disjoint rows reuse them; the contention case
# explicitly admits only the first 16-pixel strip of image 12 after direct 0.
sprite_records=[]
for stage in range(17):
    objects=[(stage+1,176,124,None)] if stage<13 else ([(1,176,70,None),(2,176,100,None),(3,176,130,None)] if stage==13 else [(1,176,70,None),(12,240,70,16)] if stage==14 else [(1,176,124,None)] if stage==15 else [])
    indices=bytearray(v for y in range(160) for v in background[y*width:y*width+320])
    for img,x,y,clip in objects:
        iw,ih,hx,hy,pic=decoded[img]
        for row in range(ih):
            for col in range(iw if clip is None else clip):
                value=pic[row*iw+col]&15;xx=x-128+col-hx;yy=y-50+row-hy
                if value and 0<=xx<320 and 0<=yy<160:indices[yy*320+xx]=16+value
    rgba=bytearray()
    for value in indices:
        c=palette[value];rgba.extend([(c>>8&15)*17,(c>>4&15)*17,(c&15)*17,255])
    name=f'computed-sprites-{stage}.png'
    record=dict(stage=stage,rgbaSha256=sha(rgba),png=name)
    scan=b''.join(b'\0'+rgba[y*1280:(y+1)*1280]for y in range(160))
    (out/name).write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',320,160,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b''))
    sprite_records.append(record)
(out/'computed-sprites.json').write_text(json.dumps(dict(sourceSha256=sha(program),frames=sprite_records),indent=2)+'\n')

# Independently transcribed original horizontal ship AMAL. This is a small
# instruction generator for the published source, not a parser/runtime import.
ship_ops=[];ship_labels={}
def emit(*op):ship_ops.append(op)
def label(name):ship_labels[name]=len(ship_ops)
def test_jump(predicate,dest):emit('if',predicate,dest)
emit('jump','S');label('B');emit('joy');emit('rx');emit('rw')
test_jump('explode','E')
for condition,dest in [('leftbound','V'),('rightbound','Q'),('bottombound','N'),('topbound','K'),('withfire','T')]:test_jump(condition,dest)
for mask,dest in [(1,'U'),(2,'D'),(4,'L'),(8,'R'),(5,'H'),(10,'O'),(9,'Y'),(6,'G')]:test_jump(mask,dest)
label('C');emit('rx');emit('rw');test_jump('fire','F');emit('jump','B')
label('T')
for mask,dest in [(17,'U'),(18,'D'),(20,'L'),(24,'R'),(21,'H'),(26,'O'),(25,'Y'),(22,'G')]:test_jump(mask,dest)
emit('jump','B')
for dest,dx,dy in [('H',-5,-5),('O',5,5),('Y',5,-5),('G',-5,5),('U',0,-5),('D',0,5),('R',5,0),('L',-5,0)]:
    label(dest);emit('move',dx,dy);emit('jump','C')
label('S');emit('anim',0,[(3,5),(2,5)]);emit('jump','B')
label('F');emit('fire');emit('jump','B')
for dest,axis,value in [('V','x',130),('Q','x',418),('N','y',190),('K','y',60)]:
    label(dest);emit('set',axis,value);emit('jump','C')
label('E');emit('anim',1,[(n,1)for n in range(5,12)])
for _ in range(8):emit('pause')
emit('set','y',0);emit('pause');emit('dead');emit('end')
st=dict(x=176,y=124,image=1,r0=0,rx=0,rw=0,fire=0,dead=0,collision=0,ended=False,remaining=0)
ip=0;animation=None;ship_records=[]
def ship_mask(frame):
    return [0,8,10,1,20,25,2,4,0,16,16][min(10,(max(1,frame)-1)//8)]
for frame in range(89):
    reads=0
    if frame:
        if frame==73:st['collision']=1
        jumps=10
        while not st['ended']:
            op=ship_ops[ip];kind=op[0]
            if kind=='joy':st['r0']=ship_mask(frame);reads+=1;ip+=1
            elif kind=='rx':st['rx']=st['x'];ip+=1
            elif kind=='rw':st['rw']=st['y'];ip+=1
            elif kind in ('jump','if'):
                taken=True
                if kind=='if':
                    p=op[1]
                    taken=(st['r0']==p)if isinstance(p,int)else {'explode':st['collision']==1,'leftbound':st['x']<130,'rightbound':st['x']>418,'bottombound':st['y']>190,'topbound':st['y']<60,'withfire':st['r0']>16,'fire':bool(st['r0']&16)}[p]
                if taken:
                    ip=ship_labels[op[-1]];jumps-=1
                    if not jumps:break
                else:ip+=1
            elif kind=='move':
                if st['remaining']:st['remaining']=0;ip+=1;continue
                st['x']+=op[1];st['y']+=op[2];st['remaining']=1;break
            elif kind=='anim':animation=dict(frames=op[2],loops=op[1],counter=1,index=0);ip+=1
            elif kind=='fire':st['fire']=1;ip+=1
            elif kind=='set':st[op[1]]=op[2];ip+=1
            elif kind=='pause':ip+=1;break
            elif kind=='dead':st['dead']=99;ip+=1
            elif kind=='end':st['ended']=True
        if animation:
            animation['counter']=(animation['counter']-1)&65535
            if not animation['counter']:
                if animation['index']==len(animation['frames']):
                    if animation['loops']:animation['loops']-=1;done=animation['loops']==0
                    else:done=False
                    if done:animation=None
                    else:animation['index']=0
                if animation:
                    st['image'],animation['counter']=animation['frames'][animation['index']];animation['index']+=1
    indices=bytearray(v for y in range(160)for v in background[y*width:y*width+320])
    iw,ih,hx,hy,pic=decoded[st['image']]
    for y in range(ih):
        for x in range(iw):
            value=pic[y*iw+x]&15;xx=max(0,st['x']-hx)-128+x;yy=max(0,st['y']-hy)-50+y
            if value and 0<=xx<320 and 0<=yy<160:indices[yy*320+xx]=16+value
    rgba=bytearray()
    for value in indices:
        c=palette[value];rgba.extend([(c>>8&15)*17,(c>>4&15)*17,(c&15)*17,255])
    rec=dict(frame=frame,mask=ship_mask(frame)if frame else 0,reads=reads,**st,animation=None if not animation else dict(index=animation['index'],remaining=animation['counter'],loops=animation['loops']),rgbaSha256=sha(rgba))
    if frame in (0,1,6,24,40,72,73,76,79,81,83,88):
        name=f'amal-ship-{frame}.png';rec['png']=name
        scan=b''.join(b'\0'+rgba[y*1280:(y+1)*1280]for y in range(160))
        (out/name).write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',320,160,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b''))
    ship_records.append(rec)
assert ship_records[16]['x']==216 and ship_records[24]['y']==164 and ship_records[40]['fire']==1
assert ship_records[-1]['ended'] and ship_records[-1]['dead']==99 and ship_records[-1]['animation']is None
(out/'amal-ship.json').write_text(json.dumps(dict(sourceSha256=sha(program),frames=ship_records),indent=2)+'\n')
