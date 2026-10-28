'use strict';
const assert=require('assert');
module.exports=async function checkBobTestPlayer(page){
  await page.click('#animation-play');
  await page.waitForFunction(()=>{const d=document.getElementById('animation-player').dataset;return d.phase==='running'&&d.waiting==='key'&&d.frameAddress==='0';});
  assert.strictEqual(await page.locator('#animation-player').getAttribute('data-backend'),'webgl');
  await page.locator('#animation-input').focus();await page.keyboard.press('a');
  await page.waitForFunction(()=>{const d=document.getElementById('animation-player').dataset;return Number(d.frameAddress)>1&&Number(d.frameAddress)<500;});
  await page.click('#animation-stop');await page.waitForFunction(()=>document.getElementById('animation-player').dataset.phase==='paused');
  const frame=await page.locator('#animation-player').getAttribute('data-frame-address');await page.waitForTimeout(100);assert.strictEqual(await page.locator('#animation-player').getAttribute('data-frame-address'),frame);
  await page.click('#animation-resume');await page.waitForFunction(()=>{const d=document.getElementById('animation-player').dataset;return d.waiting==='key'&&d.frameAddress==='501';});
  await page.locator('#animation-input').focus();await page.keyboard.press('b');await page.waitForFunction(()=>document.getElementById('animation-player').dataset.phase==='ended');
  await page.click('#animation-restart');await page.waitForFunction(()=>{const d=document.getElementById('animation-player').dataset;return d.waiting==='key'&&d.frameAddress==='0';});
  await page.click('#animation-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='animation-player');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.fullscreenElement);
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.strictEqual(await page.locator('#animation-player').getAttribute('data-phase'),'disposed');
  await page.locator('#demo-checks summary').click();
};
