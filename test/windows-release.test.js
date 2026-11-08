'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const {stage}=require('../tools/stage_windows_release'),{checkRelease}=require('../tools/check_windows_release');
test('Windows release: staged production-only tools run independently with spaced paths and reject replacement/tag mismatch',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'AMOScript packaging test ')),runtime=path.join(temp,'node fixture'),output=path.join(temp,'release folder with spaces'),pkg=require('../package.json');
  try{
    fs.mkdirSync(runtime);fs.copyFileSync(process.execPath,path.join(runtime,'node.exe'));fs.writeFileSync(path.join(runtime,'LICENSE'),'Runtime fixture license\n');
    assert.throws(()=>stage(output,{tag:'v999.0.0',runtimeDirectory:runtime}),/matching package/);assert.ok(!fs.existsSync(output));
    stage(output,{tag:'v'+pkg.version,runtimeDirectory:runtime});
    assert.strictEqual(fs.readFileSync(path.join(output,'runtime/LICENSE'),'utf8'),'Runtime fixture license\n');
    const manifest=JSON.parse(fs.readFileSync(path.join(output,'release.json'),'utf8'));assert.strictEqual(manifest.packageVersion,pkg.version);
    checkRelease(output);
    fs.writeFileSync(path.join(output,'keep.txt'),'keep');assert.throws(()=>stage(output,{tag:'v'+pkg.version,runtimeDirectory:runtime}),/EEXIST/);assert.strictEqual(fs.readFileSync(path.join(output,'keep.txt'),'utf8'),'keep');
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
