'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert'),{spawnSync}=require('child_process');
function checkRelease(directory){
  const root=path.resolve(directory),node=path.join(root,'runtime/node.exe'),work=fs.mkdtempSync(path.join(os.tmpdir(),'AMOScript release smoke '));
  const run=(command,args,expected=0,options={})=>{const result=spawnSync(command,args,{cwd:work,encoding:'utf8',...options});if(result.error)throw result.error;assert.strictEqual(result.status,expected,result.stderr||result.stdout);return result;};
  const tool=(name,args,expected=0)=>{
    if(process.platform!=='win32')return run(node,[path.join(root,name==='amoscript'?'bin/amoscript':name==='project'?'tools/build_project.js':'tools/build_game_page.js'),...args],expected);
    const command='"'+[path.join(root,name==='amoscript'?'amoscript.cmd':name==='project'?'build-project.cmd':'build-page.cmd'),...args].map(value=>'"'+value+'"').join(' ')+'"';
    return run('cmd.exe',['/d','/s','/c',command],expected,{windowsVerbatimArguments:true});
  };
  try{
    const info=JSON.parse(fs.readFileSync(path.join(root,'release.json'),'utf8'));assert.strictEqual(run(node,['--version']).stdout.trim(),info.nodeVersion);
    assert.ok(fs.statSync(path.join(root,'runtime/LICENSE')).size>0);assert.ok(fs.statSync(path.join(root,'LICENSE')).size>0);assert.ok(fs.statSync(path.join(root,'node_modules/binary-search-bounds/LICENSE')).size>0);
    for(const excluded of ['.git','asm_neu','demos','test','examples/ASM','examples/Roller2','node_modules/playwright'])assert.ok(!fs.existsSync(path.join(root,excluded)),excluded+' must not be bundled');
    const input=path.join(work,'sample input.AMOS'),output=path.join(work,'compiled output.js');fs.copyFileSync(path.join(root,'examples/Test21.AMOS'),input);
    tool('amoscript',['--help']);tool('amoscript',[input,output,'--minify']);
    const text=run(node,['-e',`require(${JSON.stringify(output)})({ setTimeout }).tick(1000)`]).stdout.trim().split(/\r?\n/);assert.deepStrictEqual(text,['Start','One','Two','Three','End']);
    const original=fs.readFileSync(output);assert.match(tool('amoscript',[input,output],1).stderr,/Refusing to overwrite/);assert.deepStrictEqual(fs.readFileSync(output),original);
    const html=path.join(work,'browser sample.html');tool('page',[path.join(root,'examples/Graphics.AMOS'),html,'--minify','--title','Release smoke sample']);assert.match(fs.readFileSync(html,'utf8'),/Play Game/);assert.match(fs.readFileSync(html,'utf8'),/Release smoke sample/);
    const projectFile=path.join(work,'sample.amos-project.json');fs.writeFileSync(projectFile,JSON.stringify({version:1,main:path.join(root,'examples/Graphics.AMOS'),mounts:[]}));tool('project',[projectFile,path.join(work,'project.html')]);
    if(process.platform==='win32'){
      const result=run('cmd.exe',['/d','/s','/c','""'+path.join(root,'node.cmd')+'" --version"'],0,{windowsVerbatimArguments:true});assert.strictEqual(result.stdout.trim(),info.nodeVersion);
    }
    console.log('Windows release smoke passed: bundled Node, production-only tools, quoted paths, compilation/execution, overwrite refusal and HTML build.');
  }finally{fs.rmSync(work,{recursive:true,force:true});}
}
if(require.main===module)try{if(process.argv.length!==3)throw Error('Usage: node tools/check_windows_release.js extracted-release-directory');checkRelease(process.argv[2]);}catch(error){console.error(error.stack);process.exitCode=1;}
module.exports={checkRelease};
