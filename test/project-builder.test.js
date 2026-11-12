'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os'),{spawnSync}=require('child_process'),project=require('../tools/project');
function fixture(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'AMOScript project '));try{const assets=path.join(dir,'disk');fs.mkdirSync(assets);fs.mkdirSync(path.join(assets,'Empty'));fs.mkdirSync(path.join(assets,'Levels'));fs.writeFileSync(path.join(assets,'Levels/One'),Buffer.from([0,128,255]));fs.copyFileSync(path.join(__dirname,'../examples/Graphics.AMOS'),path.join(dir,'Main.AMOS'));return fn({dir,assets,p:{version:1,main:path.join(dir,'Main.AMOS'),mounts:[{label:'game:',directory:assets}],options:{title:'A <game>',touch:'off',optimize:true}}});}finally{fs.rmSync(dir,{recursive:true,force:true});}}
test('Project builder: binary volume aliases, empty directories and relative saved projects round-trip into identical CLI/GUI exports',()=>fixture(({dir,assets,p})=>{
  p.mounts.push({label:'DATA:',directory:assets});const collected=project.collect(p);assert.deepStrictEqual(Object.keys(collected.assets),['game:levels/one','data:levels/one']);assert.strictEqual(collected.assets['game:levels/one'],'AID/');assert.ok(collected.directories.includes('GAME:Empty/'));
  const filename=path.join(dir,'sample.amos-project.json');project.saveProject(filename,p);const json=JSON.parse(fs.readFileSync(filename));assert.strictEqual(json.main,'Main.AMOS');assert.strictEqual(json.mounts[0].directory,'disk');
  project.saveProject(filename,p);assert.throws(()=>project.saveProject(p.main,p),/not an AMOScript project/);
  const loaded=project.loadProject(filename);assert.strictEqual(loaded.mounts[0].label,'GAME:');assert.strictEqual(loaded.main,p.main);
  const result=project.buildProject(loaded);assert.strictEqual(result.stats.files,2);assert.strictEqual(result.stats.bytes,6);assert.match(result.html,/A &lt;game&gt;/);assert.match(result.html,/"touch":"off"/);
  const output=path.join(dir,'game.html'),cli=spawnSync(process.execPath,[path.join(__dirname,'../tools/build_project.js'),filename,output],{encoding:'utf8'});assert.strictEqual(cli.status,0,cli.stderr);assert.strictEqual(fs.readFileSync(output,'utf8'),result.html);assert.throws(()=>project.exportHTML(output,'replaced'),/EEXIST/);assert.strictEqual(fs.readFileSync(output,'utf8'),result.html);
}));
test('Project builder: invalid schemas, conflicting labels, case collisions and import limits reject before export',()=>fixture(({dir,assets,p})=>{
  assert.throws(()=>project.normalize({...p,version:2}),/version/);assert.throws(()=>project.normalize({...p,options:{unknown:true}}),/Unknown option/);assert.throws(()=>project.normalize({...p,options:null}),/object/);assert.throws(()=>project.normalize({...p,options:{debug:'yes'}}),/boolean/);assert.throws(()=>project.normalize({...p,mounts:[...p.mounts,{label:'GAME:',directory:assets}]}),/Duplicate disk/);assert.throws(()=>project.normalize({...p,mounts:[{label:'../bad:',directory:assets}]}),/Disk labels/);
  assert.throws(()=>project.collect(p,{maxBytes:2}),/byte|MiB/);assert.throws(()=>project.collect(p,{maxFiles:0}),/files/);
  fs.writeFileSync(path.join(assets,'Levels/one'),'collision');if(fs.readdirSync(path.join(assets,'Levels')).length===2)assert.throws(()=>project.collect(p),/Conflicting AMOS path/);
}));
test('Project builder: links are not followed, plain relative paths work and compile errors retain source locations',()=>fixture(({dir,assets,p})=>{
  const relative=project.collect({...p,mounts:[{label:'',directory:assets}]});assert.strictEqual(relative.assets['levels/one'],'AID/');
  if(process.platform!=='win32'){fs.symlinkSync(path.join(dir,'Main.AMOS'),path.join(assets,'link'));assert.throws(()=>project.collect(p),/links/);fs.unlinkSync(path.join(assets,'link'));}
  fs.writeFileSync(p.main,'invalid AMOS');assert.throws(()=>project.buildProject(p),/Main.AMOS:/);
  const preview=project.buildProject({...p,main:path.join(__dirname,'../examples/Graphics.AMOS'),mounts:[],options:{debug:false}},{preview:true});assert.ok(preview.html.includes(', true, (function installGamePageUI'));
}));

test('Project builder: decomposed macOS filenames map to canonical AMOS names without changing source files',()=>fixture(({assets,p})=>{
  const name='Menu\u0308.dat';fs.writeFileSync(path.join(assets,name),'accent');const imported=project.collect({...p,mounts:[{label:'Disk 1.0:',directory:assets}]});assert.strictEqual(imported.assets['disk 1.0:menü.dat'],Buffer.from('accent').toString('base64'));assert.ok(fs.existsSync(path.join(assets,name)));
}));

test('Project builder: explicit Exec profile and extension selections round-trip and reach the emitted page',()=>fixture(({dir,p})=>{
 p.options.extensions={8:'amcaf-1.50beta4',12:'turbo-plus-2.15'};p.options.systemInfo={execVersion:40};
 const filename=path.join(dir,'compatibility.json');project.saveProject(filename,p);const loaded=project.loadProject(filename);
 assert.deepStrictEqual(loaded.options.extensions,p.options.extensions);assert.deepStrictEqual(loaded.options.systemInfo,{execVersion:40});
 assert.match(project.buildProject(loaded).html,/"systemInfo":\{"execVersion":40\}/);
 assert.strictEqual(project.normalize({...p,options:{}}).options.systemInfo,null);
 for(const systemInfo of [{},[],{execVersion:-1},{execVersion:40,extra:true}])assert.throws(()=>project.normalize({...p,options:{systemInfo}}),/systemInfo/);
 const normalized=project.normalize(p);p.options.systemInfo.execVersion=1;assert.strictEqual(normalized.options.systemInfo.execVersion,40);
}));
