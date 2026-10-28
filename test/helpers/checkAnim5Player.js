'use strict';
const assert = require('assert');
const path = require('path');
module.exports = async function checkAnim5Player(page) {
  assert.strictEqual(await page.locator('#animation-play').isVisible(), true);
  assert.strictEqual(await page.locator('#demo-checks').evaluate(node => node.open), false);
  await page.click('#animation-play');
  await page.waitForFunction(() => Number(document.getElementById('animation-player').dataset.frameAddress) > 0);
  assert.strictEqual(await page.locator('#animation-player').getAttribute('data-backend'), 'webgl');
  assert.strictEqual(await page.locator('#results').textContent(), '');
  await page.click('#animation-stop');
  await page.waitForFunction(() => document.getElementById('animation-player').dataset.phase === 'paused');
  const address = await page.locator('#animation-player').getAttribute('data-frame-address');
  await page.waitForTimeout(250);
  assert.strictEqual(await page.locator('#animation-player').getAttribute('data-frame-address'), address);
  await page.screenshot({ path: path.join(__dirname, '../artifacts/anim5-live.png'), fullPage: true });
  await page.click('#animation-resume');
  await page.waitForFunction(previous => document.getElementById('animation-player').dataset.frameAddress !== previous, address);
  await page.click('#animation-fullscreen');
  await page.waitForFunction(() => document.fullscreenElement && document.fullscreenElement.id === 'animation-player');
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.fullscreenElement);
  const oldCanvas = await page.locator('#animation-input').elementHandle();
  await page.click('#animation-restart');
  assert.strictEqual(await oldCanvas.evaluate(node => node.isConnected), false);
  assert.strictEqual(await page.locator('#animation-input').count(), 1);
  // A real held pointer ends the source's later mouse loop without editing VM state.
  await page.locator('#animation-input').hover(); await page.mouse.down();
  await page.waitForFunction(() => document.getElementById('animation-player').dataset.phase === 'ended', null, { timeout: 20000 });
  await page.mouse.up();
  await page.selectOption('#animation-version', 'Logoanim.Bak');
  await page.waitForFunction(() => document.getElementById('animation-player').dataset.phase === 'running');
  await page.locator('#animation-input').hover(); await page.mouse.down();
  await page.waitForFunction(() => document.getElementById('animation-player').dataset.phase === 'ended', null, { timeout: 20000 });
  await page.mouse.up();
  // Exercise the same page on a browser without WebGL2.
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    globalThis.AMOS_RESTORE_ANIM_CONTEXT = () => { HTMLCanvasElement.prototype.getContext = original; delete globalThis.AMOS_RESTORE_ANIM_CONTEXT; };
    HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type === 'webgl2' ? null : original.call(this, type, ...args); };
  });
  try {
    await page.click('#animation-restart');
    await page.waitForFunction(() => Number(document.getElementById('animation-player').dataset.frameAddress) > 0);
    assert.strictEqual(await page.locator('#animation-player').getAttribute('data-backend'), 'canvas');
    assert.strictEqual(await page.locator('#animation-input').evaluate(node => !!node.getContext('2d')), true);
  } finally { await page.evaluate(() => AMOS_RESTORE_ANIM_CONTEXT()); }
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  assert.strictEqual(await page.locator('#animation-player').getAttribute('data-phase'), 'disposed');
  await page.locator('#demo-checks summary').click();
};
