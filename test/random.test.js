/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {binary,token:t,word:w,dword,integer:n,identifier:id,text,compile,execute}=require('./helpers/program');
const {createFakeTimers}=require('./helpers/fakeTimers');
const vectors=require('./fixtures/random-vectors.json');
const idle=options=>execute(binary([[t('Wait Key')]]),100,options).program;
const fn=value=>[w(0x686),t('('),n(value),t(')')];

test('Rnd: independent word-arithmetic vectors preserve source cross-product swaps, masking, rejection and 24-bit limits',()=>{
  for(const item of vectors.vectors){const p=idle({readRandomBeam:()=>item.beam});p.randomize(item.seed);
    assert.deepStrictEqual(item.bounds.map(bound=>p.rnd(bound)),item.values);assert.strictEqual(p.state.random.seed,item.finalSeed);assert.ok(Object.isFrozen(p.state.random));p.stop();}
  const result=execute(binary([[w(0x690),n(12345)],[t('Print'),fn(-6),t(','),fn(-10),t(','),fn(0)]]));assert.deepStrictEqual(result.logs,[[3,7,7]]);
});

test('Rnd: zero repeats without advancing, Randomize changes only the seed, and negative bounds skip the beam reader',()=>{
  let calls=0;const p=idle({readRandomBeam:()=>{calls++;return 123;}});assert.strictEqual(p.rnd(0),0);p.randomize(12345);const a=p.rnd(-6),seed=p.state.random.seed;
  assert.strictEqual(a,3);assert.strictEqual(calls,0);assert.strictEqual(p.rnd(0),3);assert.strictEqual(p.state.random.seed,seed);
  p.randomize(-1);assert.strictEqual(p.state.random.seed,4294967295);assert.strictEqual(p.rnd(0),3);p.rnd(6);assert.strictEqual(calls,1);p.stop();
});

test('Rnd: positive beam words mix in the low word without carrying into the high byte',()=>{
  const p=idle({readRandomBeam:()=>65535});p.randomize(-1);assert.strictEqual(p.rnd(16777215),4505786); // pinned source word-wrap result
  p.stop();
  const a=idle(),b=idle({readRandomBeam:()=>0});for(let i=0;i<200;i++)assert.strictEqual(a.rnd(50),b.rnd(50));a.stop();b.stop();
});

test('Rnd: factory state is independent, default seeds are explicit, and Stop/Resume and Timer preserve the stream',()=>{
  const a=idle(),b=idle();assert.deepStrictEqual({...a.state.random},{seed:0,last:0});a.randomize(12345);assert.strictEqual(a.rnd(-6),3);assert.strictEqual(b.rnd(-6),0);
  const before={...a.state.random};a.setTimer(500);a.stop();assert.deepStrictEqual({...a.state.random},before);a.resume();assert.strictEqual(a.rnd(-10),7);a.stop();b.stop();
});

test('Rnd: DATA, typed scalars/arrays and procedure results stay integer-valued; Val uses shared conversion',()=>{
  const result=execute(binary([[t('Randomize'),n(12345)],[t('Data'),w(0),fn(-6)],[t('Read'),id('r')],
    [t('Dim'),id('a'),t('('),n(0),t(')')],[id('a'),t('('),n(0),t(')'),t('='),fn(-10)],
    [t('Procedure'),dword(0),w(0),0,0,id('p')],[t('End Proc'),t('['),fn(-2),t(']')],[id('p',0x12)],
    [id('f',6,1),t('='),fn(0)],[t('Print'),id('r'),t(','),id('a'),t('('),n(0),t(')'),t(','),t('Param'),t(','),id('f',6,1)],
    [t('Print'),t('Rnd'),t('('),t('Val'),t('('),text('-50.9'),t(')'),t(')')]]));assert.deepStrictEqual(result.logs,[[3,7,0,0],[15]]);
  for(const line of [[t('Randomize'),text('1')],[t('Print'),t('Rnd'),t('('),text('1'),t(')')]])assert.throws(()=>compile(binary([line])),/numeric|Wrong argument type/i);
});

test('Rnd: inclusive small bounds stay bounded and visit both endpoints; large bounds preserve the source 24-bit ceiling',()=>{
  const p=idle();for(const bound of [1,2,6,10,50]){p.randomize(12345);const seen=new Set();for(let i=0;i<2000;i++){const v=p.rnd(bound);assert.ok(Number.isInteger(v)&&v>=0&&v<=bound);seen.add(v);}assert.ok(seen.has(0)&&seen.has(bound));}
  for(const bound of [16777216,2147483647,-2147483648])for(let i=0;i<20;i++)assert.ok(p.rnd(bound)<=16777215);p.stop();
});

test('Rnd: invalid synchronous beam results and bounded adversarial rejection halt with source context',()=>{
  const source=binary([[t('Print'),fn(2)]]);
  for(const beam of [-1,65536,1.5,Promise.resolve(1)])assert.throws(()=>execute(source,100,{readRandomBeam:()=>beam}),/16-bit word synchronously.*line 1/);
  assert.throws(()=>execute(source,100,{readRandomBeam:()=>{throw new Error('beam failed');}}),/beam failed.*line 1/);
  assert.throws(()=>idle({readRandomBeam:1}),/must be a synchronous function/);
  let mirror=0n,calls=0;const beam=()=>{const low=mirror&65535n,high=mirror>>16n,swap=v=>(v%65536n)*65536n+v/65536n;
    mirror=(low*58925n+swap(high*58925n)+swap(low*47936n)+1n)%4294967296n;calls++;return Number((3n-(mirror>>8n)+16777216n)%65536n);};
  const clock=createFakeTimers(),p=compile(source).create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,readRandomBeam:beam});
  assert.throws(()=>p.tick(100),/Rnd rejection budget exhausted.*line 1, byte/);assert.strictEqual(calls,4096);assert.strictEqual(p.state.halted,true);assert.strictEqual(clock.pending(),0);assert.strictEqual(p.state.random.last,0);
});

test('Rnd: original Wonderland blob and green-jump slices match independent seeded vectors for controlled beam words',()=>{
  for(const item of vectors.enemies){const {program:p,timers:c}=execute(require('./helpers/wonderlandRandom')(item.kind),100000,{readRandomBeam:()=>item.beam,
    files:{read:name=>fs.readFileSync(path.join(__dirname,'../examples/Wonderland',name.split('/').pop())).toString('latin1')}});p.randomize(item.seed);
    for(const expected of item.rows){p.sendKey('next');c.tick(0);assert.deepStrictEqual(['xs','ys','f','my'].map(name=>p.arrayGet(p.state.variables[`array_int_${name}`],[1])),expected);assert.strictEqual(p.state.waiting,'key');}
    assert.strictEqual(p.state.random.seed,item.finalSeed);assert.strictEqual(c.pending(),0);p.stop();}
});
