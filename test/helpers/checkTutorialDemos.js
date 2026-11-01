'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path');
const {pathToFileURL} = require('url');

// These tests exercise the actual repository demo pages. The same pages are
// linked from tutorial.html, including their HTML Preview links.
module.exports = async function checkTutorialDemos(browser) {
  const root = path.join(__dirname, '../../demos');
  const programs = JSON.parse(fs.readFileSync(path.join(root, 'tutorial-manifest.json'))).programs;
  const page = await browser.newPage({viewport:{width:1000,height:900}}), errors = [], network = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/^https?:/, route => {network.push(route.request().url());return route.abort();});
  try {
    await page.goto(pathToFileURL(path.join(root,'tutorial.html')).href);
    assert.strictEqual(await page.locator('li').count(),programs.length);
    for (const item of programs.filter(item => item.compiled)) {
      await page.goto(pathToFileURL(path.join(root,item.file)).href);
      await page.click('#play-game');
      await page.waitForFunction(() => {
        const data = document.getElementById('game-viewport').dataset;
        return data.phase === 'error' || data.sourceError || data.phase === 'running' && Number(data.line) >= 50;
      });
      const data = await page.locator('#game-viewport').evaluate(element => ({...element.dataset}));
      assert.strictEqual(data.phase,'running',item.source);
      assert.strictEqual(data.sourceError,'',item.source);
      assert.strictEqual(data.backend,'webgl',item.source);
      await page.keyboard.press('Escape');
      await page.click('#game-stop');
      assert.strictEqual(await page.locator('#game-viewport').getAttribute('data-phase'),'stopped',item.source);
      if (item.source === 'Tutorials/Iff_Animation.AMOS') {
        await page.click('#game-restart');
        await page.waitForFunction(() => {
          const data=document.getElementById('game-viewport').dataset;
          return data.phase==='error' || Number(data.line)===141;
        });
        assert.strictEqual(await page.locator('#game-viewport').getAttribute('data-source-error'),'');
        const bounds=await page.locator('#game-input').boundingBox();
        await page.mouse.move(bounds.x+20,bounds.y+20);await page.mouse.down();
        await page.waitForFunction(()=>Number(document.getElementById('game-viewport').dataset.line)>=163);
        await page.mouse.up();
        await page.waitForFunction(()=>['error','ended'].includes(document.getElementById('game-viewport').dataset.phase));
        assert.strictEqual(await page.locator('#game-viewport').getAttribute('data-phase'),'ended');
        assert.strictEqual(await page.locator('#game-viewport').getAttribute('data-source-error'),'');
        assert.strictEqual(await page.locator('#game-viewport').getAttribute('data-line'),'182');
      }
      await page.evaluate(() => AMOS_GAME_PAGE.dispose());
    }
    assert.deepStrictEqual(errors,[]);
    assert.deepStrictEqual(network,[]);
  } finally {await page.close();}
  console.log(`Tutorial demos passed: ${programs.filter(item=>item.compiled).length} original pages start and stop with WebGL and bundled assets. The complete 97-frame Iff_Animation also reaches Edit; other later interactions/completion are not asserted.`);
};
