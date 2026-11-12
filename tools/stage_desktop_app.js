'use strict';
const fs=require('fs'),path=require('path');
function stageDesktop(){
  const root=path.resolve(__dirname,'..'),output=path.join(root,'.cache/desktop-app'),pkg=require('../package.json');
  fs.rmSync(output,{recursive:true,force:true});fs.mkdirSync(output,{recursive:true});
  const copy=relative=>{const dest=path.join(output,relative);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.cpSync(path.join(root,relative),dest,{recursive:true});};
  for(const dir of ['lib'])copy(dir);
  for(const file of ['main.js','preload.js','build-worker.js','index.html','renderer.js','style.css','icon.png'])copy('desktop/'+file);
  for(const file of ['project.js','build_project.js','build_game_page.js','gamePageRuntime.js','gamePageUI.js'])copy('tools/'+file);
  copy('LICENSE');copy('docs/desktop-builder.md');
  require('../lib/stageDependencies')(root,output);
  fs.writeFileSync(path.join(output,'package.json'),JSON.stringify({name:'amoscript-builder',version:pkg.version,main:'desktop/main.js',desktopName:'org.amoscript.builder.desktop',description:'Build browser-playable AMOS programs',author:pkg.author,license:pkg.license,dependencies:pkg.dependencies},null,2)+'\n');
  console.log('Desktop app staged without games, fixtures or development dependencies: '+output);return output;
}
if(require.main===module)stageDesktop();module.exports={stageDesktop};
