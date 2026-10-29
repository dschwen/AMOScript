'use strict';
const assert = require('assert'), path = require('path');
module.exports = async function checkPlanetZybexPreview(page) {
  assert.strictEqual(await page.locator('#zybex-level').isVisible(), true);
  assert.strictEqual(await page.locator('#demo-checks').evaluate(node => node.open), false);
  assert.strictEqual(await page.locator('#play-game').count(), 0);
  assert.strictEqual(await page.locator('#results').textContent(), '');
  assert.strictEqual(await page.locator('#planet-zybex-preview').getAttribute('data-backend'), 'webgl');
  for (let level = 1; level <= 7; level++) {
    await page.selectOption('#zybex-level', String(level));
    const limit = level % 2 ? '640' : '480'; assert.strictEqual(await page.locator('#zybex-scroll').getAttribute('max'), limit);
    await page.locator('#zybex-scroll').evaluate((node, value) => { node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); }, limit);
    assert.strictEqual(await page.locator('#planet-zybex-preview').getAttribute('data-level'), String(level));
    assert.strictEqual(await page.locator('#planet-zybex-preview').getAttribute('data-scroll'), limit);
  }
  await page.selectOption('#zybex-level', 'score');
  await page.waitForFunction(()=>document.getElementById('planet-zybex-preview').dataset.score==='1234');
  assert.strictEqual(await page.locator('#zybex-scroll').isDisabled(),true);
  await page.locator('#zybex-preview-input').focus();await page.keyboard.press('a');
  await page.waitForFunction(()=>document.getElementById('planet-zybex-preview').dataset.score==='9876');
  await page.screenshot({path:path.join(__dirname,'../artifacts/planet-zybex-score.png'),fullPage:true});
  await page.selectOption('#zybex-level','game-over');
  for (let stage=0;stage<3;stage++) {
    if(stage){await page.locator('#zybex-preview-input').focus();await page.keyboard.press(stage===1?'a':'b');}
    await page.waitForFunction(stage=>document.getElementById('planet-zybex-preview').dataset.graphicsStage===String(stage),stage);
    assert.strictEqual(await page.locator('#planet-zybex-preview').getAttribute('data-graphics-mode'),stage===1?'1':'0');
    assert.strictEqual(await page.locator('#zybex-scroll').isDisabled(),true);
  }
  await page.screenshot({path:path.join(__dirname,'../artifacts/planet-zybex-game-over.png'),fullPage:true});
  await page.selectOption('#zybex-level','channels');
  for(let stage=0;stage<3;stage++) {
    if(stage===1)await page.click('#zybex-next');
    if(stage===2){await page.locator('#zybex-preview-input').focus();await page.keyboard.press('a');}
    await page.waitForFunction(stage=>document.getElementById('planet-zybex-preview').dataset.channelStage===String(stage),stage);
    assert.strictEqual(await page.locator('#zybex-channels').isVisible(),true);
    assert.strictEqual(await page.locator('#zybex-channels tbody tr').count(),[5,21,29][stage]);
    assert.ok((await page.locator('#zybex-channels').textContent()).includes('Sprite 15'));
    assert.strictEqual(await page.locator('#zybex-scroll').isDisabled(),true);
  }
  assert.ok((await page.locator('#zybex-channels').textContent()).includes('Bob 8'));
  await page.screenshot({path:path.join(__dirname,'../artifacts/planet-zybex-channels.png'),fullPage:true});
  await page.selectOption('#zybex-level','amal');
  await page.waitForFunction(()=>document.getElementById('planet-zybex-preview').dataset.amalY==='0');
  assert.strictEqual(await page.locator('#zybex-channels').isVisible(),false);
  await page.click('#zybex-next');
  await page.waitForFunction(()=>document.getElementById('planet-zybex-preview').dataset.amalY!=='0');
  await page.waitForFunction(()=>document.getElementById('planet-zybex-preview').dataset.amalEnded==='true');
  assert.strictEqual(await page.locator('#planet-zybex-preview').getAttribute('data-amal-y'),'161');
  await page.screenshot({path:path.join(__dirname,'../artifacts/planet-zybex-amal.png'),fullPage:true});
  for(const mode of ['missile','missile-hit']){
    await page.selectOption('#zybex-level',mode);
    await page.waitForFunction(()=>document.getElementById('planet-zybex-preview').dataset.missileFrame==='0');
    await page.click('#zybex-next');
    await page.waitForFunction(()=>document.getElementById('planet-zybex-preview').dataset.missileFrame==='81');
    assert.strictEqual(await page.locator('#planet-zybex-preview').getAttribute('data-missile-score'),mode==='missile-hit'?'20':'0');
  }
  await page.screenshot({path:path.join(__dirname,'../artifacts/planet-zybex-missile.png'),fullPage:true});
  for(const mode of ['hunters','hunters-beam']){
    await page.selectOption('#zybex-level',mode);
    await page.waitForFunction(()=>document.getElementById('planet-zybex-preview').dataset.huntersFrame==='0');
    await page.click('#zybex-next');
    await page.waitForFunction(()=>document.getElementById('planet-zybex-preview').dataset.huntersFrame==='81');
    assert.strictEqual(await page.locator('#planet-zybex-preview').getAttribute('data-hunters-score'),mode==='hunters'?'30':'60');
    assert.strictEqual(await page.locator('#planet-zybex-preview').getAttribute('data-hunters-seed'),mode==='hunters'?'12997':'35380');
  }
  await page.screenshot({path:path.join(__dirname,'../artifacts/planet-zybex-hunters.png'),fullPage:true});
  await page.selectOption('#zybex-level','default');
  await page.waitForFunction(()=>document.getElementById('planet-zybex-preview').dataset.stage==='1');
  assert.strictEqual(await page.locator('#zybex-next').isVisible(),true);await page.click('#zybex-next');
  await page.waitForFunction(()=>document.getElementById('planet-zybex-preview').dataset.stage==='0');
  assert.strictEqual(await page.locator('#zybex-preview-input').evaluate(c=>c.width),0);assert.strictEqual(await page.locator('#planet-zybex-preview').getAttribute('data-buffer-bytes'),'4800');
  await page.selectOption('#zybex-level', '1');assert.strictEqual(await page.locator('#zybex-channels').isVisible(),false);assert.strictEqual(await page.locator('#zybex-scroll').isDisabled(),false); await page.click('#zybex-fullscreen');
  await page.waitForFunction(() => document.fullscreenElement && document.fullscreenElement.id === 'planet-zybex-preview');
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.fullscreenElement);
  await page.screenshot({ path: path.join(__dirname, '../artifacts/planet-zybex-preview.png'), fullPage: true });
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  assert.strictEqual(await page.locator('#planet-zybex-preview').getAttribute('data-phase'), 'disposed');
  await page.locator('#demo-checks summary').click();
};
