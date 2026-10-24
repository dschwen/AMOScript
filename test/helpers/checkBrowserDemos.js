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
      if (scenario.id === 'file-selector') {
        await page.click('#selector-run');
        assert.strictEqual(await page.locator('#selector-controls').getAttribute('data-phase'),'done');
        assert.strictEqual(await page.locator('#selector-controls').getAttribute('data-requests'),'2');
        assert.strictEqual(await page.locator('#selector-controls').getAttribute('data-bytes'),'7206');
        await page.selectOption('#selector-mode','save');await page.fill('#selector-path','new:output.LEV');await page.click('#selector-run');
        assert.strictEqual(await page.locator('#selector-controls').getAttribute('data-selected'),'new:output.LEV');
        assert.strictEqual(await page.locator('#selector-controls').getAttribute('data-bytes'),'7205');
        await page.selectOption('#selector-mode','load');await page.setInputFiles('#selector-upload',{name:'short.lev',mimeType:'application/octet-stream',buffer:Buffer.from([9])});
        await page.waitForFunction(()=>document.getElementById('selector-controls').dataset.phase==='ready');await page.click('#selector-run');
        assert.strictEqual(await page.locator('#selector-controls').getAttribute('data-bytes'),'1');
        await page.click('#selector-whole');assert.strictEqual(await page.locator('#selector-controls').getAttribute('data-gate'),'204');
        await page.evaluate(()=>globalThis.AMOS_SELECTOR_DEMO_CLEANUP());
      }
      if (scenario.id === 'random') {
        await page.click('#rnd-next');
        assert.strictEqual(await page.locator('#rnd-controls').getAttribute('data-xs'),'0');
        assert.strictEqual(await page.locator('#rnd-controls').getAttribute('data-ys'),'-13');
        const seed=await page.locator('#rnd-controls').getAttribute('data-seed');await page.click('#rnd-repeat');
        assert.strictEqual(await page.locator('#rnd-controls').getAttribute('data-cached'),'7');
        assert.strictEqual(await page.locator('#rnd-controls').getAttribute('data-seed'),seed);
        await page.selectOption('#rnd-kind','green-right');await page.click('#rnd-reset');await page.click('#rnd-next');
        const expected=require('../fixtures/random-vectors.json').enemies.find(item=>item.kind==='green-right'&&item.seed===12345&&item.beam===0).rows[0];
        assert.strictEqual(await page.locator('#rnd-controls').getAttribute('data-xs'),String(expected[0]));
        assert.strictEqual(await page.locator('#rnd-controls').getAttribute('data-ys'),String(expected[1]));
        await page.fill('#rnd-beam','65536');await page.click('#rnd-reset');
        assert.match(await page.locator('#rnd-status').textContent(),/beam word 0–65535/);
        await page.evaluate(()=>globalThis.AMOS_RANDOM_DEMO_CLEANUP());
      }
      if (scenario.id === 'raw-files') {
        await page.selectOption('#raw-level','5');await page.click('#raw-restart');await page.fill('#raw-tile','17');await page.click('#raw-apply');
        assert.strictEqual(await page.locator('#raw-controls').getAttribute('data-cell'),'17');
        await page.click('#raw-save');assert.strictEqual(await page.locator('#raw-controls').getAttribute('data-file-bytes'),'7205');
        assert.match(await page.locator('#raw-download').getAttribute('href'),/^blob:/);
        await page.click('#raw-damage');await page.click('#raw-reload');
        assert.strictEqual(await page.locator('#raw-controls').getAttribute('data-phase'),'loaded');
        assert.strictEqual(await page.locator('#raw-controls').getAttribute('data-cell'),'17');
        assert.strictEqual(await page.locator('#raw-controls').getAttribute('data-tail'),'100');
        await page.selectOption('#raw-level','1');await page.click('#raw-restart');await page.click('#raw-save');
        await page.setInputFiles('#raw-upload',{name:'short.lev',mimeType:'application/octet-stream',buffer:Buffer.from([9])});
        await page.waitForFunction(()=>document.getElementById('raw-controls').dataset.fileBytes==='1');await page.click('#raw-reload');
        assert.strictEqual(await page.locator('#raw-controls').getAttribute('data-cell'),'9');
        await page.evaluate(()=>globalThis.AMOS_RAW_DEMO_CLEANUP());
      }
      if (scenario.id === 'mouse') {
        await page.locator('#mouse-panel').scrollIntoViewIfNeeded();
        const panel=await page.locator('#mouse-panel').boundingBox();
        await page.mouse.move(panel.x+18,panel.y+310);await page.mouse.down();
        await page.waitForFunction(()=>document.getElementById('mouse-controls').dataset.action==='l');
        await page.mouse.up();
        await page.waitForFunction(()=>document.getElementById('mouse-controls').dataset.buttons==='0');
        await page.click('#mouse-stop');
        assert.strictEqual(await page.locator('#mouse-controls').getAttribute('data-phase'),'stopped');
        await page.click('#mouse-resume');
        assert.strictEqual(await page.locator('#mouse-controls').getAttribute('data-phase'),'running');
        await page.click('#mouse-restart');
        assert.strictEqual(await page.locator('#mouse-controls').getAttribute('data-action'),'none');
        await page.click('#mouse-stop');
        await page.evaluate(()=>globalThis.AMOS_MOUSE_DEMO_CLEANUP());
      }
      if (scenario.id === 'zones') {
        assert.strictEqual(await page.locator('#zones-controls').getAttribute('data-zone'),'1');
        await page.fill('#zones-x','200');await page.fill('#zones-y','202');await page.click('#zones-query');
        assert.strictEqual(await page.locator('#zones-controls').getAttribute('data-zone'),'2');
        await page.click('#zones-reset-one');
        assert.strictEqual(await page.locator('#zones-controls').getAttribute('data-zone'),'0');
        await page.click('#zones-restart');
        const panel=await page.locator('#zones-panel').boundingBox();
        await page.mouse.move(panel.x+18,panel.y+18);
        assert.strictEqual(await page.locator('#zones-controls').getAttribute('data-zone'),'1');
        await page.fill('#zones-x','392');await page.fill('#zones-y','218');await page.click('#zones-query');
        assert.strictEqual(await page.locator('#zones-controls').getAttribute('data-zone'),'5');
        await page.click('#zones-reset-all');
        assert.strictEqual(await page.locator('#zones-controls').getAttribute('data-zone'),'0');
        await page.click('#zones-restart');
        assert.strictEqual(await page.locator('#zones-controls').getAttribute('data-zone'),'1');
        await page.evaluate(()=>globalThis.AMOS_ZONES_DEMO_CLEANUP());
      }
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
      else if (scenario.capturedFrames === false) assert.strictEqual(status.frames,0,`${scenario.id} exposes data controls without rendering claims`);
      else if (scenario.id !== 'webgl-resources') assert.ok(status.frames > 0, `${scenario.id} has visual output`);
      assert.deepStrictEqual(errors, [], `${scenario.id} page errors`);
      assert.deepStrictEqual(network, [], `${scenario.id} must run without external requests`);
      await page.screenshot({ path: path.join(__dirname, '../artifacts', `demo-${scenario.id}.png`), fullPage: true });
    } finally { await page.close(); }
  }
  console.log(`Browser demos passed: ${scenarios.length} standalone scenarios without network assets; interactive program/input/lifecycle page also exercised.`);
};
