'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
module.exports=async function(browser){
 const root=path.join(__dirname,'../../demos'),manifest=JSON.parse(fs.readFileSync(path.join(root,'amcaf-examples-manifest.json'))),page=await browser.newPage({viewport:{width:1000,height:900}}),errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,route=>{network.push(route.request().url());return route.abort();});
 try{
  assert.strictEqual(manifest.programs.length,12);const catalogue=fs.readFileSync(path.join(root,'amcaf-examples.md'),'utf8');
  for(const item of manifest.programs)assert(catalogue.includes('https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/'+item.file));
  for(const p of manifest.programs){if(p.compiled)continue;await page.goto(pathToFileURL(path.join(root,p.file)).href);assert.strictEqual(await page.locator('pre').textContent(),p.error);assert.strictEqual(await page.locator('#play-game').count(),0);}
  const q=manifest.programs.find(p=>p.source==='QsinCosArcSqr.AMOS');assert(q.compiled);
  await page.goto(pathToFileURL(path.join(root,q.file)).href);
  await page.evaluate(()=>{const make=AMOS_BROWSER.createCanvasHost;AMOS_BROWSER.createCanvasHost=(...args)=>{const h=make(...args);return{...h,attach(p){window.mathsProgram=p;return h.attach(p);}};};});
  await page.click('#play-game');await page.waitForFunction(()=>window.mathsProgram?.state.variables.int_mx===160&&document.getElementById('game-viewport').dataset.phase==='running');
  const rect=await page.locator('#game-input').boundingBox();await page.mouse.move(rect.x+rect.width*.75,rect.y+rect.height*.5);
  await page.waitForFunction(()=>Math.abs(window.mathsProgram.state.variables.int_dx-80)<=1&&Math.abs(window.mathsProgram.state.variables.int_dy)<=1);
  assert.strictEqual(await page.locator('#game-viewport').getAttribute('data-backend'),'webgl');
  if(await page.evaluate(()=>!!document.fullscreenElement)){await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.fullscreenElement);}
  await page.locator('#game-input').focus();await page.keyboard.press('Escape');await page.waitForFunction(()=>document.getElementById('game-viewport').dataset.phase==='ended');
  await page.locator('#game-restart').evaluate(node=>node.click());await page.waitForFunction(()=>document.getElementById('game-viewport').dataset.phase==='running');
  await page.locator('#game-stop').evaluate(node=>node.click());assert.strictEqual(await page.locator('#game-viewport').getAttribute('data-phase'),'stopped');
  await page.evaluate(()=>AMOS_GAME_PAGE.dispose());assert.deepStrictEqual(errors,[]);assert.deepStrictEqual(network,[]);
  console.log('AMCAF examples passed: 12 catalogue entries/preview links, honest blocker pages and original quick-maths mouse/exit/restart with WebGL. Other programs remain blocked.');
 }finally{await page.close();}
};
