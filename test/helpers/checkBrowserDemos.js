/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { scenarios } = require('./browserScenarios');

module.exports = async function checkBrowserDemos(browser) {
  for (const scenario of scenarios) {
    const page = await browser.newPage(), errors = [], network = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:/, route => { network.push(route.request().url()); return route.abort(); });
    try {
      await page.goto(pathToFileURL(path.join(__dirname, '../../demos', `${scenario.id}.html`)).href);
      await page.click('#run-demo');
      await page.waitForFunction(() => ['passed', 'failed'].includes(document.body.dataset.status), null, { timeout: 60000 });
      const status = await page.evaluate(() => ({ state: document.body.dataset.status, results: document.getElementById('results').textContent,
        frames: document.getElementById('frames').options.length }));
      assert.strictEqual(status.state, 'passed', `${scenario.id}: ${status.results}`);
      if (scenario.initialFrame) assert.strictEqual(await page.locator('#frames option:checked').textContent(), scenario.initialFrame);
      if (scenario.id === 'flash') {
        await page.click('#flash-stop');
        assert.strictEqual(await page.locator('#flash-controls').getAttribute('data-phase'),'stopped');
        await page.click('#flash-resume');
        assert.strictEqual(await page.locator('#flash-controls').getAttribute('data-phase'),'running');
        await page.click('#flash-off');
        assert.strictEqual(await page.locator('#flash-controls').getAttribute('data-phase'),'off');
        await page.click('#flash-restart');
        assert.strictEqual(await page.locator('#flash-controls').getAttribute('data-phase'),'running');
        await page.click('#flash-stop');
      }
      if (scenario.id === 'screen-copy') {
        await page.click('#copy-prepare');
        assert.strictEqual(await page.locator('#copy-controls').getAttribute('data-phase'),'prepared');
        assert.strictEqual(await page.locator('#copy-controls').getAttribute('data-buffers-equal'),'false');
        await page.click('#copy-publish');
        assert.strictEqual(await page.locator('#copy-controls').getAttribute('data-phase'),'published');
        assert.strictEqual(await page.locator('#copy-controls').getAttribute('data-buffers-equal'),'true');
        await page.locator('#copy-x').evaluate(el=>{el.value=640;el.dispatchEvent(new Event('input'));});
        await page.locator('#copy-y').evaluate(el=>{el.value=120;el.dispatchEvent(new Event('input'));});
        assert.strictEqual(await page.locator('#copy-controls').getAttribute('data-offset'),'640,120');
        await page.selectOption('#copy-level','5');await page.click('#copy-reset');
        assert.strictEqual(await page.locator('#copy-controls').getAttribute('data-phase'),'title');
        await page.click('#copy-prepare');await page.click('#copy-publish');
        assert.strictEqual(await page.locator('#copy-controls').getAttribute('data-buffers-equal'),'true');
        await page.evaluate(()=>globalThis.AMOS_COPY_DEMO_CLEANUP());
      }
      if (scenario.id === 'print-using') {
        assert.strictEqual(await page.locator('#using-controls').getAttribute('data-output'),'   123');
        await page.fill('#using-format','##');await page.fill('#using-value','12345');await page.click('#using-render');
        assert.strictEqual(await page.locator('#using-controls').getAttribute('data-output'),'45');
        await page.fill('#using-format','+##');await page.fill('#using-value','-7');await page.click('#using-render');
        assert.strictEqual(await page.locator('#using-controls').getAttribute('data-output'),'- 7');
        await page.fill('#using-format','###.##');await page.click('#using-render');
        assert.match(await page.locator('#using-status').textContent(),/Decimal\/exponent/);
        assert.strictEqual(await page.locator('#using-controls').getAttribute('data-output'),'- 7');
      }
      if (scenario.id === 'fade') {
        await page.waitForFunction(() => document.getElementById('fade-controls').dataset.phase === 'ready');
        await page.click('#fade-fade');
        await page.waitForFunction(() => document.getElementById('fade-controls').dataset.phase === 'fading');
        await page.click('#fade-stop');
        assert.strictEqual(await page.locator('#fade-controls').getAttribute('data-phase'),'stopped');
        await page.click('#fade-resume');
        await page.waitForFunction(() => document.getElementById('fade-controls').dataset.phase === 'complete');
        await page.click('#fade-restart');
        await page.waitForFunction(() => document.getElementById('fade-controls').dataset.phase === 'ready');
        await page.click('#fade-stop');
      }
      if (scenario.id === 'scancodes') {
        await page.click('#scan-input'); await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.getElementById('scan-log').dataset.scan === '69');
        await page.keyboard.press('ArrowUp');
        await page.waitForFunction(() => document.getElementById('scan-log').dataset.scan === '76');
        await page.keyboard.press('a');
        await page.waitForFunction(() => document.getElementById('scan-log').dataset.scan === '32');
        await page.click('#scan-stop');
        assert.strictEqual(await page.locator('#scan-controls').getAttribute('data-status'),'stopped');
        await page.click('#scan-resume'); await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => document.getElementById('scan-log').dataset.scan === '78');
        await page.click('#scan-clear');
        assert.strictEqual(await page.locator('#scan-log').getAttribute('data-scan'),'0');
        await page.click('#scan-stop');
      }
      if (scenario.id === 'wonderland-menu') {
        await page.waitForFunction(() => document.getElementById('menu-input').height === 256);
        await page.click('#menu-input');await page.keyboard.down('ArrowDown');
        await page.waitForFunction(() => Number(document.getElementById('menu-controls').dataset.position) > 0);
        await page.keyboard.up('ArrowDown');
        await page.waitForFunction(() => document.getElementById('menu-controls').dataset.position === '25');
        await page.keyboard.down('Enter');
        await page.waitForFunction(() => document.getElementById('menu-controls').dataset.selected === '2');
        await page.keyboard.up('Enter');
        await page.click('#menu-restart');await page.selectOption('#menu-keyboard-layout','wasd');
        await page.waitForFunction(() => document.getElementById('menu-input').height === 256);
        await page.keyboard.down('z');
        await page.waitForFunction(() => document.getElementById('menu-controls').dataset.selected === '1');
        await page.keyboard.up('z');
        await page.selectOption('#menu-input-mode','gamepad');
        await page.fill('#menu-gamepad-index','-1');await page.click('#menu-restart');
        assert.strictEqual(await page.locator('#menu-controls').getAttribute('data-selected'),'1');
        await page.fill('#menu-gamepad-index','0');await page.click('#menu-restart');
        await page.waitForFunction(() => document.getElementById('menu-input').height === 256);
        assert.strictEqual(await page.locator('#menu-controls').getAttribute('data-selected'),'0');
        await page.click('#menu-stop');
      }
      if (scenario.id === 'key-repeat') {
        await page.click('#repeat-input'); await page.keyboard.down('a');
        await page.waitForFunction(() => Number(document.getElementById('repeat-log').dataset.count) >= 3);
        await page.keyboard.up('a'); await page.click('#repeat-stop');
        assert.strictEqual(await page.locator('#repeat-controls').getAttribute('data-status'), 'stopped');
        await page.click('#repeat-detach');
      }
      if (scenario.id === 'music') {
        for (let number = 1; number <= 6; number++) {
          await page.click(`#audio-sample-${number}`);
          await page.waitForFunction(number => document.getElementById('sample-status').dataset.playing === String(number), number);
        }
        await page.click('#audio-stop');
        assert.strictEqual(await page.locator('#sample-status').textContent(), 'Stopped');
      }
      if (scenario.id === 'webgl-renderer') {
        assert.ok(status.frames >= 151, 'GPU demo exposes every compared frame');
        await page.selectOption('#frames', { label: 'sprite-priority-matrix' });
        assert.strictEqual(await page.locator('#stage canvas').getAttribute('height'), '880');
        await page.selectOption('#frames', { label: 'copper-stack-dma' });
      }
      else if (scenario.id !== 'webgl-resources') assert.ok(status.frames > 0, `${scenario.id} has visual output`);
      assert.deepStrictEqual(errors, [], `${scenario.id} page errors`);
      assert.deepStrictEqual(network, [], `${scenario.id} must run without external requests`);
      await page.screenshot({ path: path.join(__dirname, '../artifacts', `demo-${scenario.id}.png`), fullPage: true });
    } finally { await page.close(); }
  }
  console.log(`Browser demos passed: ${scenarios.length} standalone scenarios without network assets; interactive program/input/lifecycle page also exercised.`);
};
