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
