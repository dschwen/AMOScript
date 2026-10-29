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
  await page.selectOption('#zybex-level','default');
  await page.waitForFunction(()=>document.getElementById('planet-zybex-preview').dataset.stage==='1');
  assert.strictEqual(await page.locator('#zybex-next').isVisible(),true);await page.click('#zybex-next');
  await page.waitForFunction(()=>document.getElementById('planet-zybex-preview').dataset.stage==='0');
  assert.strictEqual(await page.locator('#zybex-preview-input').evaluate(c=>c.width),0);assert.strictEqual(await page.locator('#planet-zybex-preview').getAttribute('data-buffer-bytes'),'4800');
  await page.selectOption('#zybex-level', '1');assert.strictEqual(await page.locator('#zybex-scroll').isDisabled(),false); await page.click('#zybex-fullscreen');
  await page.waitForFunction(() => document.fullscreenElement && document.fullscreenElement.id === 'planet-zybex-preview');
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.fullscreenElement);
  await page.screenshot({ path: path.join(__dirname, '../artifacts/planet-zybex-preview.png'), fullPage: true });
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  assert.strictEqual(await page.locator('#planet-zybex-preview').getAttribute('data-phase'), 'disposed');
  await page.locator('#demo-checks summary').click();
};
