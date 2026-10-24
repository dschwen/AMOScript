/* jshint esversion: 6 */
'use strict';
const assert=require('assert');
const {createBrowserAudioSession:create}=require('../lib/amos/browserAudio');
const play={type:'play',mask:1,sample:{number:3},filterEnabled:false,loopMask:0};
function fixture(resume) {
  const events=[],voices=new Set();let constructions=0,closures=0,disposals=0,resumes=0;
  const context={state:'suspended',resume(){resumes++;return resume?resume(context):Promise.resolve().then(()=>{context.state='running';});},close(){closures++;context.state='closed';return Promise.resolve();}};
  const session=create(()=>({command(e){events.push(e);if(e.type==='play')for(let i=0;i<4;i++)if(e.mask&(1<<i))voices.add(i);if(e.type==='stop')for(let i=0;i<4;i++)if(e.mask&(1<<i))voices.delete(i);},activeVoices:()=>[...voices],dispose(){disposals++;voices.clear();}}),()=>{constructions++;return context;});
  return {session,events,context,counts:()=>({constructions,closures,disposals,resumes})};
}

test('browser audio: lazy gesture activation drops earlier effects and forwards current play/filter/loop state synchronously',async()=>{
  const f=fixture(),adapter=f.session.bind();adapter.command(play);assert.strictEqual(f.counts().constructions,0);assert.deepStrictEqual(f.events,[]);
  const activation=f.session.enable();assert.strictEqual(f.counts().resumes,1);assert.strictEqual(f.session.status().state,'starting');
  adapter.command(play);assert.strictEqual(await activation,true);assert.deepStrictEqual(f.events,[]);
  adapter.command(play);assert.strictEqual(f.events[0],play);assert.strictEqual(f.session.status().plays,1);assert.deepStrictEqual(f.session.status().voices,[0]);
  f.session.mute();assert.strictEqual(f.session.status().state,'off');assert.deepStrictEqual(f.session.status().voices,[]);
  adapter.command(play);await f.session.enable();assert.strictEqual(f.session.status().plays,1);await f.session.dispose();
});

test('browser audio: muting or disposing invalidates pending activation without reviving voices',async()=>{
  for(const action of ['mute','dispose']){
    let resolve;const f=fixture(context=>new Promise(done=>{resolve=()=>{context.state='running';done();};}));
    const adapter=f.session.bind(),activation=f.session.enable();const cleanup=f.session[action]();resolve();assert.strictEqual(await activation,false);await cleanup;
    adapter.command(play);assert.strictEqual(f.session.status().plays,0);assert.deepStrictEqual(f.session.status().voices,[]);
    assert.strictEqual(f.session.status().state,action==='mute'?'off':'disposed');await f.session.dispose();assert.strictEqual(f.counts().closures,1);
  }
});

test('browser audio: restart invalidates old program adapters and keeps context activation for the new program',async()=>{
  const f=fixture(),old=f.session.bind();await f.session.enable();old.command(play);
  const current=f.session.bind();assert.deepStrictEqual(f.session.status().voices,[]);current.command({...play,mask:12});
  old.command({type:'stop',mask:15});old.command(play);assert.deepStrictEqual(f.session.status().voices,[2,3]);
  current.command({type:'stop',mask:15});assert.deepStrictEqual(f.session.status().voices,[]);
  await f.session.dispose();await f.session.dispose();assert.deepStrictEqual(f.counts(),{constructions:1,closures:1,disposals:1,resumes:1});
});

test('browser audio: blocked activation reports an error and can retry; suspended effects are dropped',async()=>{
  let blocked=true;const f=fixture(context=>blocked?Promise.reject(new Error('blocked')):Promise.resolve().then(()=>{context.state='running';}));
  const adapter=f.session.bind();assert.strictEqual(await f.session.enable(),false);assert.strictEqual(f.session.status().state,'error');assert.match(f.session.status().error,/blocked/);
  adapter.command(play);blocked=false;assert.strictEqual(await f.session.enable(),true);adapter.command(play);
  f.context.state='suspended';assert.strictEqual(f.session.status().state,'suspended');adapter.command(play);assert.strictEqual(f.session.status().plays,1);
  await f.session.enable();assert.strictEqual(f.session.status().plays,1);adapter.command(play);assert.strictEqual(f.session.status().plays,2);await f.session.dispose();
});

test('browser audio: missing APIs stay optional, disposal needs no context, and host failures remain synchronous',async()=>{
  const missing=create(()=>{},()=>{throw new Error('No AudioContext');});missing.bind().command(play);assert.strictEqual(await missing.enable(),false);assert.match(missing.status().error,/No AudioContext/);await missing.dispose();
  const idle=fixture();await idle.session.dispose();idle.session.mute();assert.throws(()=>idle.session.bind(),/session is disposed/);assert.strictEqual(idle.counts().constructions,0);assert.strictEqual(await idle.session.enable(),false);
  const context={state:'running',resume:()=>Promise.resolve(),close:()=>Promise.resolve()};
  const broken=create(()=>({command:e=>{if(e.type==='play')throw new Error('broken host');},activeVoices:()=>[],dispose(){}}),()=>context);
  const adapter=broken.bind();await broken.enable();assert.throws(()=>adapter.command(play),/broken host/);await broken.dispose();
});
