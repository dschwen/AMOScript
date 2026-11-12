'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os'),{spawnSync}=require('child_process'),{_electron}=require('playwright');
async function run(){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'AMOScript desktop ')),assets=path.join(temp,'Disk files');fs.mkdirSync(assets);fs.mkdirSync(path.join(assets,'Empty'));fs.writeFileSync(path.join(assets,'binary.dat'),Buffer.from([0,128,255]));
  const main=path.join(temp,'Main.AMOS');fs.copyFileSync(path.join(__dirname,'../examples/Test21.AMOS'),main);
  const packaged=process.env.AMOSCRIPT_DESKTOP_EXECUTABLE;const executablePath=packaged||require('../desktop/node_modules/electron'),args=process.platform==='linux'?['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[];
  if(!packaged)args.push(path.join(__dirname,'../desktop'));
  const electron=await _electron.launch({executablePath,args});
  try{
    const page=await electron.firstWindow();await page.waitForSelector('#choose-main');page.on('dialog',dialog=>dialog.accept());
    await electron.evaluate(({dialog})=>{globalThis.smokeDialogs={open:[],save:[]};dialog.showOpenDialog=async()=>{const p=globalThis.smokeDialogs.open.shift();return p?{canceled:false,filePaths:[p]}:{canceled:true,filePaths:[]};};dialog.showSaveDialog=async()=>{const p=globalThis.smokeDialogs.save.shift();return p?{canceled:false,filePath:p}:{canceled:true};};dialog.showMessageBoxSync=()=>1;});
    const choose=async value=>electron.evaluate((_electron,value)=>globalThis.smokeDialogs.open.push(value),value);
    const save=async value=>electron.evaluate((_electron,value)=>globalThis.smokeDialogs.save.push(value),value);
    assert.deepStrictEqual(await page.evaluate(()=>[typeof require,typeof amosBuilder]),['undefined','object']);
    await choose(main);await page.click('#choose-main');await page.locator('#main-path').filter({hasText:'Main.AMOS'}).waitFor();
    await choose(assets);await page.click('#add-mount');await page.getByLabel('Disk label 1',{exact:true}).fill('GAME:');await page.fill('#title','Desktop <sample>');await page.selectOption('#touch','off');await page.click('summary');await page.click('#add-extension');await page.selectOption('[aria-label="Extension library 1"]','amcaf-1.50beta4');await page.selectOption('[aria-label="Extension slot 1"]','8');await page.click('#add-extension');await page.selectOption('[aria-label="Extension library 2"]','turbo-plus-2.15');await page.selectOption('[aria-label="Extension slot 2"]','12');await page.selectOption('#systemInfo','40');await page.check('#minify');
    const projectFile=path.join(temp,'saved project.amos-project.json');await save(projectFile);await page.click('#save');await page.waitForFunction(()=>document.querySelector('#status').textContent==='Project saved.');
    const saved=JSON.parse(fs.readFileSync(projectFile));assert.strictEqual(saved.main,'Main.AMOS');assert.strictEqual(saved.mounts[0].directory,'Disk files');assert.strictEqual(saved.options.touch,'off');assert.strictEqual(saved.options.minify,true);assert.deepStrictEqual(saved.options.extensions,{8:'amcaf-1.50beta4',12:'turbo-plus-2.15'});
    await page.fill('#title','Temporary change');await choose(projectFile);await page.click('#open');await page.waitForFunction(()=>document.querySelector('#title').value==='Desktop <sample>');
    assert.strictEqual(await page.inputValue('[aria-label="Extension slot 1"]'),'8');assert.strictEqual(await page.inputValue('[aria-label="Extension library 2"]'),'turbo-plus-2.15');assert.strictEqual(await page.inputValue('#systemInfo'),'40');assert.deepStrictEqual(saved.options.systemInfo,{execVersion:40});
    fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await page.screenshot({path:path.join(__dirname,'artifacts/desktop-builder.png')});
    let next=electron.waitForEvent('window');await page.click('#build');const preview=await next;await preview.waitForSelector('#play-game');
    assert.deepStrictEqual(await preview.evaluate(()=>[typeof require,typeof amosBuilder]),['undefined','undefined']);assert.strictEqual(await preview.evaluate(()=>location.protocol),'amos-preview:');
    assert.strictEqual(await preview.evaluate(async()=>{try{await fetch('file:///etc/passwd');return false;}catch(_){return true;}}),true);
    await preview.click('#play-game');await preview.waitForFunction(()=>document.querySelector('#game-viewport').dataset.phase==='ended');
    assert.strictEqual(await preview.evaluate(()=>AMOS_GAME_PAGE.files.read('game:binary.dat').charCodeAt(2)),255);assert.strictEqual(await preview.locator('#game-touch').inputValue(),'off');assert.strictEqual(await preview.locator('.game-debug').count(),1);
    await preview.keyboard.press('Escape');await preview.close();
    const html=path.join(temp,'exported game.html');await save(html);await page.click('#export');await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Exported '));
    const expected=require('../tools/project').buildProject(require('../tools/project').loadProject(projectFile)).html;assert.strictEqual(fs.readFileSync(html,'utf8'),expected);
    await save(html);await page.click('#export');await page.waitForFunction(()=>!document.querySelector('#error').hidden);assert.match(await page.locator('#error').textContent(),/already exists/);assert.strictEqual(fs.readFileSync(html,'utf8'),expected);
    const bad=path.join(temp,'bad.AMOS');fs.writeFileSync(bad,'not an AMOS file');await choose(bad);await page.click('#choose-main');await page.click('#build');await page.waitForFunction(()=>!document.querySelector('#error').hidden);assert.match(await page.locator('#error').textContent(),/bad.AMOS/);
    const {binary,token,text}=require('./helpers/tokens'),missing=path.join(temp,'missing.AMOS');fs.writeFileSync(missing,binary([[token('Load'),text('MISSING:asset.abk')]]));await choose(missing);await page.click('#choose-main');next=electron.waitForEvent('window');await page.click('#build');const failed=await next;await failed.waitForSelector('#play-game');await failed.click('#play-game');await page.waitForFunction(()=>/missing:asset.abk/i.test(document.querySelector('#error').textContent),null,{timeout:15000});await failed.close();
    const versionCheck=path.join(temp,'version-check.AMOS');fs.writeFileSync(versionCheck,require('./helpers/systemInformationFixture')());
    await choose(versionCheck);await page.click('#choose-main');await page.selectOption('#systemInfo','');
    next=electron.waitForEvent('window');await page.click('#build');const needsProfile=await next;await needsProfile.waitForSelector('#play-game');await needsProfile.click('#play-game');
    await page.locator('#configure-system-info').waitFor({state:'visible'});await page.locator('#configure-system-info').click();
    assert.strictEqual(await page.locator('#systemInfo').evaluate(n=>document.activeElement===n&&n.closest('details').open),true);
    assert.strictEqual(await page.inputValue('#systemInfo'),'');await needsProfile.keyboard.press('Escape');await needsProfile.close();
    await page.selectOption('#systemInfo','40');next=electron.waitForEvent('window');await page.click('#build');const fixedProfile=await next;await fixedProfile.waitForSelector('#play-game');await fixedProfile.click('#play-game');await fixedProfile.waitForFunction(()=>document.querySelector('#game-viewport').dataset.phase==='ended');await fixedProfile.close();
    assert(await page.locator('#configure-system-info').isHidden());
    const cliOutput=path.join(temp,'CLI.html'),cli=spawnSync(process.execPath,[path.join(__dirname,'../tools/build_project.js'),projectFile,cliOutput],{encoding:'utf8'});assert.strictEqual(cli.status,0,cli.stderr);assert.strictEqual(fs.readFileSync(cliOutput,'utf8'),expected);
    console.log('Desktop smoke passed: native dialog workflow, disk import, relative save/reopen, sandboxed preview, runtime errors, exact CLI/GUI export, touch options and overwrite protection.');
  }finally{await electron.close();fs.rmSync(temp,{recursive:true,force:true});}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
