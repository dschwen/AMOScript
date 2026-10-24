/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {binary,token:t,word:w,dword,integer:n,identifier:id,text,compile,execute}=require('./helpers/program');
const {createMemoryFiles}=require('../lib/amos/files');
const select=(...args)=>[t(['','Fsel$','Fsel$2','Fsel$3','Fsel$4'][args.length]),t('('),args.flatMap((arg,i)=>[...(i?[t(',')]:[]),text(arg)]),t(')')];
const samples=fs.readFileSync(path.join(__dirname,'../examples/Wonderland/Wonderland_Samples.Abk'),'latin1');

test('Fsel$: all original arities forward defaults/titles and return the host path unchanged or empty cancellation',()=>{
  const files=createMemoryFiles({},['','other:Chosen.LEV','typed.lev','new:save.lev']);
  const {logs}=execute(binary([1,2,3,4].map(count=>[t('Print'),select(...['dir:*.lev','default','Title','Subtitle'].slice(0,count))])),100,{files});
  assert.deepStrictEqual(logs,[[''],['other:Chosen.LEV'],['typed.lev'],['new:save.lev']]);
  assert.deepStrictEqual(files.selectionRequests().map(r=>({...r})),[
    {path:'dir:*.lev',defaultName:'',title1:'',title2:''},{path:'dir:*.lev',defaultName:'default',title1:'',title2:''},
    {path:'dir:*.lev',defaultName:'default',title1:'Title',title2:''},{path:'dir:*.lev',defaultName:'default',title1:'Title',title2:'Subtitle'}]);
  assert.ok(Object.isFrozen(files.selectionRequests()[0]));
});

test('Fsel$: expressions evaluate once, string DATA/arrays/procedure results preserve the selected bytes',()=>{
  const files=createMemoryFiles({},['\xff.lev','array.lev','proc.lev']);
  const {logs}=execute(binary([[t('Data'),w(0),text('*.lev')],[t('Read'),id('pattern',6,2)],
    [t('Dim'),id('a',6,2),t('('),n(0),t(')')],[id('a',6,2),t('('),n(0),t(')'),t('='),[t('Fsel$'),t('('),id('pattern',6,2),t(')')]],
    [t('Procedure'),dword(0),w(0),0,0,id('p')],[t('End Proc'),t('['),select('*.lev'),t(']')],[id('p',0x12)],
    [t('Print'),id('a',6,2),t('('),n(0),t(')'),t(','),t('Param$'),t(','),select('*.lev')]]),100,{files});
  assert.deepStrictEqual(logs,[['\xff.lev','array.lev','proc.lev']]);assert.strictEqual(files.selectionRequests().length,3);
});

test('Fsel$: missing/unprepared/async/malformed selectors fail explicitly with source context and no execution replay',()=>{
  const source=binary([[t('Print'),select('*.lev')]]);
  assert.throws(()=>execute(source),/synchronous files.select.*line 1/);assert.throws(()=>execute(source,100,{files:createMemoryFiles()}),/No queued file selection.*line 1/);
  for(const result of [null,Promise.resolve('x'),42,'\0','\u0100','x'.repeat(256)])assert.throws(()=>execute(source,100,{files:{select:()=>result}}),/selector must return.*line 1/);
  let calls=0;assert.throws(()=>execute(source,100,{files:{select(){calls++;throw new Error('selection failed');}}}),/selection failed.*line 1/);assert.strictEqual(calls,1);
  for(const value of ['\0','\u0100','x'.repeat(256)])assert.throws(()=>execute(binary([[t('Print'),select(value)]]),100,{files:createMemoryFiles({},['x'])}),/NUL-free byte strings|File selections|byte-string/);
  assert.throws(()=>compile(binary([[t('Print'),t('Fsel$'),t('('),n(1),t(')')]])),/Wrong argument type/);
});

test('Fsel$: queues and file namespaces are independent, cancellation consumes one choice, and new save paths need not exist',()=>{
  const a=createMemoryFiles({},['']),b=createMemoryFiles({},['b.lev']);a.queueSelection('new.lev');
  assert.strictEqual(a.select({path:'*'}),'');assert.strictEqual(a.select({path:'*'}),'new.lev');assert.strictEqual(b.select({path:'*'}),'b.lev');
  a.write('new.lev','\0\xff');assert.throws(()=>b.read('new.lev'),/not found/);assert.throws(()=>a.queueSelection(null),/must be a string/);
});

test('Fsel$: unchanged Wonderland selector retries cancellation/wrong extensions and drives original save/load statements',()=>{
  const original=require('./helpers/wonderlandLevelBytes')(),name='AMOSPro_Productivity2:Wonderland/chosen.LEV';
  for(const mode of ['load','save']){
    const files=createMemoryFiles({[name]:original.toString('latin1'),'AMOSPro_Productivity2:Wonderland/Wonderland_Samples.Abk':samples},['','wrong.txt',name]);
    const {program:p,timers:c}=execute(require('./helpers/wonderlandSelector')(mode),100000,{files});
    assert.strictEqual(p.state.waiting,'key');assert.strictEqual(p.state.variables.string_f,name);assert.strictEqual(p.mouseVisible(),false);assert.strictEqual(files.selectionRequests().length,3);
    assert.strictEqual(files.selectionRequests()[0].title1,mode==='load'?'Select a .lev file to LOAD':'SAVE levels as...');
    if(mode==='save')assert.deepStrictEqual(Buffer.from(files.read(name),'latin1'),original.subarray(0,7205));
    else assert.deepStrictEqual([1,2,3,4,5].map(i=>p.arrayGet(p.state.variables.array_int_rbowseed,[i])),[55,7,45,10,49]);
    assert.strictEqual(c.pending(),0);p.stop();
  }
});

test('Wonderland: unmodified whole program compiles standalone and follows its own game branch to the explicit sprite gate',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../examples/Wonderland/Wonderland.AMOS')),{create}=compile(source);
  const c=require('./helpers/steppedTimers').createSteppedTimers(),reads=[];
  const p=create({now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,files:{read:name=>{reads.push(name);return fs.readFileSync(path.join(__dirname,'../examples/Wonderland',name.split('/').pop()),'latin1');}},print(){}});
  const other=create({now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout});other.banks.get(4).data[0]=255;assert.notStrictEqual(p.banks.get(4).data[0],255);other.randomize(12345);assert.strictEqual(p.state.random.seed,0);other.stop();
  p.tick(100000);assert.strictEqual(p.state.location.line,51);p.setJoystick(1,16);let failure;
  for(let step=0;step<10&&!p.state.halted;step++){try{assert.ok(c.next());}catch(error){failure=error;break;}}
  assert.match(failure.message,/Attached or wide hardware Sprites are not implemented at line 204, byte 8682/);
  assert.strictEqual(p.state.variables.int_game,1);assert.strictEqual(p.state.variables.int_lev,1);assert.strictEqual(c.now(),100);assert.strictEqual(c.pending(),0);
  assert.deepStrictEqual(reads.map(name=>name.split('/').pop()),['Wonderland_Samples.Abk','Title_Screen.Iff','Landscape.Iff','Score_Panel.Iff']);p.stop();
});
