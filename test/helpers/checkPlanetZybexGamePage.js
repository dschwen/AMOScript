'use strict';
const assert=require('assert'),path=require('path');
module.exports=async function(page){
  assert.strictEqual(await page.locator('#play-game').isVisible(),true);assert.strictEqual(await page.locator('#demo-checks').evaluate(n=>n.open),false);assert.strictEqual(await page.locator('.game-debug').count(),0);assert.strictEqual(await page.locator('[data-debug-log]').count(),0);
  await page.evaluate(()=>{
    const Original=window.AudioContext;globalThis.ZYBEX_PAGE_CONTEXTS=[];
    window.AudioContext=function(...args){const context=new Original(...args);globalThis.ZYBEX_PAGE_CONTEXTS.push(context);return context;};window.AudioContext.prototype=Original.prototype;
  });
  await page.click('#play-game');
  await page.waitForFunction(()=>{const d=document.getElementById('game-viewport').dataset;return d.phase==='running'&&d.sound==='on'&&d.backend==='webgl';});
  assert.strictEqual(await page.evaluate(()=>document.fullscreenElement.id),'game-viewport');assert.strictEqual(await page.locator('#results').textContent(),'');
  assert.strictEqual(await page.evaluate(()=>document.body.dataset.status||'idle'),'idle');
  await page.locator('#game-input').evaluate(n=>n.dataset.originalCanvas='retained');
  await page.keyboard.down('ArrowRight');await page.keyboard.down('ControlLeft');
  await page.waitForFunction(()=>AMOS_GAME_PAGE.joystickStatus().some(p=>p.port===1&&p.mask===24));
  await page.keyboard.up('ControlLeft');await page.keyboard.up('ArrowRight');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.fullscreenElement);
  for(const action of ['stop','resume','restart'])assert.strictEqual(await page.locator(`#game-${action} svg`).count(),1);
  await page.click('#game-stop');await page.waitForFunction(()=>document.getElementById('game-viewport').dataset.phase==='stopped');
  assert.ok(await page.evaluate(()=>AMOS_GAME_PAGE.joystickStatus().every(p=>p.mask===0)));
  const before=await page.locator('#game-input').evaluate(c=>c.toDataURL());await page.waitForTimeout(80);assert.strictEqual(await page.locator('#game-input').evaluate(c=>c.toDataURL()),before);
  await page.click('#game-resume');await page.waitForFunction(()=>document.getElementById('game-viewport').dataset.phase==='running');
  await page.click('#play-game');await page.waitForFunction(()=>!!document.fullscreenElement);assert.strictEqual(await page.locator('#game-input').getAttribute('data-original-canvas'),'retained');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.fullscreenElement);
  await page.click('#game-restart');await page.waitForFunction(()=>document.getElementById('game-viewport').dataset.phase==='running');assert.strictEqual(await page.locator('#game-input').getAttribute('data-original-canvas'),null);assert.strictEqual(await page.evaluate(()=>ZYBEX_PAGE_CONTEXTS.length),1);
  await page.click('#game-sound');await page.waitForFunction(()=>document.getElementById('game-viewport').dataset.sound==='off');await page.click('#game-sound');await page.waitForFunction(()=>document.getElementById('game-viewport').dataset.sound==='on');
  await page.screenshot({path:path.join(__dirname,'../artifacts/planet-zybex-game-page.png'),fullPage:true});
  await page.evaluate(()=>AMOS_GAME_PAGE.dispose());await page.waitForFunction(()=>ZYBEX_PAGE_CONTEXTS.every(c=>c.state==='closed')&&!document.fullscreenElement);
  assert.deepStrictEqual(await page.evaluate(()=>AMOS_GAME_PAGE.joystickStatus()),[]);await page.locator('#demo-checks summary').click();
};
