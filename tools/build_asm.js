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
    page=page.replace('<h1>',`<nav><a href="${preview('index.html')}">Demo index</a> · <a href="${preview('asm-room1.html')}">Direct room 1</a> · <a href="${preview(other)}">${debug?'Regular preview':'Debug preview'}</a> · <a href="${preview('asm-intro-checks.html')}">Browser checks</a></nav><h1>`)
      .replace("Follow the game's intro and menu prompts. Arrows move; Space/Enter fires.", 'Use the mouse to choose music and difficulty; click to advance the intro.').replace('<details class="game-help">','<p>Development preview of the complete original intro. Use the mouse to choose music and difficulty, then click through the logo and title screens; right click skips to loading. Canvas renders the HAM title image. The main adventure is the next milestone and is not included yet.</p><details class="game-help">');
    outputs.set(file,page);
  }
  const main=fs.readFileSync(path.join(root,'ASM.current.AMOS'));
  const gameAssets={...assets,...require('./asmGameAssets').prepare()};
  for(const debug of [false,true]) {
    let page=buildGamePage(source,{title:'ASM — Das Spiel: adventure development build'+(debug?' (debug)':''),assets:gameAssets,diskFonts,
      programs:{'ASM:ASM.Main':main.toString('base64')},renderer:'canvas',debug,restartFromEntry:true,directories:['Df0:','Ram:']});
    const other=debug?'asm-game.html':'asm-game-debug.html';
    const preview=n=>'https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/'+n;
    page=page.replace('<h1>',`<nav><a href="${preview('index.html')}">Demo index</a> · <a href="${preview('asm-room1.html')}">Direct room 1</a> · <a href="${preview(other)}">${debug?'Regular build':'Debug build'}</a> · <a href="${preview('asm-main-checks.html')}">Browser checks</a> · <a href="${preview('asm-rooms.html')}">Room gallery</a></nav><h1>`)
      .replace('<details class="game-help">','<p>Adventure development build: the original intro now launches the complete compiled main source. Choose JOY for the full view (IO Light intentionally shows half). Click through the opening messages, then use ⌨ to type the requested letter of ASM. All 23 rooms are included. Some missing artwork was restored from older supplied disks. The full quest and minigames remain under development.</p><details class="game-help">')
      .replace("Follow the game's intro and menu prompts. Arrows move; Space/Enter fires.", 'Use the mouse or touch to select commands and objects. Open ⌨ for text input; Enter and Backspace go directly to AMOS.');
    outputs.set(debug?'asm-game-debug.html':'asm-game.html',page);
  }
  outputs.set('asm-room1.html',buildGamePage(main,{title:'ASM — Room 1 direct debug (WebGL)',assets:gameAssets,diskFonts,renderer:'webgl',debug:true,directories:['Df0:','Ram:'],entryFiles:{'Ram:Level':'2\r\n'}}).replace('<details class="game-help">','<p>WebGL main-game launcher: skips the intro and selects the JOY edition. Click through the opening briefings and answer the requested letter of ASM. All 23 room asset sets are included; the full quest remains under development. Zurück leads to room 2; open its door and choose Gehe to enter room 3. Restart restores the startup session file.</p><details class="game-help">'));
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
  outputs.set('index.html','<!doctype html><html lang="en"><meta charset="utf-8"><title>ASM builds</title><h1>ASM — Das Spiel</h1><p><a href="asm-intro.html">Play the intro</a> · <a href="asm-intro-debug.html">Debug preview</a></p><p><a href="asm-game.html">Play the adventure development build</a> · <a href="asm-game-debug.html">Debug main game</a></p><p>All 23 room asset sets are bundled. Eighteen rooms are exercised through original puzzle input; prepared entries cover all 23. Full quest completion remains open. See report.json for compilation results.</p></html>\n');
  fs.mkdirSync(outputDirectory,{recursive:true});
  for(const [name,content]of outputs)fs.writeFileSync(path.join(outputDirectory,name),content,{flag:'wx'});
  for(const item of report)console.log(`${item.compiled?'PASS':'FAIL'} ${item.source}: ${item.error||item.instructions+' instructions'}`);
  return report;
}
if(require.main===module)try{if(process.argv.length!==3)throw Error('Usage: node tools/build_asm.js NEW_OUTPUT_DIRECTORY');build(path.resolve(process.argv[2]));}catch(error){console.error(error.message);process.exitCode=1;}
module.exports={inputs,pages,build};
