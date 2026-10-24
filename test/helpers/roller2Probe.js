/* jshint esversion: 6 */
'use strict';
module.exports=async function roller2Probe(page){
  const fs=require('fs'),path=require('path'),Transpiler=require('../../lib/Transpiler'),directory=path.join(__dirname,'../../examples/Roller2');
  const source=new Transpiler(require('./roller2Loads')()).toModule();
  const audit=require('../../tools/audit_program').auditProgram(fs.readFileSync(path.join(directory,'Roller II.AMOS')));
  const assets=Object.fromEntries(['music/Roller_II_Samples.Abk','music/mod.Roller_II_mus'].map(name=>[name.toLowerCase(),fs.readFileSync(path.join(directory,name)).toString('base64')]));
  return page.evaluate(({source,assets,inventory,readModSource,summarySource})=>{
    const module={exports:{}};new Function('module',source)(module);
    const program=module.exports({now:()=>0,setTimeout:()=>1,clearTimeout(){},files:{read:name=>{const value=assets[name.replace(/^rii:/i,'').toLowerCase()];if(value==null)throw new Error(`Asset not preloaded: ${name}`);return atob(value);}}});
    const check=(condition,message)=>{if(!condition)throw new Error(message);};let decoded;
    try{program.tick(1000);const bank=program.banks.get(22);check(program.state.halted&&program.state.audio.bank===6&&program.state.tracker.bank===22,'Original Roller2 loads did not finish');
      check(bank.name==='Tracker '&&bank.data.length===84038&&bank.data.subarray(84006).every(v=>v===0),'Track Load bytes/workspace differ');
      decoded=new Function(`return (${readModSource});`)()(bank.data.subarray(0,-32));
    }finally{program.stop();}
    const summary=new Function(`return (${summarySource});`)()(decoded);
    check(summary.patterns===12&&summary.samples.length===10&&summary.songLength===22,'Original MOD structure differs');
    check(JSON.stringify(summary.effects)===JSON.stringify({f:12,c:491,a:337,e0:21,d:1}),'Original MOD effects differ');
    const old=document.getElementById('roller2-controls');if(old)old.remove();
    const controls=document.createElement('section');controls.id='roller2-controls';
    const heading=document.createElement('h2');heading.textContent='Roller II: original loads and MOD pattern inspector';
    const help=document.createElement('p');help.textContent='This executes the original sample-bank load and leading Track Load statement, followed by an explicit End guard. The complete game does not yet compile. This inspector decodes the MOD; it does not play the tracker song. Game-over/win assets are separate AMOS Music banks.';
    const pattern=document.createElement('select');pattern.id='roller2-pattern';pattern.setAttribute('aria-label','MOD pattern');
    for(let i=0;i<decoded.patternCount;i++){const option=document.createElement('option');option.value=String(i);option.textContent=`Pattern ${i}`;pattern.append(option);}
    const cells=document.createElement('pre');cells.id='roller2-cells';const status=document.createElement('pre');status.id='roller2-status';
    function update(){const number=Number(pattern.value),data=decoded.patterns[number];controls.dataset.pattern=String(number);cells.textContent='row   sample:period:effect (four channels)\n'+Array.from({length:64},(_,row)=>`${String(row).padStart(2,'0')}  `+data.slice(row*4,row*4+4).map(c=>`${String(c.sample).padStart(2,'0')}:${String(c.period).padStart(4,'0')}:${c.effect.toString(16)}${c.parameter.toString(16).padStart(2,'0')}`).join('  ')).join('\n');}
    pattern.addEventListener('change',update);status.textContent=JSON.stringify({wholeProgram:inventory,module:summary,playbackImplemented:false},null,2);
    controls.append(heading,help,pattern,cells,status);const results=document.getElementById('results');if(results)results.before(controls);else document.body.append(controls);update();
    return {physicalLines:inventory.physicalLines,encodings:inventory.distinctEncodings,unrecognized:inventory.unrecognizedEncodings,wholeCompiled:inventory.compiler.ok,trackerBank:22,moduleBytes:84006,orders:22,patterns:12,instruments:10,playback:false};
  },{source,assets,inventory:{physicalLines:audit.physicalLines,distinctEncodings:audit.distinctEncodings,unrecognizedEncodings:audit.unrecognizedEncodings,compiler:audit.compiler,missing:audit.missing.map(t=>({code:t.code,name:t.name,line:t.locations[0].line}))},readModSource:require('../../lib/amos/mod').toString(),summarySource:require('../../tools/audit_mod').summarizeMod.toString()});
};
