'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),Transpiler=require('../lib/Transpiler');
const {buildGamePage}=require('./build_game_page'),{prepare}=require('./asmIntroAssets');
const root=path.join(__dirname,'../examples/ASM');
function inputs() {
  const manifest=require('../examples/ASM/manifest.json');
  for(const [name,entry] of Object.entries(manifest.pinned)) {
    const bytes=fs.readFileSync(path.join(root,name));
    if(bytes.length!==entry.byteLength || crypto.createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('Pinned ASM input differs: '+name);
  }
  return manifest;
}
function pages() {
  inputs(); const {assets,diskFonts}=prepare(), source=fs.readFileSync(path.join(root,'ASM_Intro.AMOS'));
  const outputs=new Map();
  for(const debug of [false,true]) {
    const file=debug?'asm-intro-debug.html':'asm-intro.html';
    let page=buildGamePage(source,{title:'ASM — Das Spiel: original intro'+(debug?' (debug)':''),assets,diskFonts,renderer:'canvas',stopOnUnlinkedRun:true,debug});
    const preview=n=>'https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/'+n;
    const other=debug?'asm-intro.html':'asm-intro-debug.html';
    page=page.replace('<h1>',`<nav><a href="${preview('index.html')}">Demo index</a> · <a href="${preview(other)}">${debug?'Regular preview':'Debug preview'}</a> · <a href="${preview('asm-intro-checks.html')}">Browser checks</a></nav><h1>`)
      .replace("Follow the game's intro and menu prompts. Arrows move; Space/Enter fires.", 'Use the mouse to choose music and difficulty; click to advance the intro.').replace('<details class="game-help">','<p>Development preview of the complete original intro. Use the mouse to choose music and difficulty, then click through the logo and title screens; right click skips to loading. Canvas renders the HAM title image. The main adventure is the next milestone and is not included yet.</p><details class="game-help">');
    outputs.set(file,page);
  }
  return outputs;
}
function build(outputDirectory) {
  const manifest=inputs(),outputs=pages(),report=[];
  for(const name of manifest.sources) {
    const item={source:name,...manifest.pinned[name]};
    try{const compiler=new Transpiler(fs.readFileSync(path.join(root,name)));item.compiled=true;item.instructions=compiler._ops.length;outputs.set(name+'.module.js',compiler.toModule());}
    catch(error){item.compiled=false;item.error=error.message;}
    report.push(item);
  }
  outputs.set('report.json',JSON.stringify(report,null,2)+'\n');
  outputs.set('index.html','<!doctype html><html lang="en"><meta charset="utf-8"><title>ASM builds</title><h1>ASM — Das Spiel</h1><p><a href="asm-intro.html">Play the intro</a> · <a href="asm-intro-debug.html">Debug preview</a></p><p>The main adventure is under development; see report.json for compilation results.</p></html>\n');
  fs.mkdirSync(outputDirectory,{recursive:true});
  for(const [name,content]of outputs)fs.writeFileSync(path.join(outputDirectory,name),content,{flag:'wx'});
  for(const item of report)console.log(`${item.compiled?'PASS':'FAIL'} ${item.source}: ${item.error||item.instructions+' instructions'}`);
  return report;
}
if(require.main===module)try{if(process.argv.length!==3)throw Error('Usage: node tools/build_asm.js NEW_OUTPUT_DIRECTORY');build(path.resolve(process.argv[2]));}catch(error){console.error(error.message);process.exitCode=1;}
module.exports={inputs,pages,build};
