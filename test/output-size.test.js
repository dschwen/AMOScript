'use strict';
const assert=require('assert'),vm=require('vm'),fs=require('fs'),path=require('path'),{spawnSync}=require('child_process'),T=require('../lib/Transpiler');
const {binary,token:t,integer:n,text}=require('./helpers/tokens');
function factory(source){const sandbox={module:{exports:{}},setTimeout,clearTimeout};vm.runInNewContext(source,sandbox);return sandbox.module.exports;}
test('Emission size options: regular/minified/optimized programs preserve execution, public methods and optional diagnostics',()=>{
 const bytes=fs.readFileSync(path.join(__dirname,'../examples/Test21.AMOS')),compiler=new T(bytes),baseline=compiler.toModule();let expected;
 for(const options of [{debug:true},{debug:false},{debug:false,minify:true,optimize:true},{debug:true,minify:true}]){
  const source=compiler.toModule(options),logs=[],p=factory(source)({print:v=>logs.push(v)});p.tick(10000);
  if(!expected)expected=logs;else assert.deepStrictEqual(logs,expected);
  assert.strictEqual(typeof p.setMouse,'function');assert.strictEqual(typeof p.stop,'function');assert.strictEqual(!!p.state.location,options.debug);
  if(!options.debug)assert(!/state.location = \{"line"/.test(source));
  if(options.minify)assert(source.length<baseline.length*.8);
 }
 const failing=binary([[t('Print'),t('Leek'),t('('),n(4),t(')')]]);
 for(const debug of [false,true])for(const minify of [false,true]){
  const p=factory(new T(failing).toModule({debug,minify}))();assert.throws(()=>p.tick(100),e=>e.code==='AMOS_SYSTEM_INFO_REQUIRED'&&/at line 1/.test(e.message)===debug);
 }
});
test('Emission size options: DATA errors and terminal host requests work without source locations',()=>{
 const bytes=binary([[t('Data'),require('./helpers/tokens').word(0),n(9)],[t('Read'),require('./helpers/tokens').identifier('a')],[t('Edit')]]);
 for(const debug of [false,true]){
  const calls=[],p=factory(new T(bytes).toModule({debug}))({system:{command:(name,request)=>calls.push([name,request])}});p.tick(100);
  assert.strictEqual(p.state.variables.int_a,9);assert.strictEqual(calls[0][0],'Edit');assert.strictEqual(!!calls[0][1].location,debug);
 }
});
test('Emission size options: CLI regular default and debug/minify flags preserve executable modules',()=>{
 for(const flags of [[],['--debug','--minify']]){
  const r=spawnSync(process.execPath,[path.join(__dirname,'../bin/amoscript'),...flags,path.join(__dirname,'../examples/Test21.AMOS')],{encoding:'utf8'});assert.strictEqual(r.status,0,r.stderr);const p=factory(r.stdout)();p.tick(10000);assert.strictEqual(!!p.state.location,flags.includes('--debug'));
 }
});
