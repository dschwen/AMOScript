'use strict';
const assert=require('assert'),path=require('path'),{pathToFileURL}=require('url'),crypto=require('crypto');
const hash=b=>crypto.createHash('sha256').update(Buffer.from(b)).digest('hex');
module.exports=async function(page,root){
 const devices=require('../fixtures/amcaf/gameports.json'),animation=require('../fixtures/amcaf/bzoom.json');
 await page.goto(pathToFileURL(path.join(root,'amcaf-example-gameports.html')).href);
 await page.evaluate(()=>{
  window.testPads=Array.from({length:2},()=>({connected:true,mapping:'standard',axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false}))}));Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>testPads});
  const make=AMOS_BROWSER.createCanvasHost;AMOS_BROWSER.createCanvasHost=(...args)=>{const host=make(...args);window.devicesGpu=args[1].renderer;return{...host,attach(p){window.devices=p;return host.attach(p);}};};
 });
 await page.click('#play-game');await page.waitForFunction(()=>window.devices?.state.variables.int_lowlevel===1&&devices.state.variables.int_i===19);
 assert.strictEqual(await page.locator('#game-viewport').getAttribute('data-backend'),'webgl');
 if(await page.evaluate(()=>!!document.fullscreenElement)){await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.fullscreenElement);}
 const crop=async(x,y,w,h)=>page.evaluate(({x,y,w,h})=>{const s=devices.display.screen(0),out=[];for(let row=0;row<h;row++)out.push(...s.physicalPixels.slice((y+row)*320+x,(y+row)*320+x+w));return out;},{x,y,w,h});
 for(let port=0;port<4;port++)assert.strictEqual(hash(await crop(port*80,132,80,68)),devices.joysticks[0]);
 const parity=()=>page.evaluate(()=>{const s=devices.display.snapshotDisplay(),r=devicesGpu.render(s),a=devicesGpu.readPixels(),b=devices.display.renderDisplay();return r.backend==='gpu'&&a.length===b.length&&a.every((v,i)=>v===b[i]);});assert(await parity());
 for(const {mask,sha256}of devices.pads){await page.evaluate(mask=>{const indices=[0,1,3,2,4,5,9];testPads[0].buttons.forEach(b=>b.pressed=false);indices.forEach((button,bit)=>testPads[0].buttons[button].pressed=!!(mask&(1<<bit)));},mask);await page.waitForTimeout(90);assert.strictEqual(hash(await crop(24,83,128,47)),sha256,'Gamepad buttons '+mask);}
 await page.evaluate(()=>{testPads[0].axes=[-1,0];testPads[0].buttons[0].pressed=true;});
 await page.locator('#game-input').focus();await page.keyboard.down('ArrowUp');await page.keyboard.down('Space');
 await page.locator('[data-device="0"][data-direction="fire"]').dispatchEvent('pointerdown',{pointerId:701});await page.locator('[data-device="1"][data-direction="right"]').dispatchEvent('pointerdown',{pointerId:702});
 await page.waitForTimeout(90);for(const [port,mask]of [20,16,17,8].entries())assert.strictEqual(hash(await crop(port*80,132,80,68)),devices.joysticks[mask]);assert(await parity());
 await page.keyboard.up('ArrowUp');await page.keyboard.up('Space');await page.evaluate(()=>{document.dispatchEvent(new PointerEvent('pointerup',{pointerId:701}));document.dispatchEvent(new PointerEvent('pointerup',{pointerId:702}));});
 const before=await page.evaluate(()=>devices.extensionXSmouse());await page.locator('[data-device="-1"][data-direction="right"]').dispatchEvent('pointerdown',{pointerId:703});await page.waitForTimeout(80);await page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointerup',{pointerId:703})));assert(await page.evaluate(before=>devices.extensionXSmouse()>before,before));
 await page.locator('[data-device="0"][data-direction="fire"]').dispatchEvent('pointerdown',{pointerId:704});await page.locator('#game-stop').evaluate(n=>n.click());assert.strictEqual(await page.evaluate(()=>devices.extensionPjoy(0)),0);await page.locator('#game-resume').evaluate(n=>n.click());
 await page.locator('#game-input').focus();await page.keyboard.press('Escape');await page.waitForFunction(()=>document.getElementById('game-viewport').dataset.phase==='ended');await page.evaluate(()=>AMOS_GAME_PAGE.dispose());
 await page.goto(pathToFileURL(path.join(root,'amcaf-example-bzoomanimplayer.html')).href);
 await page.evaluate(()=>{const make=AMOS_BROWSER.createCanvasHost;AMOS_BROWSER.createCanvasHost=(...args)=>{const host=make(...args),gpu=args[1].renderer;return{...host,attach(p){window.animation=p;window.animationFrames=0;window.animationSamples=[];const swap=p.display.swap;p.display.swap=(...values)=>{swap(...values);if(!p.display.screens.has(1))return;const index=animationFrames++;if([0,1,20,41,42,80].includes(index)){const r=gpu.render(p.display.snapshotDisplay()),a=gpu.readPixels(),b=p.display.renderDisplay();animationSamples.push({index,pixels:Array.from(p.display.screen(1).physicalPixels),gpu:r.backend==='gpu'&&a.length===b.length&&a.every((v,i)=>v===b[i])});}};return host.attach(p);}};};});
 await page.click('#play-game');await page.waitForFunction(()=>window.animationFrames>=90);assert.strictEqual(await page.locator('#game-viewport').getAttribute('data-backend'),'webgl');
 const samples=await page.evaluate(()=>animationSamples);assert.strictEqual(samples.length,6);for(const s of samples){assert.strictEqual(hash(s.pixels),animation.application[s.index]);assert(s.gpu,'Bzoom GPU '+s.index);}
 await page.locator('#game-stop').evaluate(n=>n.click());const paused=await page.evaluate(()=>animationFrames);await page.waitForTimeout(60);assert.strictEqual(await page.evaluate(()=>animationFrames),paused);await page.locator('#game-resume').evaluate(n=>n.click());await page.waitForFunction(before=>animationFrames>before,paused);
 if(await page.evaluate(()=>!!document.fullscreenElement)){await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.fullscreenElement);}
 await page.locator('#game-input').focus();await page.keyboard.press('Escape');await page.waitForFunction(()=>document.getElementById('game-viewport').dataset.phase==='ended');assert.strictEqual(await page.locator('#game-viewport').getAttribute('data-source-error'),'');await page.evaluate(()=>AMOS_GAME_PAGE.dispose());
 console.log('AMCAF devices passed: original GamePorts seven-button gamepads, keyboard/parallel input, second-mouse movement, cleanup and GPU parity; original Bzoom has six independent/GPU frames across natural loops, pause/resume and exit.');
};
