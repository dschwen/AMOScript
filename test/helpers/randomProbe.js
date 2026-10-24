/* jshint esversion: 6 */
'use strict';

module.exports=async function randomProbe(page){
  const fs=require('fs'),path=require('path'),Transpiler=require('../../lib/Transpiler');
  const kinds=['blob','green','green-right'],sources=kinds.map(kind=>new Transpiler(require('./wonderlandRandom')(kind)).toModule());
  const samples=fs.readFileSync(path.join(__dirname,'../../examples/Wonderland/Wonderland_Samples.Abk')).toString('base64');
  const expected=require('../fixtures/random-vectors.json');
  return page.evaluate(({kinds,sources,samples,expected,timerSource})=>{
    const factories=sources.map(source=>{const m={exports:{}};new Function('module',source)(m);return m.exports;}),makeClock=new Function(`return (${timerSource});`)();
    const check=(condition,message)=>{if(!condition)throw new Error(message);};
    function make(kind,seed,beam){
      const clock=makeClock(),p=factories[kinds.indexOf(kind)]({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,readRandomBeam:()=>beam,
        files:{read:name=>{if(!name.endsWith('/Wonderland_Samples.Abk'))throw new Error('Unexpected random fixture file');return atob(samples);}}});
      p.tick(100000);p.randomize(seed);check(p.state.waiting==='key','Original random fixture missed its guard');
      return {kind,program:p,step(){p.sendKey('next');clock.tick(0);check(p.state.waiting==='key'&&clock.pending()===0,'Initializer missed its bounded guard');
        return ['xs','ys','f','my'].map(name=>p.arrayGet(p.state.variables[`array_int_${name}`],[1]));},dispose(){p.stop();}};
    }
    for(const item of expected.vectors){const run=make('blob',item.seed,item.beam);try{
      check(JSON.stringify(item.bounds.map(bound=>run.program.rnd(bound)))===JSON.stringify(item.values),'Independent source PRNG vector differs');
      check(run.program.state.random.seed===item.finalSeed,'Independent final seed differs');
    }finally{run.dispose();}}
    let steps=0;
    for(const item of expected.enemies){const run=make(item.kind,item.seed,item.beam);try{
      for(const row of item.rows){check(JSON.stringify(run.step())===JSON.stringify(row),`Original ${item.kind} initializer differs`);steps++;}
      check(run.program.state.random.seed===item.finalSeed,'Original enemy stream final seed differs');
    }finally{run.dispose();}}
    if(globalThis.AMOS_RANDOM_DEMO_CLEANUP)globalThis.AMOS_RANDOM_DEMO_CLEANUP();const previous=document.getElementById('rnd-controls');if(previous)previous.remove();
    const controls=document.createElement('section');controls.id='rnd-controls';
    const heading=document.createElement('h2');heading.textContent='Step original enemy initialization';
    const help=document.createElement('p');help.textContent='Seeded original blob/green-jump statements update one enemy record with declared positions. Inputs apply when you reset the stream. The beam word is a constant test input; zero is the portable default. This is a data inspector, not gameplay or an Amiga capture. Rnd(0) repeats the cached result without advancing the stream.';
    const kind=document.createElement('select');kind.id='rnd-kind';kind.setAttribute('aria-label','Original initializer');
    for(const value of kinds){const option=document.createElement('option');option.value=value;option.textContent=value;kind.append(option);}
    const seed=document.createElement('input');seed.id='rnd-seed';seed.type='number';seed.value=12345;seed.setAttribute('aria-label','Signed 32-bit seed');
    const beam=document.createElement('input');beam.id='rnd-beam';beam.type='number';beam.min=0;beam.max=65535;beam.value=0;beam.setAttribute('aria-label','Controlled 16-bit beam word');
    const status=document.createElement('pre');status.id='rnd-status';let live=null,rows=[];
    function report(){controls.dataset.seed=String(live.program.state.random.seed);status.textContent=JSON.stringify({kind:live.kind,random:live.program.state.random,rows},null,2);}
    function reset(){const s=Number(seed.value),b=Number(beam.value);if(!Number.isInteger(s)||s< -2147483648||s>2147483647||!Number.isInteger(b)||b<0||b>65535)throw new Error('Enter a signed 32-bit seed and a beam word 0–65535.');
      const next=make(kind.value,s,b);if(live)live.dispose();live=next;rows=[];controls.dataset.steps='0';controls.dataset.cached=String(live.program.rnd(0));report();}
    const button=(id,label,handler)=>{const el=document.createElement('button');el.id=id;el.textContent=label;el.addEventListener('click',()=>{try{handler();}catch(error){status.textContent=error.message;}});return el;};
    const label=(name,input)=>{const el=document.createElement('label');el.append(name,input);return el;};
    controls.append(heading,help,kind,label(' Seed ',seed),label(' Beam ',beam),button('rnd-reset','Reset selected stream',reset),
      button('rnd-next','Run original initializer',()=>{const row=live.step();rows.push(row);if(rows.length>20)rows.shift();controls.dataset.steps=String(Number(controls.dataset.steps)+1);controls.dataset.xs=String(row[0]);controls.dataset.ys=String(row[1]);report();}),
      button('rnd-repeat','Read Rnd(0)',()=>{const before=live.program.state.random.seed;controls.dataset.cached=String(live.program.rnd(0));check(live.program.state.random.seed===before,'Cached query advanced the seed');report();}),status);
    const results=document.getElementById('results');if(results)results.before(controls);else document.body.append(controls);reset();globalThis.AMOS_RANDOM_DEMO_CLEANUP=()=>live.dispose();
    return {vectors:expected.vectors.length,streams:expected.enemies.length,steps,gameRunning:false};
  },{kinds,sources,samples,expected,timerSource:require('./fakeTimers').createFakeTimers.toString()});
};
