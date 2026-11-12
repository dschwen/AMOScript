'use strict';
const assert=require('assert'),path=require('path'),{pathToFileURL}=require('url');
module.exports=async function(browser){
 const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 try{
  await page.goto(pathToFileURL(path.join(__dirname,'../../demos/shared-runtime.html')).href);
  await page.evaluate(()=>{window.sharedPrograms=[];const make=AMOS_BROWSER.createCanvasHost;AMOS_BROWSER.createCanvasHost=(...a)=>{const h=make(...a);window.sharedGpu=a[1].renderer;return{...h,attach(p){sharedPrograms.push(p);return h.attach(p);}};};});
  await page.click('#play-game');await page.waitForFunction(()=>document.querySelector('#game-viewport').dataset.phase==='ended');
  assert.strictEqual(await page.evaluate(()=>sharedPrograms.length),2);assert.strictEqual(await page.locator('#game-viewport').getAttribute('data-backend'),'webgl');
  assert(await page.evaluate(()=>{const p=sharedPrograms[1],s=p.display.snapshotDisplay();sharedGpu.render(s);const a=sharedGpu.readPixels(),b=p.display.renderDisplay();return a.length===b.length&&a.every((v,i)=>v===b[i]);}));
  assert.strictEqual(requests.filter(url=>url.endsWith('/libamoscript.js')).length,1);assert.deepStrictEqual(errors,[]);await page.evaluate(()=>AMOS_GAME_PAGE.dispose());
  await page.addInitScript(()=>Object.defineProperty(globalThis,'AMOS_PAGE',{configurable:true,get:()=>({id:'incompatible-test-library'}),set(){}}));
  await page.goto(pathToFileURL(path.join(__dirname,'../../demos/shared-runtime.html')).href);
  await page.waitForFunction(()=>document.querySelector('#game-status').textContent.includes('incompatible libamoscript.js'));
  assert.strictEqual(errors.length,1);assert.match(errors[0],/Missing or incompatible libamoscript.js/);
  console.log('Shared runtime passed: one external library, linked Run, independent VMs and WebGL pixel parity.');
 }finally{await page.close();}
};
