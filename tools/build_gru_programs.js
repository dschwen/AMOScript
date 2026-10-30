'use strict';
// Compile the pinned Gru1/Gru2/progs1 inventory without changing source bytes.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const Transpiler=require('../lib/Transpiler');
function build(directory){
  const root=path.resolve(__dirname,'../examples/GruPrograms'),output=path.resolve(directory);
  if(root===output || root.startsWith(output+path.sep))throw Error('Output must not contain the source directory');
  fs.mkdirSync(output,{recursive:true});
  const report=[];
  for(const entry of require('../examples/GruPrograms/manifest.json').sources){
    const bytes=fs.readFileSync(path.join(root,entry.path));
    if(bytes.length!==entry.byteLength || crypto.createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('Pinned source differs: '+entry.path);
    const item={...entry};let source;
    try{const compiler=new Transpiler(bytes);source=compiler.toModule();item.compiled=true;item.instructions=compiler._ops.length;item.output=entry.path+'.module.js';}
    catch(error){item.compiled=false;item.error=error.message;}
    if(item.compiled){const target=path.join(output,item.output);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,source,{flag:'wx'});}
    console.log((item.compiled?'PASS ':'FAIL ')+entry.path+(item.error?': '+item.error:''));report.push(item);
  }
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(`${report.filter(e=>e.compiled).length}/${report.length} compiled; report: ${path.join(output,'report.json')}`);
  return report;
}
if(require.main===module)try{if(process.argv.length!==3)throw Error('Usage: node tools/build_gru_programs.js NEW_OUTPUT_DIRECTORY');if(build(process.argv[2]).some(e=>!e.compiled))process.exitCode=1;}catch(error){console.error(error.message);process.exitCode=1;}
module.exports=build;
