'use strict';
module.exports = async function checkJoySource1Player(page) {
  const assert = require('assert');
  for (const [index, name] of ['LabEdit.AMOS', 'LabEdit.Bak'].entries()) {
    if (!index) await page.click('#animation-play'); else await page.selectOption('#animation-version', name);
    await page.waitForFunction(() => document.getElementById('animation-player').dataset.phase === 'running');
    await page.waitForTimeout(140);
    assert.strictEqual(await page.locator('#animation-player').getAttribute('data-backend'), 'webgl');
    await page.locator('#animation-input').focus();
    for (const key of ['5', 'f', '6', 'f', '2', 'f', 'c']) { await page.keyboard.press(key); await page.waitForTimeout(45); }
    assert.strictEqual(await page.locator('#animation-player').getAttribute('data-phase'), 'running');
    await page.click('#animation-stop'); await page.waitForFunction(() => document.getElementById('animation-player').dataset.phase === 'paused');
    const paused = await page.locator('#animation-input').screenshot(); await page.waitForTimeout(80); assert.deepStrictEqual(await page.locator('#animation-input').screenshot(), paused);
    await page.click('#animation-resume');
    if (!index) {
      await page.click('#animation-fullscreen'); await page.waitForFunction(() => document.fullscreenElement && document.fullscreenElement.id === 'animation-player');
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.fullscreenElement);
    }
    await page.locator('#animation-input').focus(); await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('animation-player').dataset.phase === 'ended');
  }
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.locator('#demo-checks summary').click();
};
