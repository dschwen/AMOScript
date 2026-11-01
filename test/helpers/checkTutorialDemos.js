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
      try {
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
      const menu=/Tutorials\/Menus\/Menus_(\d)\.AMOS$/.exec(item.source);
      if(menu){
        await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.fullscreenElement);
        const number=Number(menu[1]),width=number>=2&&number<=7?640:320,height=number===9?210:200;
        const bounds=await page.locator('#game-input').boundingBox();
        const move=(x,y)=>page.mouse.move(bounds.x+bounds.width*x/width,bounds.y+bounds.height*y/height);
        assert.strictEqual(await page.locator('#game-input').evaluate(canvas=>canvas.dispatchEvent(new MouseEvent('contextmenu',{cancelable:true,bubbles:true}))),false);
        await move(4,4);await page.mouse.down({button:'right'});
        await page.waitForFunction(()=>AMOS_GAME_PAGE.menuStatus().active,null,{polling:100});
        await move(number===7?44:4,number===7?84:4);
        await page.waitForFunction(()=>AMOS_GAME_PAGE.menuStatus().visible.length>=2,null,{polling:100});
        const first=await page.locator('#game-input').screenshot({path:path.join(__dirname,`../artifacts/tutorial-menus-${number}.png`)});
        if(number===7){await page.waitForTimeout(150);assert.notDeepStrictEqual(await page.locator('#game-input').screenshot(),first,'Original Menu Called animation should advance');}
        await move(width-4,height-4);await page.mouse.up({button:'right'});
        await page.waitForFunction(()=>!AMOS_GAME_PAGE.menuStatus().active,null,{polling:100});
        assert.strictEqual(await page.evaluate(()=>AMOS_GAME_PAGE.menuStatus().choices[0]),0);
        if(number===4){
          await page.selectOption('#game-keyboard','typing');await page.locator('#game-input').focus();await page.keyboard.press('c');
          await page.waitForFunction(()=>document.getElementById('game-input').style.cursor==='wait');
          await page.keyboard.press('2');await page.waitForFunction(()=>AMOS_GAME_PAGE.menuStatus().choices[0]===3&&AMOS_GAME_PAGE.menuStatus().choices[1]===2);
        }
        assert.strictEqual(await page.locator('#game-viewport').getAttribute('data-phase'),'running',item.source);
      }
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
      }catch(error){throw new Error('Tutorial source '+item.source+': '+error.message,{cause:error});}
    }
    assert.deepStrictEqual(errors,[]);
    assert.deepStrictEqual(network,[]);
  } finally {await page.close();}
  console.log(`Tutorial demos passed: ${programs.filter(item=>item.compiled).length} pages start and stop with WebGL and bundled assets. All nine menu pages open/close, graphical Called animation and keyboard shortcuts run, and the complete 97-frame Iff_Animation reaches Edit. Other later interactions/completion are not asserted.`);
};
