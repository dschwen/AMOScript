'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os'),vm=require('vm'),{spawnSync}=require('child_process'),T=require('../lib/Transpiler'),{buildGameBundle,buildRuntimeLibrary}=require('../tools/build_game_page'),write=require('../lib/writeArtifacts');
const {binary,token:t,integer:n,text,word:w}=require('./helpers/tokens');
function moduleValue(source,library){const context={module:{exports:{}},setTimeout,clearTimeout,require:name=>{assert.strictEqual(name,'./libamoscript.js');return library;}};vm.runInNewContext(source,context);return context.module.exports;}
test('Shared runtime: multiple compiled factories share code with isolated state and keep extension support',()=>{
 const library=moduleValue(T.runtimeSource()),source=fs.readFileSync(path.join(__dirname,'../examples/Test21.AMOS')),compiler=new T(source),code=compiler.toModule({runtime:'shared',debug:false});
 assert(!code.includes('function createProgram('));assert(code.length<10000);const a=moduleValue(code,library)(),b=moduleValue(code,library)();a.tick(1000);assert(!b.state.halted);assert.notStrictEqual(a.state,b.state);b.tick(1000);assert(b.state.halted);
 assert.throws(()=>moduleValue(code,{...library,abi:'wrong'}),/incompatible/);
 const bankCreate=moduleValue(new T(binary([[t('Wait Key')]])).toModule({runtime:'shared'}),library),x=bankCreate(),y=bankCreate();
 try{x.tick(10);y.tick(10);x.reserveWork(1,4);y.reserveWork(1,4);const address=x.bankStart(1);assert.strictEqual(y.bankStart(1),address);x.poke(address,77);assert.strictEqual(y.peek(address),0);x.eraseBank(1);assert.strictEqual(y.peek(address),0);assert.throws(()=>x.peek(address),/retired/);}
 finally{x.stop();y.stop();}

 const bytes=binary([[t('Print'),w(0x4e),[8,0],w(0x02f0),t('('),text('dir/file'),t(')')],[t('End')]]),c=new T(bytes,{extensions:{8:'amcaf-1.50beta4'}}),logs=[];
 moduleValue(c.toModule({runtime:'shared'}),library)({print:v=>logs.push(v)}).tick(100);assert.deepStrictEqual(logs,['file']);
 assert.throws(()=>compiler.toModule({runtime:'minimal'}),/planned/);assert.throws(()=>compiler.toModule({runtime:'bad'}),/Runtime/);
});
test('Shared runtime: artifacts are source-independent and never overwrite differing files or partial exports',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'AMOS shared artifacts '));try{
  const a=buildGameBundle(fs.readFileSync(path.join(__dirname,'../examples/Test21.AMOS')),{runtime:'shared'}),b=buildGameBundle(fs.readFileSync(path.join(__dirname,'../examples/Graphics.AMOS')),{runtime:'shared'});
  assert.strictEqual(a.files['libamoscript.js'],b.files['libamoscript.js']);assert(!a.files['libamoscript.js'].includes('Shared runtime fixture'));
  write(path.join(temp,'a.html'),a.html,a.files);write(path.join(temp,'b.html'),b.html,b.files);assert(fs.existsSync(path.join(temp,'libamoscript.js')));
  assert.throws(()=>write(path.join(temp,'a.html'),'replace',a.files),/exists/);
  assert.throws(()=>write(path.join(temp,'c.html'),'new',{'libamoscript.js':'different'}),/differs/);assert(!fs.existsSync(path.join(temp,'c.html')));
  assert.throws(()=>write(path.join(temp,'libamoscript.js'),a.html,a.files),/conflicts/);
  const separate=path.join(temp,'rollback');fs.mkdirSync(separate);const original=fs.writeFileSync;let writes=0;
  try{fs.writeFileSync=(...args)=>{if(++writes===2)throw Error('simulated disk failure');return original(...args);};assert.throws(()=>write(path.join(separate,'index.html'),a.html,a.files),/simulated/);}
  finally{fs.writeFileSync=original;}
  assert.deepStrictEqual(fs.readdirSync(separate),[]);

 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('Shared runtime: compiler CLI emits an independently executable module and adjacent library',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'AMOS shared CLI '));try{
  const output=path.join(temp,'program.js'),r=spawnSync(process.execPath,[path.join(__dirname,'../bin/amoscript'),'--runtime','shared','--minify',path.join(__dirname,'../examples/Test21.AMOS'),output],{encoding:'utf8'});assert.strictEqual(r.status,0,r.stderr);
  const run=spawnSync(process.execPath,['-e',`require(${JSON.stringify(output)})({setTimeout}).tick(1000)`],{cwd:temp,encoding:'utf8'});assert.strictEqual(run.status,0,run.stderr);assert.match(run.stdout,/Start[\s\S]*End/);
  assert(fs.existsSync(path.join(temp,'libamoscript.js')));
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
