'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {compile}=require('./helpers/program'),replay=require('./helpers/planetZybexReplay'),oracle=require('./fixtures/planet-zybex/game.json');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function crop(frame,r){const out=Buffer.alloc(r.width*r.height*4);for(let y=0;y<r.height;y++)out.set(frame.rgba.subarray(((r.y+y)*frame.width+r.x)*4,((r.y+y)*frame.width+r.x+r.width)*4),y*r.width*4);return out;}
test('Planet Zybex full game: input-only PAL/NTSC movement/fire, five life losses, four restarts, independent regions/GAME OVER, sample PCM and fresh game',()=>{
  const raw=fs.readFileSync(path.join(__dirname,'../examples/PlanetZybex/Zybex.AMOS'));assert.strictEqual(hash(raw),oracle.sourceSha256);const{create}=compile(raw);
  for(const standard of ['PAL','NTSC']){
    const clock=require('./helpers/fakeTimers').createFakeTimers(1),events=[],reads=[],banks=[];let captures=0;
    const result=replay(create,clock,{read:name=>{reads.push(name);return fs.readFileSync(path.join(__dirname,'../examples/PlanetZybex',name),'latin1');}},p=>{let mask=0;const detach=p.setJoystickReader(port=>port===1?mask:0);return{set(v){mask=v;p.setJoystick(1,v);},key:k=>p.sendKey(k),dispose(){mask=0;detach();}};},(name,p)=>{
      const expected=oracle.frames.find(f=>f.name===name);assert.ok(expected,name);const frame=p.display.canvasFrame();assert.deepStrictEqual([frame.width,frame.height],[640,171]);
      for(const region of expected.regions)assert.strictEqual(hash(crop(frame,region)),region.sha256,standard+' '+name);
      if(expected.png)assert.deepStrictEqual(Buffer.from(frame.rgba),Buffer.from(require('./helpers/displayPng').decodePng(fs.readFileSync(path.join(__dirname,'fixtures/planet-zybex',expected.png))).rgba));
      captures++;if(name.startsWith('Restart')||name==='Fresh game')banks.push(p.banks.get(10));
    },{command:e=>{if(e.type==='play')events.push(e);}},standard);
    assert.deepStrictEqual(result,{deaths:[4,3,2,1,0],restarts:[4,3,2,1],frames:419,stopResume:true,freshLives:5,freshLevel:1});assert.strictEqual(captures,10);assert.strictEqual(clock.pending(),0);assert.deepStrictEqual(reads,Array(6).fill('level1_screen.abk'));assert.strictEqual(new Set(banks).size,5);
    const shots=events.filter(e=>e.sample.number===4),booms=events.filter(e=>e.effect==='boom');assert.strictEqual(shots.length,2);assert.strictEqual(booms.length,20);assert.deepStrictEqual(booms.map(e=>e.mask),Array(5).fill([8,4,2,1]).flat());
    const expectedPcm=fs.readFileSync(path.join(__dirname,'fixtures/planet-zybex',oracle.audio.pcm));assert.strictEqual(hash(expectedPcm),oracle.audio.pcmSha256);
    for(const shot of shots){assert.deepStrictEqual([shot.mask,shot.period,shot.volume,shot.loopMask,shot.sample.length],[1,oracle.audio.periods[standard],56,0,4554]);assert.strictEqual(shot.rate,(standard==='PAL'?3546895:3579545)/shot.period);assert.strictEqual(hash(Uint8Array.from(shot.sample.data)),oracle.audio.sha256);for(let i=0;i<4554;i++)assert.strictEqual(((shot.sample.data[i]<<24)>>24)/128,expectedPcm.readFloatLE(i*4));}
  }
});
