'use strict';
// Assemble an explicit compiler/page-builder distribution, not a repository dump.
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');
function stage(output,{tag,runtimeDirectory}={}){
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  if(!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(tag||'')||tag!=='v'+pkg.version)throw Error('Release tag must be v'+pkg.version+' (matching package.json)');
  if(!runtimeDirectory)throw Error('A Node runtime directory containing node.exe and LICENSE is required');
  const runtime=path.resolve(runtimeDirectory),exe=path.join(runtime,'node.exe'),license=path.join(runtime,'LICENSE');
  for(const file of [exe,license])if(!fs.statSync(file).isFile())throw Error('Missing runtime file: '+file);
  const version=spawnSync(exe,['--version'],{encoding:'utf8'});
  if(version.error||version.status!==0||!/^v\d+\.\d+\.\d+\s*$/.test(version.stdout||''))throw Error('Cannot execute the supplied Node runtime');
  const destination=path.resolve(output);fs.mkdirSync(destination); // Exclusive: never merge into an older release.
  const copy=(from,to=from)=>{const target=path.join(destination,to);fs.mkdirSync(path.dirname(target),{recursive:true});fs.cpSync(path.join(root,from),target,{recursive:true});};
  try{
    for(const folder of ['lib','bin'])copy(folder);
    for(const file of ['build_game_page.js','gamePageRuntime.js','gamePageUI.js','project.js','build_project.js'])copy('tools/'+file);
    for(const file of ['Test21.AMOS','Graphics.AMOS'])copy('examples/'+file);
    copy('docs/quick-start.md');copy('LICENSE');copy('package.json');copy('package-lock.json');
    const dependency=path.dirname(require.resolve('binary-search-bounds/package.json'));
    fs.cpSync(dependency,path.join(destination,'node_modules/binary-search-bounds'),{recursive:true});
    fs.mkdirSync(path.join(destination,'runtime'));fs.copyFileSync(exe,path.join(destination,'runtime/node.exe'));fs.copyFileSync(license,path.join(destination,'runtime/LICENSE'));
    const batch=(name,script)=>fs.writeFileSync(path.join(destination,name),'@echo off\r\n"%~dp0runtime\\node.exe" '+(script?'"%~dp0'+script+'" ':'')+'%*\r\nexit /b %errorlevel%\r\n');
    batch('amoscript.cmd','bin\\amoscript');batch('build-page.cmd','tools\\build_game_page.js');batch('node.cmd','');batch('build-project.cmd','tools\\build_project.js');
    fs.writeFileSync(path.join(destination,'START-HERE.txt'),`AMOScript ${tag} - Windows x64 portable compiler\r\n\r\nExtract the entire ZIP before running. No Git, Node installation, npm install or Python is needed.\r\nOpen a terminal in this folder and run:\r\n  .\\amoscript.cmd examples\\Test21.AMOS program.js\r\n  .\\node.cmd -e "require('./program.js')({ setTimeout }).tick(1000)"\r\n  .\\build-page.cmd examples\\Graphics.AMOS graphics.html\r\nOpen graphics.html in a modern browser and click Play Game.\r\n\r\nSee docs/quick-start.md for instructions and troubleshooting.\r\nThis archive contains the tools and two samples; full games/development fixtures are not included.\r\nFull source and documentation: https://github.com/dschwen/AMOScript/tree/${tag}\r\nCompiler license: LICENSE. Bundled Node license/notices: runtime/LICENSE.\r\nProduction dependency license: node_modules/binary-search-bounds/LICENSE.\r\nNode ${version.stdout.trim()}: https://nodejs.org/dist/${version.stdout.trim()}/\r\n`);
    fs.writeFileSync(path.join(destination,'release.json'),JSON.stringify({tag,packageVersion:pkg.version,target:'windows-x64',nodeVersion:version.stdout.trim()},null,2)+'\n');
    return destination;
  }catch(error){fs.rmSync(destination,{recursive:true,force:true});throw error;}
}
if(require.main===module)try{const [output,runtimeDirectory,tag]=process.argv.slice(2);if(!output||!runtimeDirectory||!tag)throw Error('Usage: node tools/stage_windows_release.js output-directory runtime-directory vX.Y.Z');console.log(stage(output,{runtimeDirectory,tag}));}catch(error){console.error(error.message);process.exitCode=1;}
module.exports={stage};
