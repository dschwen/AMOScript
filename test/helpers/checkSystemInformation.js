'use strict';
const assert=require('assert'),path=require('path'),{pathToFileURL}=require('url');
module.exports=async function(browser){
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  for(const suffix of ['','-debug','-configured']){
   await page.goto(pathToFileURL(path.join(__dirname,'../../demos/system-memory-read'+suffix+'.html')).href);
   await page.click('#play-game');
   await page.waitForFunction(()=>['error','ended'].includes(document.querySelector('#game-viewport').dataset.phase));
   if(suffix==='-configured')assert.strictEqual(await page.locator('#game-viewport').getAttribute('data-phase'),'ended');
   else{
    assert.strictEqual(await page.locator('#game-viewport').getAttribute('data-phase'),'error');
    assert.match(await page.locator('#game-status').textContent(),/ExecBase.*Advanced → AmigaOS compatibility/);
    if(suffix)assert.match(await page.locator('#game-status').textContent(),/line 1/);else assert.doesNotMatch(await page.locator('#game-status').textContent(),/at line/);
    if(suffix){const data=JSON.parse((await page.locator('[data-debug-log]').textContent()).split('\n\n')[0]);assert.deepStrictEqual(data.diagnostic,{code:'AMOS_SYSTEM_INFO_REQUIRED',operation:'Leek',address:4,width:4,field:'execBase',confidence:'known',setting:'systemInfo'});assert.strictEqual(data.location.line,1);}
    else assert.strictEqual(await page.locator('[data-debug-log]').count(),0);
   }
   await page.evaluate(()=>AMOS_GAME_PAGE.dispose());
  }
  assert.deepStrictEqual(errors,[]);console.log('System memory diagnostics passed: normal/debug pages identify ExecBase reads; explicit compatibility rebuild completes.');
 }finally{await page.close();}
};
