/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { scenarios } = require('./browserScenarios');

module.exports = async function checkBrowserDemos(browser) {
  const gallery = await browser.newPage();
  try {
    await gallery.goto(pathToFileURL(path.join(__dirname, '../../demos/index.html')).href);
    assert.strictEqual(await gallery.locator('#games article').count(), 3);
    assert.strictEqual(await gallery.locator('#games a.play').first().isVisible(), true);
    assert.strictEqual(await gallery.locator('#technical-demos').evaluate(node => node.open), false);
    assert.strictEqual(await gallery.locator('#technical-demos article').first().isVisible(), false);
    await gallery.screenshot({ path: path.join(__dirname, '../artifacts/demo-index.png'), fullPage: true });
    await gallery.locator('#technical-demos summary').click();
    assert.strictEqual(await gallery.locator('#technical-demos article').first().isVisible(), true);
    assert.strictEqual(await gallery.locator('#showcases a[href="tunnel.html"]').count(), 1);
    assert.strictEqual(await gallery.locator('#showcases a[href="anim5.html"]').count(), 1);
    assert.strictEqual(await gallery.locator('#showcases a[href="bob-test.html"]').count(), 1);
    assert.strictEqual(await gallery.locator('#showcases a[href="planet-zybex.html"]').count(), 1);
  } finally { await gallery.close(); }
  const debug = await browser.newPage(), debugErrors = [], debugNetwork = [];
  debug.on('pageerror', error => debugErrors.push(error.message));
  await debug.route(/^https?:/, route => { debugNetwork.push(route.request().url()); return route.abort(); });
  try {
    await debug.goto(pathToFileURL(path.join(__dirname, '../../demos/roller2-game-debug.html')).href);
    assert.strictEqual(await debug.locator('.game-debug').count(), 1);
    assert.strictEqual(await debug.locator('.game-debug').evaluate(menu => menu.open), false);
    await debug.click('#play-game');
    await debug.waitForFunction(() => document.getElementById('game-viewport').dataset.sound === 'on' && /"line": 164/.test(document.querySelector('[data-debug-log]').textContent));
    assert.strictEqual(await debug.evaluate(() => document.fullscreenElement.id), 'game-viewport');
    assert.strictEqual(await debug.locator('#game-viewport').getAttribute('data-backend'), 'webgl');
    await debug.keyboard.press('Escape'); await debug.waitForFunction(() => !document.fullscreenElement);
    await debug.click('.game-debug summary');
    assert.strictEqual(await debug.locator('[data-debug-files] a').count(), 0);
    assert.match(await debug.locator('[data-debug-files]').textContent(), /No new or modified files/);
    await debug.locator('#game-input').focus(); await debug.keyboard.press('a');
    await debug.waitForFunction(() => { const text = document.querySelector('[data-debug-log]').textContent; const line = JSON.parse(text.split('\n\n')[0]).location.line; return line >= 298 && line <= 316; });
    await debug.screenshot({ path: path.join(__dirname, '../artifacts/roller2-game-debug.png'), fullPage: true });
    await debug.evaluate(() => AMOS_GAME_PAGE.dispose());
    assert.deepStrictEqual(debugErrors, []); assert.deepStrictEqual(debugNetwork, []);
  } finally { await debug.close(); }
  for (const scenario of scenarios) {
    const page = await browser.newPage(), errors = [], network = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:/, route => { network.push(route.request().url()); return route.abort(); });
    try {
      await page.goto(pathToFileURL(path.join(__dirname, '../../demos', `${scenario.id}.html`)).href);
      if (['roller2-game', 'wonderland-game'].includes(scenario.id)) {
        const roller = scenario.id === 'roller2-game', controls = roller ? '#roller2-game-controls' : '#game-controls', surface = roller ? '#roller2-game-input' : '#game-input';
        assert.strictEqual(await page.locator('#play-game').isVisible(), true);
        assert.strictEqual(await page.locator('#demo-checks').evaluate(node => node.open), false);
        await page.screenshot({ path: path.join(__dirname, '../artifacts', `${scenario.id}-play-button.png`), fullPage: true });
        await page.click('#play-game');
        await page.waitForFunction(({ roller }) => {
          const c = document.querySelector(roller ? '#roller2-game-controls' : '#game-controls');
          return c && c.dataset.sound === 'on' && (roller ? c.dataset.phase === 'intro' && c.dataset.line === '164' : c.dataset.game === '0' && Number(c.dataset.line) >= 66 && Number(c.dataset.line) < 100);
        }, { roller });
        assert.strictEqual(await page.evaluate(() => document.fullscreenElement.id), roller ? 'roller2-game-viewport' : 'game-viewport');
        assert.strictEqual(await page.locator('#results').textContent(), '');
        assert.strictEqual(await page.evaluate(() => document.body.dataset.status), 'idle');
        assert.strictEqual(await page.locator(controls).getAttribute('data-backend'), 'webgl');
        assert.strictEqual(await page.locator(`${controls} .game-debug`).count(), 0);
        for (const action of ['stop', 'resume', 'restart']) assert.ok(await page.locator(`${controls} button[aria-label="${action[0].toUpperCase() + action.slice(1)}"] svg`).count());
        await page.locator(surface).evaluate(canvas => { canvas.dataset.launchIdentity = 'retained'; });
        await page.keyboard.press('Escape'); await page.waitForFunction(() => document.fullscreenElement === null);
        await page.click('#play-game');
        await page.waitForFunction(() => document.fullscreenElement !== null);
        assert.strictEqual(await page.locator(surface).getAttribute('data-launch-identity'), 'retained');
        if (roller) {
          await page.waitForTimeout(1500);
          assert.strictEqual(await page.locator(controls).getAttribute('data-line'), '164');
          assert.strictEqual(await page.locator(controls).getAttribute('data-level'), '0');
          await page.locator(surface).focus(); await page.keyboard.press('a');
          await page.waitForFunction(() => document.getElementById('roller2-game-controls').dataset.phase === 'menu');
          await page.waitForTimeout(300);
          assert.strictEqual(await page.locator(controls).getAttribute('data-phase'), 'menu');
          assert.strictEqual(await page.locator(controls).getAttribute('data-level'), '0');
        }
        if (!roller) {
          await page.waitForTimeout(1500);
          assert.strictEqual(await page.locator(controls).getAttribute('data-game'), '0');
          assert.strictEqual(await page.locator(controls).getAttribute('data-level'), '0');
          await page.locator(surface).focus(); await page.keyboard.down('Enter');
          await page.waitForFunction(() => { const c = document.getElementById('game-controls'); return c.dataset.game === '1' && Number(c.dataset.line) >= 204; });
          await page.keyboard.up('Enter');
          await page.selectOption('#game-input-mode', 'gamepad'); await page.click('#game-restart');
          await page.keyboard.press('Escape'); await page.waitForFunction(() => document.fullscreenElement === null);
          await page.click('#play-game');
          await page.waitForTimeout(1500);
          assert.strictEqual(await page.locator(controls).getAttribute('data-game'), '0');
          assert.strictEqual(await page.locator(controls).getAttribute('data-level'), '0');
          assert.strictEqual(await page.locator('#game-input-mode').inputValue(), 'gamepad');
          // Explicit controller input starts the game; Play never supplies fire.
          await page.evaluate(() => {
            globalThis.AMOS_LAUNCH_PAD = true;
            Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [{ connected: true, mapping: 'standard', axes: [0, 0], buttons: [{ pressed: globalThis.AMOS_LAUNCH_PAD }] }] });
          });
          await page.waitForFunction(() => { const c = document.getElementById('game-controls'); return c.dataset.game === '1' && Number(c.dataset.line) >= 204; });
          await page.evaluate(() => { globalThis.AMOS_LAUNCH_PAD = false; delete navigator.getGamepads; delete globalThis.AMOS_LAUNCH_PAD; });
        }
        await page.evaluate(roller => roller ? AMOS_ROLLER2_GAME_CLEANUP() : AMOS_GAME_DEMO_CLEANUP(), roller);
        await page.waitForFunction(() => document.fullscreenElement === null);
        assert.strictEqual(await page.evaluate(() => typeof globalThis.AMOS_PLAY_GAME), 'undefined');
        await page.locator('#demo-checks summary').click();
      }
      if (scenario.id === 'planet-zybex-game') await require('./checkPlanetZybexGamePage')(page);
      if (scenario.id === 'planet-zybex') await require('./checkPlanetZybexPreview')(page);
      if (scenario.id === 'bob-test') await require('./checkBobTestPlayer')(page);
      if (scenario.id === 'screen-slide') await require('./checkScreenSlidePlayer')(page);
      if (scenario.id === 'amos-3d') await require('./checkAmos3DPlayer')(page);
      if (scenario.id === 'anim5') await require('./checkAnim5Player')(page);
      await page.click('#run-demo');
      await page.waitForFunction(() => ['passed', 'failed'].includes(document.body.dataset.status), null, { timeout: 60000 });
      const status = await page.evaluate(() => ({ state: document.body.dataset.status, results: document.getElementById('results').textContent,
        frames: document.getElementById('frames').options.length }));
      assert.strictEqual(status.state, 'passed', `${scenario.id}: ${status.results}`);
      if (scenario.id === 'open-port') {
        const fixture = require('../fixtures/open-port.json');
        for (const [name, expected] of Object.entries(fixture)) {
          const downloadEvent = page.waitForEvent('download');
          await page.locator(`[data-port-download="${name}"]`).click();
          const download = await downloadEvent; assert.strictEqual(download.suggestedFilename(), `${name}.prn`);
          const filename = path.join(__dirname, '../artifacts', `${name}.prn`); await download.saveAs(filename);
          assert.strictEqual(require('fs').readFileSync(filename).toString('base64'), expected.base64);
        }
        const oldUrl = await page.locator('[data-port-download]').first().getAttribute('href');
        await page.click('#run-demo'); await page.waitForFunction(() => document.body.dataset.status === 'passed');
        assert.strictEqual(await page.locator('#port-captures').count(), 1);
        assert.strictEqual(await page.evaluate(async url => { try { await fetch(url); return false; } catch (_) { return true; } }, oldUrl), true);
        await page.screenshot({ path: path.join(__dirname, '../artifacts/open-port.png'), fullPage: true });
        await page.evaluate(() => AMOS_PORT_CAPTURE_CLEANUP());
        assert.strictEqual(await page.locator('#port-captures').count(), 0);
      }
      if (scenario.id === 'game-page-debug') {
        const frame = page.frameLocator('#game-page-debug');
        await frame.locator('#game-restart').click();
        await frame.locator('.game-debug summary').click();
        const downloadEvent = page.waitForEvent('download');
        await frame.locator('a[download="save.dat"]').click();
        const download = await downloadEvent;
        assert.strictEqual(download.suggestedFilename(), 'save.dat');
        const filename = path.join(__dirname, '../artifacts/game-page-save.dat');
        await download.saveAs(filename);
        assert.deepStrictEqual([...require('fs').readFileSync(filename)], [0, 128, 255, 10]);
        await page.screenshot({ path: path.join(__dirname, '../artifacts/game-page-debug.png'), fullPage: true });
        await page.evaluate(() => { for (const frame of document.querySelectorAll('#game-page-debug-examples iframe')) frame.contentWindow.AMOS_GAME_PAGE.dispose(); });
      }
      if (scenario.id === 'browser-game-harness') {
        const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
        try {
          const child = await mobile.newPage();
          await child.route(/^https?:/, route => { network.push(route.request().url()); return route.abort(); });
          child.on('pageerror', error => errors.push(error.message));
          await child.setContent(await page.locator('#harness-tutorial').evaluate(iframe => iframe.srcdoc));
          await child.waitForFunction(() => !!globalThis.AMOS_GAME_PAGE);
          const session = await mobile.newCDPSession(child);
          await child.click('#play-game');
          await child.waitForFunction(() => { const v = document.getElementById('game-viewport'); return v.dataset.phase === 'running' && v.dataset.sound === 'on'; });
          assert.strictEqual(await child.locator('.amos-virtual-joystick').isVisible(), true, 'Touch Auto appears on a mobile fullscreen page');
          await child.screenshot({ path: path.join(__dirname, '../artifacts/mobile-game-harness.png') });
          const rect = async direction => child.locator(`[data-direction="${direction}"]`).boundingBox();
          const up = await rect('up'), fire = await rect('fire'), left = await rect('left'), right = await rect('right'), down = await rect('down');
          assert.strictEqual(up.x, fire.x); assert.strictEqual(down.x, fire.x); assert.strictEqual(left.y, fire.y); assert.strictEqual(right.y, fire.y);
          assert.ok(up.y < fire.y && down.y > fire.y && left.x < fire.x && right.x > fire.x);
          const point = (r, id) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2, id });
          const value = () => child.evaluate(() => AMOS_GAME_PAGE.joystickStatus()[0].mask);
          const expectMask = async expected => { await child.waitForFunction(value => AMOS_GAME_PAGE.joystickStatus()[0].mask === value, expected); assert.strictEqual(await value(), expected); };
          await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(up, 1)] });
          await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(up, 1), point(fire, 2)] });
          await expectMask(17);
          await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(right, 1), point(fire, 2)] });
          await expectMask(24);
          await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await expectMask(0);
          await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(fire, 3)] });
          await child.click('#game-stop'); await expectMask(0);
          await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
          await child.click('#game-resume'); await expectMask(0);
          await child.click('#game-restart'); assert.strictEqual(await child.locator('.amos-virtual-joystick').count(), 1);
          const currentFire = await rect('fire');
          await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(currentFire, 4)] });
          await child.locator('#game-input').focus(); await child.keyboard.press('Escape');
          await child.waitForFunction(() => document.fullscreenElement === null);
          await child.locator('.amos-virtual-joystick').waitFor({ state: 'hidden' }); await expectMask(0);
          await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
          await child.evaluate(() => AMOS_GAME_PAGE.dispose()); assert.strictEqual(await child.locator('.amos-virtual-joystick').count(), 0);
          await session.detach();
        } finally { await mobile.close(); }
      }
      if (scenario.initialFrame) assert.strictEqual(await page.locator('#frames option:checked').textContent(), scenario.initialFrame);
      if(scenario.id==='roller2'){await page.selectOption('#roller2-pattern','11');assert.strictEqual(await page.locator('#roller2-controls').getAttribute('data-pattern'),'11');assert.strictEqual((await page.locator('#roller2-cells').textContent()).split('\n').length,65);}
      if(scenario.id==='roller2-edit'){
        assert.strictEqual(await page.locator('#roller2-edit-controls').getAttribute('data-backend'),'webgl');await page.click('#roller2-edit-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='roller2-edit-viewport');await page.click('#roller2-edit-step');assert.strictEqual(await page.locator('#roller2-edit-controls').getAttribute('data-phase'),'editor-request');assert.strictEqual(await page.locator('#roller2-edit-controls').getAttribute('data-requests'),'1');
        await page.click('#roller2-edit-restart');assert.strictEqual(await page.evaluate(()=>document.fullscreenElement.id),'roller2-edit-viewport');assert.strictEqual(await page.locator('#roller2-edit-controls').getAttribute('data-phase'),'prepared');assert.strictEqual(await page.locator('#roller2-edit-controls').getAttribute('data-requests'),'0');await page.selectOption('#roller2-edit-mode','left');await page.click('#roller2-edit-step');assert.strictEqual(await page.locator('#roller2-edit-controls').getAttribute('data-phase'),'beweg-guard');assert.strictEqual(await page.locator('#roller2-edit-controls').getAttribute('data-output'),'0,-1');await page.evaluate(()=>globalThis.AMOS_ROLLER2_EDIT_CLEANUP());await page.waitForFunction(()=>document.fullscreenElement===null);
      }
      if(scenario.id==='roller2-swap'){
        assert.strictEqual(await page.locator('#roller2-swap-controls').getAttribute('data-backend'),'webgl');await page.click('#roller2-swap-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='roller2-swap-viewport');
        for(const phase of ['inserted','sorted']){await page.click('#roller2-swap-step');assert.strictEqual(await page.locator('#roller2-swap-controls').getAttribute('data-phase'),phase);}await page.fill('#roller2-swap-score','2147483647');await page.fill('#roller2-swap-name','winner');await page.click('#roller2-swap-restart');assert.strictEqual(await page.evaluate(()=>document.fullscreenElement.id),'roller2-swap-viewport');for(let i=0;i<2;i++)await page.click('#roller2-swap-step');assert.strictEqual(await page.locator('#roller2-swap-controls').getAttribute('data-top'),'2147483647');await page.evaluate(()=>globalThis.AMOS_ROLLER2_SWAP_CLEANUP());await page.waitForFunction(()=>document.fullscreenElement===null);
      }
      if(scenario.id==='roller2-rainbow-del'){
        assert.strictEqual(await page.locator('#roller2-rainbow-del-controls').getAttribute('data-backend'),'webgl');await page.click('#roller2-rainbow-del-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='roller2-rainbow-del-viewport');
        for(const [phase,slots]of [['slot-zero-deleted','1'],['all-deleted','']]){await page.click('#roller2-rainbow-del-step');assert.strictEqual(await page.locator('#roller2-rainbow-del-controls').getAttribute('data-phase'),phase);assert.strictEqual(await page.locator('#roller2-rainbow-del-controls').getAttribute('data-slots'),slots);}
        await page.click('#roller2-rainbow-del-restart');assert.strictEqual(await page.evaluate(()=>document.fullscreenElement.id),'roller2-rainbow-del-viewport');assert.strictEqual(await page.locator('#roller2-rainbow-del-controls').getAttribute('data-slots'),'0,1');await page.evaluate(()=>globalThis.AMOS_ROLLER2_RAINBOW_DEL_CLEANUP());await page.waitForFunction(()=>document.fullscreenElement===null);
      }
      if(scenario.id==='roller2-get-icon'){
        assert.strictEqual(await page.locator('#roller2-get-icon-controls').getAttribute('data-backend'),'webgl');await page.click('#roller2-get-icon-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='roller2-get-icon-viewport');
        for(const phase of ['popup','restored']){await page.click('#roller2-get-icon-step');assert.strictEqual(await page.locator('#roller2-get-icon-controls').getAttribute('data-phase'),phase);}
        await page.selectOption('#roller2-get-icon-mode','overwrite');for(const phase of ['popup','restored']){await page.click('#roller2-get-icon-step');assert.strictEqual(await page.locator('#roller2-get-icon-controls').getAttribute('data-phase'),phase);}
        await page.click('#roller2-get-icon-restart');assert.strictEqual(await page.evaluate(()=>document.fullscreenElement.id),'roller2-get-icon-viewport');assert.strictEqual(await page.locator('#roller2-get-icon-controls').getAttribute('data-phase'),'prepared');await page.evaluate(()=>globalThis.AMOS_ROLLER2_GET_ICON_CLEANUP());await page.waitForFunction(()=>document.fullscreenElement===null);
      }
      if(scenario.id==='roller2-pointer'){
        assert.strictEqual(await page.locator('#roller2-pointer-controls').getAttribute('data-backend'),'webgl');await page.click('#roller2-pointer-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='roller2-pointer-viewport');
        await page.click('#roller2-pointer-toggle');await page.click('#roller2-pointer-step');assert.strictEqual(await page.locator('#roller2-pointer-input').evaluate(c=>getComputedStyle(c).cursor),'none');await page.click('#roller2-pointer-toggle');assert.strictEqual(await page.locator('#roller2-pointer-input').evaluate(c=>getComputedStyle(c).cursor),'default');
        for(let i=0;i<4;i++)await page.click('#roller2-pointer-step');assert.strictEqual(await page.locator('#roller2-pointer-controls').getAttribute('data-shape'),'3');assert.strictEqual(await page.locator('#roller2-pointer-input').evaluate(c=>getComputedStyle(c).cursor),'wait');await page.click('#roller2-pointer-restart');assert.strictEqual(await page.evaluate(()=>document.fullscreenElement.id),'roller2-pointer-viewport');assert.strictEqual(await page.locator('#roller2-pointer-input').evaluate(c=>getComputedStyle(c).cursor),'crosshair');await page.evaluate(()=>globalThis.AMOS_ROLLER2_POINTER_CLEANUP());await page.waitForFunction(()=>document.fullscreenElement===null);
      }
      if(scenario.id==='roller2-scin'){
        assert.strictEqual(await page.locator('#roller2-scin-controls').getAttribute('data-backend'),'webgl');await page.click('#roller2-scin-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='roller2-scin-viewport');
        await page.locator('#roller2-scin-input').evaluate(canvas=>{const r=canvas.getBoundingClientRect(),sx=r.width/canvas.offsetWidth,sy=r.height/canvas.offsetHeight;canvas.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+canvas.clientLeft*sx+4.5*canvas.clientWidth*sx/320,clientY:r.top+canvas.clientTop*sy+94.5*canvas.clientHeight*sy/250,buttons:1,bubbles:true}));});await page.waitForFunction(()=>document.getElementById('roller2-scin-controls').dataset.sn==='1');assert.strictEqual(await page.locator('#roller2-scin-controls').getAttribute('data-xy'),'20,12');assert.strictEqual(await page.locator('#roller2-scin-controls').getAttribute('data-zone'),'1');
        await page.click('#roller2-scin-restart');assert.strictEqual(await page.evaluate(()=>document.fullscreenElement.id),'roller2-scin-viewport');assert.strictEqual(await page.locator('#roller2-scin-controls').getAttribute('data-screen'),'0');await page.evaluate(()=>globalThis.AMOS_ROLLER2_SCIN_CLEANUP());await page.waitForFunction(()=>document.fullscreenElement===null);
      }
      if(scenario.id==='roller2-writing'){
        assert.strictEqual(await page.locator('#roller2-writing-controls').getAttribute('data-backend'),'webgl');await page.click('#roller2-writing-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='roller2-writing-viewport');
        for(const phase of ['labels','pen-proof']){await page.click('#roller2-writing-step');assert.strictEqual(await page.locator('#roller2-writing-controls').getAttribute('data-phase'),phase);}
        await page.click('#roller2-writing-matrix');assert.strictEqual(await page.locator('#roller2-writing-controls').getAttribute('data-phase'),'matrix');await page.click('#roller2-writing-restart');assert.strictEqual(await page.evaluate(()=>document.fullscreenElement.id),'roller2-writing-viewport');assert.strictEqual(await page.locator('#roller2-writing-controls').getAttribute('data-phase'),'selection');await page.evaluate(()=>globalThis.AMOS_ROLLER2_WRITING_CLEANUP());await page.waitForFunction(()=>document.fullscreenElement===null);
      }
      if(scenario.id==='roller2-lines'){
        assert.strictEqual(await page.locator('#roller2-line-controls').getAttribute('data-backend'),'webgl');await page.click('#roller2-line-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='roller2-line-viewport');
        await page.click('#roller2-line-erase');assert.strictEqual(await page.locator('#roller2-line-controls').getAttribute('data-phase'),'erased');await page.fill('#roller2-line-column','0');await page.fill('#roller2-line-row','11');await page.click('#roller2-line-redraw');assert.strictEqual(await page.locator('#roller2-line-controls').getAttribute('data-cell'),'0,11');assert.strictEqual(await page.locator('#roller2-line-controls').getAttribute('data-phase'),'redrawn');
        await page.click('#roller2-line-restart');assert.strictEqual(await page.evaluate(()=>document.fullscreenElement.id),'roller2-line-viewport');assert.strictEqual(await page.locator('#roller2-line-controls').getAttribute('data-phase'),'selected');await page.evaluate(()=>globalThis.AMOS_ROLLER2_LINE_CLEANUP());await page.waitForFunction(()=>document.fullscreenElement===null);
      }
      if(scenario.id==='roller2-transfers'){
        await page.selectOption('#roller2-transfer-level','7');const metadata=await page.locator('#roller2-transfer-controls').getAttribute('data-metadata');
        await page.click('#roller2-transfer-clear');assert.strictEqual(await page.locator('#roller2-transfer-controls').getAttribute('data-phase'),'cleared');assert.strictEqual(await page.locator('#roller2-transfer-controls').getAttribute('data-tiles-one'),'240');assert.strictEqual(await page.locator('#roller2-transfer-controls').getAttribute('data-colours-zero'),'240');assert.strictEqual(await page.locator('#roller2-transfer-controls').getAttribute('data-metadata'),metadata);
        await page.click('#roller2-transfer-restore');assert.strictEqual(await page.locator('#roller2-transfer-controls').getAttribute('data-phase'),'restored');assert.strictEqual(await page.locator('#roller2-transfer-controls').getAttribute('data-metadata'),metadata);await page.click('#roller2-transfer-load');assert.strictEqual(await page.locator('#roller2-transfer-controls').getAttribute('data-phase'),'backed-up');await page.evaluate(()=>globalThis.AMOS_ROLLER2_TRANSFER_CLEANUP());
      }
      if(scenario.id==='roller2-arrows'){
        assert.strictEqual(await page.locator('#roller2-movement-controls').getAttribute('data-backend'),'webgl');
        await page.click('#roller2-movement-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='roller2-movement-viewport');
        await page.focus('#roller2-movement-input');await page.keyboard.down('ArrowRight');
        try{await page.waitForFunction(()=>document.getElementById('roller2-movement-controls').dataset.level==='2');}finally{await page.keyboard.up('ArrowRight');}
        await page.waitForFunction(()=>document.getElementById('roller2-movement-controls').dataset.remaining==='3');await page.keyboard.down('Enter');
        try{await page.waitForFunction(()=>document.getElementById('roller2-movement-controls').dataset.cell==='8,1');}finally{await page.keyboard.up('Enter');}
        await page.keyboard.down('ArrowRight');try{await page.waitForFunction(()=>Number(document.getElementById('roller2-movement-controls').dataset.x)>256);}finally{await page.keyboard.up('ArrowRight');}
        await page.click('#roller2-movement-pause');const x=await page.locator('#roller2-movement-controls').getAttribute('data-x');await page.waitForTimeout(80);assert.strictEqual(await page.locator('#roller2-movement-controls').getAttribute('data-x'),x);await page.click('#roller2-movement-pause');
        await page.waitForFunction(()=>{const s=document.getElementById('roller2-movement-controls').dataset;return s.cell==='9,4'&&s.phase==='idle';});
        await page.focus('#roller2-movement-input');await page.keyboard.down('ArrowLeft');try{await page.waitForFunction(()=>Number(document.getElementById('roller2-movement-controls').dataset.x)<272);}finally{await page.keyboard.up('ArrowLeft');}
        await page.waitForFunction(()=>{const s=document.getElementById('roller2-movement-controls').dataset;return s.cell==='5,3'&&s.phase==='idle';});
        await page.click('#roller2-movement-restart');assert.strictEqual(await page.evaluate(()=>document.fullscreenElement.id),'roller2-movement-viewport');assert.strictEqual(await page.locator('#roller2-movement-controls').getAttribute('data-level'),'1');await page.evaluate(()=>globalThis.AMOS_ROLLER2_MOVEMENT_CLEANUP());await page.waitForFunction(()=>document.fullscreenElement===null);
      }
      if(scenario.id==='boom'){
        await page.click('#boom-play');await page.waitForFunction(()=>document.getElementById('boom-controls').dataset.plays==='4');assert.strictEqual(await page.locator('#boom-controls').getAttribute('data-sound'),'on');
        await page.click('#boom-mute');assert.strictEqual(await page.locator('#boom-controls').getAttribute('data-sound'),'off');assert.strictEqual(await page.locator('#boom-controls').getAttribute('data-voices'),'0');
        await page.click('#boom-play');await page.waitForFunction(()=>document.getElementById('boom-controls').dataset.plays==='8');await page.evaluate(()=>globalThis.AMOS_BOOM_CLEANUP());
      }
      if(scenario.id==='roller2-pauses'){
        assert.strictEqual(await page.locator('#roller2-movement-controls').getAttribute('data-backend'),'webgl');
        await page.click('#roller2-movement-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='roller2-movement-viewport');
        await page.focus('#roller2-movement-input');await page.keyboard.down('ArrowRight');
        try{await page.waitForFunction(()=>document.getElementById('roller2-movement-controls').dataset.level==='2');}finally{await page.keyboard.up('ArrowRight');}
        await page.waitForFunction(()=>document.getElementById('roller2-movement-controls').dataset.remaining==='3');await page.keyboard.down('Enter');
        try{await page.waitForFunction(()=>document.getElementById('roller2-movement-controls').dataset.cell==='8,1');}finally{await page.keyboard.up('Enter');}
        await page.keyboard.press('Space');await page.waitForFunction(()=>document.getElementById('roller2-movement-controls').dataset.phase==='prompt');
        await page.click('#roller2-movement-pause');await page.waitForTimeout(80);await page.click('#roller2-movement-pause');
        await page.focus('#roller2-movement-input');await page.keyboard.press('a');await page.waitForFunction(()=>document.getElementById('roller2-movement-controls').dataset.phase==='idle');
        const score=Number(await page.locator('#roller2-movement-controls').getAttribute('data-score')),bounds=await page.locator('#roller2-movement-input').boundingBox();
        await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();
        try{await page.waitForFunction(previous=>Number(document.getElementById('roller2-movement-controls').dataset.score)<previous,score);}finally{await page.mouse.up();}
        await page.waitForFunction(()=>document.getElementById('roller2-movement-controls').dataset.phase==='idle');
        await page.click('#roller2-movement-restart');assert.strictEqual(await page.evaluate(()=>document.fullscreenElement.id),'roller2-movement-viewport');
        assert.strictEqual(await page.locator('#roller2-movement-controls').getAttribute('data-score'),'0');
        await page.evaluate(()=>globalThis.AMOS_ROLLER2_MOVEMENT_CLEANUP());await page.waitForFunction(()=>document.fullscreenElement===null);
      }
      if(scenario.id==='roller2-progression'){
        assert.strictEqual(await page.locator('#roller2-movement-controls').getAttribute('data-backend'),'webgl');
        await page.click('#roller2-movement-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='roller2-movement-viewport');
        await page.focus('#roller2-movement-input');await page.keyboard.down('ArrowRight');
        try{await page.waitForFunction(()=>document.getElementById('roller2-movement-controls').dataset.level==='2');}finally{await page.keyboard.up('ArrowRight');}
        await page.waitForFunction(()=>document.getElementById('roller2-movement-controls').dataset.remaining==='3');
        await page.keyboard.down('Space');
        try{await page.waitForFunction(()=>document.getElementById('roller2-movement-controls').dataset.cell==='8,1');}finally{await page.keyboard.up('Space');}
        assert.ok(Number(await page.locator('#roller2-movement-controls').getAttribute('data-score'))>50);
        await page.click('#roller2-movement-pause');const score=await page.locator('#roller2-movement-controls').getAttribute('data-score');await page.waitForTimeout(80);await page.click('#roller2-movement-pause');
        assert.strictEqual(await page.locator('#roller2-movement-controls').getAttribute('data-score'),score);
        await page.click('#roller2-movement-restart');assert.strictEqual(await page.evaluate(()=>document.fullscreenElement.id),'roller2-movement-viewport');
        assert.strictEqual(await page.locator('#roller2-movement-controls').getAttribute('data-level'),'1');assert.strictEqual(await page.locator('#roller2-movement-controls').getAttribute('data-score'),'0');
        await page.evaluate(()=>globalThis.AMOS_ROLLER2_MOVEMENT_CLEANUP());await page.waitForFunction(()=>document.fullscreenElement===null);
      }
      if(scenario.id==='roller2-colours'){
        assert.strictEqual(await page.locator('#roller2-movement-controls').getAttribute('data-backend'),'webgl');
        await page.click('#roller2-movement-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='roller2-movement-viewport');
        await page.focus('#roller2-movement-input');await page.keyboard.down('ArrowRight');
        try{await page.waitForFunction(()=>document.getElementById('roller2-movement-controls').dataset.phase==='guarded');}finally{await page.keyboard.up('ArrowRight');}
        assert.strictEqual(await page.locator('#roller2-movement-controls').getAttribute('data-score'),'50');assert.strictEqual(await page.locator('#roller2-movement-controls').getAttribute('data-remaining'),'0');assert.strictEqual(await page.locator('#roller2-movement-controls').getAttribute('data-cell'),'12,9');
        await page.click('#roller2-movement-pause');await page.waitForTimeout(80);await page.click('#roller2-movement-pause');
        assert.strictEqual(await page.locator('#roller2-movement-controls').getAttribute('data-score'),'50');assert.strictEqual(await page.locator('#roller2-movement-controls').getAttribute('data-remaining'),'0');
        await page.click('#roller2-movement-restart');assert.strictEqual(await page.evaluate(()=>document.fullscreenElement.id),'roller2-movement-viewport');
        assert.strictEqual(await page.locator('#roller2-movement-controls').getAttribute('data-score'),'0');assert.strictEqual(await page.locator('#roller2-movement-controls').getAttribute('data-remaining'),'5');
        await page.evaluate(()=>globalThis.AMOS_ROLLER2_MOVEMENT_CLEANUP());await page.waitForFunction(()=>document.fullscreenElement===null);
      }
      if(scenario.id==='roller2-movement'){
        assert.strictEqual(await page.locator('#roller2-movement-controls').getAttribute('data-backend'),'webgl');
        await page.click('#roller2-movement-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='roller2-movement-viewport');
        await page.focus('#roller2-movement-input');await page.keyboard.down('ArrowRight');
        try{await page.waitForFunction(()=>document.getElementById('roller2-movement-controls').dataset.phase==='sliding');}finally{await page.keyboard.up('ArrowRight');}
        await page.click('#roller2-movement-pause');const x=await page.locator('#roller2-movement-controls').getAttribute('data-x');await page.waitForTimeout(80);
        assert.strictEqual(await page.locator('#roller2-movement-controls').getAttribute('data-x'),x);
        assert.strictEqual(await page.locator('#roller2-movement-controls').getAttribute('data-phase'),'stopped');await page.click('#roller2-movement-pause');
        await page.waitForFunction(()=>document.getElementById('roller2-movement-controls').dataset.phase==='guarded');assert.strictEqual(await page.locator('#roller2-movement-controls').getAttribute('data-cell'),'8,9');
        await page.click('#roller2-movement-restart');assert.strictEqual(await page.evaluate(()=>document.fullscreenElement.id),'roller2-movement-viewport');
        assert.strictEqual(await page.locator('#roller2-movement-controls').getAttribute('data-cell'),'5,9');
        await page.evaluate(()=>globalThis.AMOS_ROLLER2_MOVEMENT_CLEANUP());await page.waitForFunction(()=>document.fullscreenElement===null);
      }
      if(scenario.id==='roller2-input'){
        assert.strictEqual(await page.locator('#roller2-ready-controls').getAttribute('data-backend'),'webgl');
        await page.click('#roller2-ready-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='roller2-ready-viewport');
        await page.focus('#roller2-ready-input');await page.keyboard.down('Space');
        try{await page.waitForFunction(()=>document.getElementById('roller2-ready-controls').dataset.phase==='input');}finally{await page.keyboard.up('Space');}
        await page.keyboard.press('Escape');await page.waitForFunction(()=>document.fullscreenElement===null);
        assert.strictEqual(await page.locator('#roller2-ready-controls').getAttribute('data-phase'),'input');
        await page.keyboard.press('Escape');await page.waitForFunction(()=>document.getElementById('roller2-ready-controls').dataset.phase==='menu');
        await page.click('#roller2-ready-restart');await page.click('#roller2-ready-fullscreen');await page.focus('#roller2-ready-input');await page.keyboard.down('Space');
        try{await page.waitForFunction(()=>document.getElementById('roller2-ready-controls').dataset.phase==='input');}finally{await page.keyboard.up('Space');}
        await page.click('#roller2-ready-pause');await page.waitForFunction(()=>document.getElementById('roller2-ready-controls').dataset.phase==='stopped');
        await page.click('#roller2-ready-pause');await page.focus('#roller2-ready-input');await page.keyboard.down('ArrowLeft');
        try{await page.waitForFunction(()=>document.getElementById('roller2-ready-controls').dataset.phase==='guarded');}finally{await page.keyboard.up('ArrowLeft');}
        assert.ok((await page.locator('#roller2-ready-controls').textContent()).includes('(-1, 0)'));
        await page.click('#roller2-ready-restart');assert.strictEqual(await page.evaluate(()=>document.fullscreenElement.id),'roller2-ready-viewport');
        await page.evaluate(()=>globalThis.AMOS_ROLLER2_READY_CLEANUP());await page.waitForFunction(()=>document.fullscreenElement===null);
      }
      if(scenario.id==='roller2-ready'){
        assert.strictEqual(await page.locator('#roller2-ready-controls').getAttribute('data-backend'),'webgl');
        await page.click('#roller2-ready-pause');await page.waitForFunction(()=>document.getElementById('roller2-ready-controls').dataset.phase==='stopped');
        await page.click('#roller2-ready-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='roller2-ready-viewport');
        await page.click('#roller2-ready-restart');assert.strictEqual(await page.evaluate(()=>document.fullscreenElement.id),'roller2-ready-viewport');
        await page.waitForFunction(()=>document.getElementById('roller2-ready-controls').dataset.count==='5');await page.keyboard.down('Space');
        try{await page.waitForFunction(()=>document.getElementById('roller2-ready-controls').dataset.phase==='guarded');}finally{await page.keyboard.up('Space');}
        await page.evaluate(()=>globalThis.AMOS_ROLLER2_READY_CLEANUP());await page.waitForFunction(()=>document.fullscreenElement===null);
      }
      if(scenario.id==='roller2-boards'){
        assert.strictEqual(await page.locator('#roller2-board-controls').getAttribute('data-backend'),'webgl');
        assert.strictEqual(await page.locator('#roller2-board-controls').getAttribute('data-count'),'5');
        await page.click('#roller2-board-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='roller2-board-viewport');
        await page.selectOption('#roller2-board-level','10');assert.strictEqual(await page.locator('#roller2-board-controls').getAttribute('data-count'),'25');
        assert.strictEqual(await page.evaluate(()=>document.fullscreenElement.id),'roller2-board-viewport');
        await page.click('#roller2-board-load');assert.strictEqual(await page.locator('#roller2-board-controls').getAttribute('data-phase'),'ready');
        await page.selectOption('#roller2-board-level','100');assert.strictEqual(await page.locator('#roller2-board-controls').getAttribute('data-count'),'0');
        await page.evaluate(()=>globalThis.AMOS_ROLLER2_BOARD_CLEANUP());await page.waitForFunction(()=>document.fullscreenElement===null);
      }
      if(scenario.id==='roller2-icons'){
        assert.strictEqual(await page.locator('#roller2-icon-controls').getAttribute('data-backend'),'webgl');
        await page.click('#roller2-icon-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='roller2-icon-viewport');
        await page.click('#roller2-icon-copy');assert.strictEqual(await page.locator('#roller2-icon-controls').getAttribute('data-phase'),'copied');
        await page.click('#roller2-icon-reset');assert.strictEqual(await page.locator('#roller2-icon-controls').getAttribute('data-phase'),'original');
        await page.click('#roller2-icon-copy');assert.strictEqual(await page.locator('#roller2-icon-controls').getAttribute('data-phase'),'copied');
        await page.evaluate(()=>globalThis.AMOS_ROLLER2_ICON_CLEANUP());await page.waitForFunction(()=>document.fullscreenElement===null);
      }
      if(scenario.id==='roller2-levels'){
        assert.strictEqual(await page.locator('#roller2-level-controls').getAttribute('data-time'),'35');
        await page.selectOption('#roller2-level-select','7');assert.strictEqual(await page.locator('#roller2-level-controls').getAttribute('data-time'),'300');
        await page.fill('#roller2-level-time','513');await page.click('#roller2-level-apply');
        assert.strictEqual(await page.locator('#roller2-level-controls').getAttribute('data-time'),'513');assert.strictEqual(await page.locator('#roller2-level-controls').getAttribute('data-phase'),'edited');
        await page.click('#roller2-level-load');assert.strictEqual(await page.locator('#roller2-level-controls').getAttribute('data-time'),'300');
        await page.fill('#roller2-level-time','1.5');await page.click('#roller2-level-apply');assert.strictEqual(await page.locator('#roller2-level-controls').getAttribute('data-phase'),'error');
        await page.click('#roller2-level-load');assert.strictEqual(await page.locator('#roller2-level-controls').getAttribute('data-phase'),'loaded');
        await page.evaluate(()=>globalThis.AMOS_ROLLER2_LEVEL_CLEANUP());
      }
      if(scenario.id==='roller2-menu'){
        await page.waitForFunction(()=>document.getElementById('roller2-menu-controls').dataset.phase==='intro-input');
        assert.strictEqual(await page.locator('#roller2-menu-controls').getAttribute('data-backend'),'webgl');
        assert.strictEqual(await page.locator('#roller2-menu-controls').getAttribute('data-sound'),'off');
        assert.strictEqual(await page.locator('#roller2-menu-controls').getAttribute('data-sound-context'),'none');
        await page.click('#roller2-menu-sound');await page.waitForFunction(()=>document.getElementById('roller2-menu-controls').dataset.sound==='on');
        await page.waitForFunction(()=>Number(document.getElementById('roller2-menu-controls').dataset.soundPlays)>0);
        await page.click('#roller2-menu-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='roller2-menu-viewport');
        await page.click('#roller2-menu-stop');await page.waitForFunction(()=>document.getElementById('roller2-menu-controls').dataset.phase==='stopped');
        assert.strictEqual(await page.locator('#roller2-menu-controls').getAttribute('data-sound-voices'),'0');
        await page.click('#roller2-menu-resume');await page.waitForFunction(()=>document.getElementById('roller2-menu-controls').dataset.phase==='intro-input');
        await page.keyboard.press('a');await page.waitForFunction(()=>document.getElementById('roller2-menu-controls').dataset.phase==='menu');
        const point=await page.locator('#roller2-menu-input').evaluate(canvas=>{const r=canvas.getBoundingClientRect(),sx=r.width/canvas.offsetWidth,sy=r.height/canvas.offsetHeight;return{x:r.left+(canvas.clientLeft+canvas.clientWidth*30/320)*sx,y:r.top+(canvas.clientTop+canvas.clientHeight*140/268)*sy};});
        await page.mouse.move(point.x,point.y);await page.mouse.down();
        try{await page.waitForFunction(()=>document.getElementById('roller2-menu-controls').dataset.action==='game');}finally{await page.mouse.up();}
        assert.strictEqual(await page.locator('#roller2-menu-controls').getAttribute('data-game-entry'),'level-loaded');
        assert.strictEqual(await page.locator('#roller2-menu-controls').getAttribute('data-level'),'1');
        await page.click('#roller2-menu-restart');await page.waitForFunction(()=>document.getElementById('roller2-menu-controls').dataset.phase==='intro-input');
        assert.strictEqual(await page.locator('#roller2-menu-controls').getAttribute('data-sound'),'on');
        await page.keyboard.press('a');await page.waitForFunction(()=>document.getElementById('roller2-menu-controls').dataset.phase==='menu');
        await page.click('#roller2-menu-sound');assert.strictEqual(await page.locator('#roller2-menu-controls').getAttribute('data-sound'),'off');
        assert.strictEqual(await page.locator('#roller2-menu-controls').getAttribute('data-sound-voices'),'0');
        await page.keyboard.press('h');await page.waitForFunction(()=>document.getElementById('roller2-menu-controls').dataset.action==='scores');
        await page.click('#roller2-menu-restart');await page.waitForFunction(()=>document.getElementById('roller2-menu-controls').dataset.phase==='intro-input');
        await page.keyboard.press('a');await page.waitForFunction(()=>document.getElementById('roller2-menu-controls').dataset.phase==='menu');
        await page.locator('#roller2-menu-input').evaluate(canvas=>canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'Help',code:'Help',bubbles:true,cancelable:true})));
        await page.waitForFunction(()=>document.getElementById('roller2-menu-controls').dataset.action==='help');
        await page.evaluate(()=>globalThis.AMOS_ROLLER2_MENU_CLEANUP());await page.waitForFunction(()=>document.fullscreenElement===null);
        assert.strictEqual(await page.locator('#roller2-menu-controls').getAttribute('data-sound'),'disposed');
        assert.strictEqual(await page.locator('#roller2-menu-controls').getAttribute('data-sound-context'),'closed');
      }
      if(scenario.id==='roller2-intro'){
        await page.waitForFunction(()=>document.getElementById('roller2-intro-controls').dataset.phase==='waiting-input');
        assert.strictEqual(await page.locator('#roller2-intro-controls').getAttribute('data-backend'),'webgl');
        await page.click('#roller2-intro-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='roller2-intro-viewport');
        await page.click('#roller2-intro-stop');await page.waitForFunction(()=>document.getElementById('roller2-intro-controls').dataset.phase==='stopped');
        await page.click('#roller2-intro-resume');await page.waitForFunction(()=>document.getElementById('roller2-intro-controls').dataset.phase==='waiting-input');
        await page.hover('#roller2-intro-input');await page.mouse.down();
        try { await page.waitForFunction(()=>document.getElementById('roller2-intro-controls').dataset.phase==='fading'); }
        finally { await page.mouse.up(); }
        await page.waitForFunction(()=>document.getElementById('roller2-intro-controls').dataset.phase==='title-ready');
        assert.strictEqual(await page.locator('#roller2-intro-controls').getAttribute('data-bitmap-height'),'512');
        assert.strictEqual(await page.locator('#roller2-intro-controls').getAttribute('data-initialized'),'true');
        assert.match(await page.locator('#roller2-intro-initialization').textContent(),/daninsani/);
        await page.click('#roller2-intro-restart');await page.waitForFunction(()=>document.getElementById('roller2-intro-controls').dataset.phase==='waiting-input');
        assert.strictEqual(await page.locator('#roller2-intro-controls').getAttribute('data-initialized'),'false');
        await page.keyboard.press('Space');await page.waitForFunction(()=>document.getElementById('roller2-intro-controls').dataset.phase==='title-ready');
        assert.strictEqual(await page.locator('#roller2-intro-controls').getAttribute('data-scores'),'loaded');
        await page.click('#roller2-intro-restart');await page.waitForFunction(()=>document.getElementById('roller2-intro-controls').dataset.phase==='waiting-input');
        await page.locator('#roller2-intro-input').evaluate(canvas=>{
          const r=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+10,clientY:r.top+10,buttons:3,bubbles:true}));
        });
        await page.waitForFunction(()=>document.getElementById('roller2-intro-controls').dataset.phase==='title-ready');
        assert.strictEqual(await page.locator('#roller2-intro-controls').getAttribute('data-scores'),'defaults');
        assert.doesNotMatch(await page.locator('#roller2-intro-initialization').textContent(),/daninsani/);
        await page.evaluate(()=>globalThis.AMOS_ROLLER2_INTRO_CLEANUP());await page.waitForFunction(()=>document.fullscreenElement===null);
      }
      if(scenario.id==='roller2-title'){
        await page.waitForFunction(()=>document.getElementById('roller2-title-controls').dataset.phase==='ready');
        assert.strictEqual(await page.locator('#roller2-title-controls').getAttribute('data-backend'),'webgl');
        assert.ok(Number(await page.locator('#roller2-title-controls').getAttribute('data-gpu-frames'))>0);
        await page.click('#roller2-title-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='roller2-title-viewport');
        await page.click('#roller2-title-stop');await page.waitForFunction(()=>document.getElementById('roller2-title-controls').dataset.phase==='stopped');
        await page.click('#roller2-title-resume');await page.waitForFunction(()=>document.getElementById('roller2-title-controls').dataset.phase==='ready');
        await page.click('#roller2-title-restart');await page.waitForFunction(()=>document.getElementById('roller2-title-controls').dataset.phase==='ready');
        assert.strictEqual(await page.evaluate(()=>document.fullscreenElement.id),'roller2-title-viewport');
        await page.click('#roller2-title-input');await page.keyboard.press('Enter');
        await page.waitForFunction(()=>document.getElementById('roller2-title-controls').dataset.phase==='ended');
        await page.evaluate(()=>globalThis.AMOS_ROLLER2_TITLE_CLEANUP());await page.waitForFunction(()=>document.fullscreenElement===null);
      }
      if(scenario.id==='roller2-startup'){
        await page.click('#roller2-startup-step');assert.strictEqual(await page.locator('#roller2-startup-controls').getAttribute('data-field'),'12');
        await page.click('#roller2-startup-reset');assert.strictEqual(await page.locator('#roller2-startup-controls').getAttribute('data-field'),'0');
        await page.evaluate(()=>globalThis.AMOS_ROLLER2_STARTUP_CLEANUP());
      }
      if (scenario.id === 'tunnel') {
        assert.strictEqual(await page.locator('#tunnel-controls').getAttribute('data-backend'), 'webgl');
        await page.click('#tunnel-pause'); const frame = await page.locator('#tunnel-controls').getAttribute('data-frame');
        await page.waitForTimeout(60); assert.strictEqual(await page.locator('#tunnel-controls').getAttribute('data-frame'), frame);
        await page.click('#tunnel-step'); assert.strictEqual(Number(await page.locator('#tunnel-controls').getAttribute('data-frame')), Number(frame) + 1);
        await page.click('#tunnel-fullscreen'); await page.waitForFunction(() => document.fullscreenElement && document.fullscreenElement.id === 'tunnel-viewport');
        await page.click('#tunnel-restart'); assert.strictEqual(await page.locator('#tunnel-controls').getAttribute('data-frame'), '1');
        await page.setInputFiles('#tunnel-background', { name: 'background.iff', mimeType: 'application/octet-stream', buffer: require('fs').readFileSync(path.join(__dirname, '../fixtures/tunnel/blank.iff')) });
        await page.waitForFunction(() => document.getElementById('tunnel-controls').dataset.background === 'uploaded');
        await page.click('#tunnel-resume'); await page.waitForFunction(() => Number(document.getElementById('tunnel-controls').dataset.frame) > 1);
        await page.click('#tunnel-pause'); await page.setInputFiles('#tunnel-background', { name: 'bad.iff', mimeType: 'application/octet-stream', buffer: Buffer.from('not an IFF') });
        await page.waitForFunction(() => document.getElementById('tunnel-controls').dataset.phase === 'error');
        await page.click('#tunnel-original'); await page.waitForFunction(() => document.getElementById('tunnel-controls').dataset.background === 'original' && document.getElementById('tunnel-controls').dataset.phase === 'paused');
        await page.evaluate(() => AMOS_TUNNEL_CLEANUP()); await page.waitForFunction(() => document.fullscreenElement === null);
      }
      if (scenario.id === 'roller2-game') {
        await page.waitForFunction(() => document.getElementById('roller2-game-controls').dataset.line === '164');
        assert.strictEqual(await page.locator('#roller2-game-controls').getAttribute('data-backend'), 'webgl');
        await page.click('#roller2-game-sound');
        await page.waitForFunction(() => document.getElementById('roller2-game-controls').dataset.sound === 'on');
        await page.click('#roller2-game-fullscreen'); await page.waitForFunction(() => document.fullscreenElement && document.fullscreenElement.id === 'roller2-game-viewport');
        await page.locator('#roller2-game-input').focus(); await page.keyboard.press('a');
        await page.waitForFunction(() => document.getElementById('roller2-game-controls').dataset.phase === 'menu');
        await page.keyboard.down('ControlLeft');
        try { await page.waitForFunction(() => document.getElementById('roller2-game-controls').dataset.level === '1'); } finally { await page.keyboard.up('ControlLeft'); }
        await page.waitForFunction(() => document.getElementById('roller2-game-controls').dataset.phase === 'ready' && document.getElementById('roller2-game-controls').dataset.line === '154');
        await page.keyboard.down('ControlLeft');
        try { await page.waitForFunction(() => document.getElementById('roller2-game-controls').dataset.phase === 'game'); } finally { await page.keyboard.up('ControlLeft'); }
        await page.waitForFunction(() => { const n = Number(document.getElementById('roller2-game-controls').dataset.line); return n >= 619 && n <= 639; });
        await page.click('#roller2-game-stop'); await page.waitForFunction(() => document.getElementById('roller2-game-controls').dataset.phase === 'stopped');
        assert.strictEqual(await page.locator('#roller2-game-controls').getAttribute('data-sound-voices'), '0');
        await page.click('#roller2-game-resume'); await page.waitForFunction(() => document.getElementById('roller2-game-controls').dataset.phase === 'game');
        await page.waitForFunction(() => document.getElementById('roller2-game-controls').dataset.phase === 'game-over', null, { timeout: 45000 });
        await page.locator('#roller2-game-input').focus(); await page.keyboard.press('a');
        await page.waitForFunction(() => document.getElementById('roller2-game-controls').dataset.phase === 'scores');
        assert.strictEqual(await page.locator('#roller2-game-controls').getAttribute('data-sound-voices'), '0');
        await page.waitForFunction(() => document.getElementById('roller2-game-controls').dataset.phase === 'menu');
        await page.locator('#roller2-game-input').focus(); await page.keyboard.down('ControlLeft');
        try { await page.waitForFunction(() => { const n = Number(document.getElementById('roller2-game-controls').dataset.line); return n < 298 || n > 316; }); } finally { await page.keyboard.up('ControlLeft'); }
        await page.waitForFunction(() => document.getElementById('roller2-game-controls').dataset.phase === 'ready' && document.getElementById('roller2-game-controls').dataset.line === '154');
        await page.click('#roller2-game-restart'); await page.waitForFunction(() => document.getElementById('roller2-game-controls').dataset.line === '164');
        assert.strictEqual(await page.locator('#roller2-game-controls').getAttribute('data-sound'), 'on');
        await page.locator('#roller2-game-input').focus(); await page.keyboard.press('a');
        await page.waitForFunction(() => document.getElementById('roller2-game-controls').dataset.phase === 'menu');
        await page.keyboard.press('h'); await page.waitForFunction(() => document.getElementById('roller2-game-controls').dataset.phase === 'scores');
        await page.click('#roller2-game-restart'); await page.waitForFunction(() => document.getElementById('roller2-game-controls').dataset.line === '164');
        await page.locator('#roller2-game-input').focus(); await page.keyboard.press('a');
        await page.waitForFunction(() => document.getElementById('roller2-game-controls').dataset.phase === 'menu');
        const editorMenu = await page.locator('#roller2-game-input').boundingBox();
        await page.locator('#roller2-game-input').click({ position: { x: editorMenu.width * 282 / 320, y: editorMenu.height * 140 / 268 }, delay: 100 });
        await page.waitForFunction(() => { const c = document.getElementById('roller2-game-controls'); return c.dataset.phase === 'editor' && Number(c.dataset.line) >= 341; });
        await page.locator('#roller2-game-input').focus(); await page.keyboard.press('t');
        await page.waitForFunction(() => { const c = document.getElementById('roller2-game-controls'), n = Number(c.dataset.line); return c.dataset.phase === 'game' && n >= 619 && n <= 639; });
        await page.keyboard.press('Escape'); await page.waitForFunction(() => document.fullscreenElement === null);
        await page.keyboard.press('Escape'); await page.waitForFunction(() => document.getElementById('roller2-game-controls').dataset.line === '164');
        await page.keyboard.press('a');
        await page.waitForFunction(() => { const c = document.getElementById('roller2-game-controls'), n = Number(c.dataset.line); return c.dataset.phase === 'editor' && n >= 341 && n <= 402; });
        await page.screenshot({ path: path.join(__dirname, '../artifacts/roller2-editor.png'), fullPage: true });
        const closed = await page.evaluate(() => AMOS_ROLLER2_GAME_CLEANUP());
        assert.strictEqual(closed.contextState, 'closed'); await page.waitForFunction(() => document.fullscreenElement === null);
      }
      if (scenario.id === 'roller2-music-vm') {
        await page.click('#music-vm-play');
        await page.waitForFunction(() => Number(document.getElementById('music-vm-status').dataset.plays) > 0);
        await page.click('#music-vm-stop');
        await page.waitForFunction(() => document.getElementById('music-vm-status').dataset.phase === 'paused' && document.getElementById('music-vm-status').dataset.voices === '0');
        const field = await page.locator('#music-vm-status').getAttribute('data-field');
        await page.waitForTimeout(80); assert.strictEqual(await page.locator('#music-vm-status').getAttribute('data-field'), field);
        await page.click('#music-vm-resume');
        await page.waitForFunction(() => document.getElementById('music-vm-status').dataset.phase === 'playing');
        await page.click('#music-vm-fade');
        await page.waitForFunction(() => document.getElementById('music-vm-status').dataset.phase === 'finished');
        assert.strictEqual(await page.locator('#music-vm-status').getAttribute('data-voices'), '0');
        await page.selectOption('#music-vm-song', { label: 'Ywon.mus' }); await page.click('#music-vm-play');
        await page.waitForFunction(() => document.getElementById('music-vm-status').dataset.audio === 'on' && Number(document.getElementById('music-vm-status').dataset.field) > 1);
        const closed = await page.evaluate(() => AMOS_MUSIC_VM_CLEANUP());
        assert.strictEqual(closed.contextState, 'closed'); assert.strictEqual(closed.state, 'disposed');
      }
      if (scenario.id === 'roller2-amos-music') {
        await page.click('#amos-music-step');
        await page.waitForFunction(() => document.getElementById('amos-music-status').dataset.field === '6');
        await page.click('#amos-music-play');
        await page.waitForFunction(() => Number(document.getElementById('amos-music-status').dataset.plays) > 0);
        await page.click('#amos-music-stop');
        await page.waitForFunction(() => document.getElementById('amos-music-status').dataset.state === 'off' && document.getElementById('amos-music-status').dataset.voices === '0');
        await page.selectOption('#amos-music-song', { label: 'Ywon.mus' });
        await page.click('#amos-music-play');
        await page.waitForFunction(() => document.getElementById('amos-music-status').dataset.state === 'on' && Number(document.getElementById('amos-music-status').dataset.field) > 1);
        const closed = await page.evaluate(() => AMOS_MUSIC_DEMO_CLEANUP());
        assert.strictEqual(closed.state, 'disposed'); assert.strictEqual(closed.contextState, 'closed');
      }
      if(scenario.id==='tracker'){
        await page.click('#tracker-play');await page.waitForFunction(()=>Number(document.getElementById('tracker-status').dataset.field)>=6);
        await page.click('#tracker-pause');await page.waitForFunction(()=>document.getElementById('tracker-status').dataset.state==='paused');
        await page.click('#tracker-pause');await page.waitForFunction(()=>document.getElementById('tracker-status').dataset.state==='playing');
        await page.click('#tracker-stop');await page.waitForFunction(()=>document.getElementById('tracker-status').dataset.state==='off');
        await page.evaluate(()=>globalThis.AMOS_TRACKER_DEMO_CLEANUP());
      }
      if (scenario.id === 'wonderland-game') {
        await page.click('#frame-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='frame-view');
        await page.click('#frame-fullscreen');await page.waitForFunction(()=>document.fullscreenElement===null);
        await page.click('#game-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='game-viewport');

        assert.strictEqual(await page.locator('#game-controls').getAttribute('data-backend'),'webgl');
        assert.ok(Number(await page.locator('#game-controls').getAttribute('data-gpu-frames'))>0);
        assert.strictEqual(await page.locator('#game-input').evaluate(canvas=>canvas.getContext('2d')),null);
        assert.strictEqual(await page.locator('#game-controls').getAttribute('data-sound'),'off');
        assert.strictEqual(await page.locator('#game-controls').getAttribute('data-sound-context'),'none');
        await page.click('#game-sound');await page.waitForFunction(()=>document.getElementById('game-controls').dataset.sound==='on');
        await page.click('#game-input');await page.keyboard.down('Enter');
        await page.waitForFunction(()=>document.getElementById('game-controls').dataset.line==='204',{},{timeout:30000});await page.keyboard.up('Enter');
        const before=Number(await page.locator('#game-controls').getAttribute('data-x'));
        await page.keyboard.down('ArrowRight');
        await page.waitForFunction(x=>Number(document.getElementById('game-controls').dataset.x)>x,before);await page.keyboard.up('ArrowRight');
        const pointer=await page.locator('#game-input').evaluate(canvas=>{const r=canvas.getBoundingClientRect();return{x:r.left+canvas.clientLeft+canvas.clientWidth/4,y:r.top+canvas.clientTop+canvas.clientHeight/4};});
        await page.mouse.move(pointer.x,pointer.y);await page.waitForFunction(()=>document.getElementById('game-controls').dataset.mouseX==='208'&&document.getElementById('game-controls').dataset.mouseY==='98');
        const played=Number(await page.locator('#game-controls').getAttribute('data-sound-plays'));await page.keyboard.down('ArrowUp');
        await page.waitForFunction(played=>Number(document.getElementById('game-controls').dataset.soundPlays)>played,played);await page.keyboard.up('ArrowUp');
        await page.click('#game-sound');assert.strictEqual(await page.locator('#game-controls').getAttribute('data-sound'),'off');
        assert.strictEqual(await page.locator('#game-controls').getAttribute('data-sound-voices'),'0');
        await page.click('#game-stop');assert.strictEqual(await page.locator('#game-controls').getAttribute('data-phase'),'stopped');
        const mutedPlays=await page.locator('#game-controls').getAttribute('data-sound-plays');await page.click('#game-sound');
        await page.waitForFunction(()=>document.getElementById('game-controls').dataset.sound==='on');
        assert.strictEqual(await page.locator('#game-controls').getAttribute('data-sound-plays'),mutedPlays);

        const pausedCount=await page.locator('#game-controls').getAttribute('data-count');
        await page.selectOption('#game-renderer','canvas');assert.strictEqual(await page.locator('#game-controls').getAttribute('data-backend'),'canvas');
        assert.strictEqual(await page.evaluate(()=>document.fullscreenElement.id),'game-viewport');
        assert.strictEqual(await page.locator('#game-input').evaluate(canvas=>!!canvas.getContext('2d')),true);
        await page.click('#game-fullscreen');await page.waitForFunction(()=>document.fullscreenElement===null);
        await page.click('#game-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='game-viewport');
        const fullscreenSession=await page.context().newCDPSession(page);
        await fullscreenSession.send('Emulation.setDeviceMetricsOverride',{width:1100,height:800,deviceScaleFactor:1,mobile:false});
        await page.waitForFunction(()=>{const image=document.getElementById('game-input').getBoundingClientRect(),slot=document.getElementById('game-surface').getBoundingClientRect();return image.width<=slot.width+1&&image.height<=slot.height+1&&Math.abs((image.width-4)/(image.height-4)-320/202)<0.02;});
        await fullscreenSession.send('Emulation.clearDeviceMetricsOverride');await fullscreenSession.detach();
        assert.strictEqual(await page.locator('#game-controls').getAttribute('data-count'),pausedCount);
        assert.strictEqual(await page.locator('#game-controls').getAttribute('data-phase'),'stopped');
        await page.selectOption('#game-renderer','webgl');assert.strictEqual(await page.locator('#game-controls').getAttribute('data-backend'),'webgl');
        assert.strictEqual(await page.evaluate(()=>document.fullscreenElement.id),'game-viewport');
        assert.strictEqual(await page.locator('#game-controls').getAttribute('data-count'),pausedCount);
        assert.strictEqual(await page.locator('#game-controls').getAttribute('data-sound'),'on');
        await page.click('#game-resume');assert.strictEqual(await page.locator('#game-controls').getAttribute('data-phase'),'running');
        const beforeLoss=Number(await page.locator('#game-controls').getAttribute('data-count'));
        await page.locator('#game-input').evaluate(canvas=>{globalThis.AMOS_TEST_GPU_LOSS=canvas.getContext('webgl2').getExtension('WEBGL_lose_context');globalThis.AMOS_TEST_GPU_LOSS.loseContext();});
        await page.waitForFunction(()=>document.getElementById('game-controls').dataset.gpuState==='lost');
        await page.waitForFunction(count=>Number(document.getElementById('game-controls').dataset.count)>count,beforeLoss);
        await page.click('#game-stop');const stoppedCount=await page.locator('#game-controls').getAttribute('data-count');
        await page.evaluate(()=>globalThis.AMOS_TEST_GPU_LOSS.restoreContext());
        await page.waitForFunction(()=>document.getElementById('game-controls').dataset.gpuState==='ready');
        assert.strictEqual(await page.locator('#game-controls').getAttribute('data-count'),stoppedCount);
        assert.strictEqual(await page.locator('#game-controls').getAttribute('data-phase'),'stopped');
        assert.strictEqual(await page.locator('#game-controls').getAttribute('data-backend'),'webgl');
        await page.click('#game-resume');

        const beforeExit=Number(await page.locator('#game-controls').getAttribute('data-count'));
        await page.keyboard.press('Escape');await page.waitForFunction(()=>document.fullscreenElement===null);
        await page.waitForFunction(count=>Number(document.getElementById('game-controls').dataset.count)>count,beforeExit);
        assert.strictEqual(await page.locator('#game-controls').getAttribute('data-display-lines'),'202');
        await page.keyboard.press('Escape');await page.waitForFunction(()=>document.getElementById('game-controls').dataset.displayLines==='256');
        await page.click('#game-fullscreen');await page.waitForFunction(()=>document.fullscreenElement&&document.fullscreenElement.id==='game-viewport');
        await page.click('#game-restart');await page.waitForFunction(()=>document.getElementById('game-controls').dataset.sound==='on');
        assert.strictEqual(await page.evaluate(()=>document.fullscreenElement.id),'game-viewport');
        assert.strictEqual(await page.locator('#game-controls').getAttribute('data-sound-voices'),'0');await page.selectOption('#game-keyboard-layout','wasd');await page.keyboard.down('z');
        await page.waitForFunction(()=>document.getElementById('game-controls').dataset.line==='204',{},{timeout:30000});await page.keyboard.up('z');
        await page.click('#game-restart');await page.selectOption('#game-keyboard-layout','arrows');await page.keyboard.down('ArrowDown');
        await page.waitForFunction(()=>Number(document.getElementById('game-controls').dataset.menuPosition)>0);await page.keyboard.up('ArrowDown');
        await page.waitForFunction(()=>document.getElementById('game-controls').dataset.menuPosition==='25');
        await page.hover('#game-input',{position:{x:100,y:70}});await page.keyboard.down('Enter');
        await page.waitForFunction(()=>document.getElementById('game-controls').dataset.game==='2'&&document.getElementById('game-controls').dataset.line==='399');await page.keyboard.up('Enter');
        await page.keyboard.press('l');await page.waitForFunction(()=>document.getElementById('game-controls').dataset.phase==='error');
        assert.match(await page.locator('#game-status').textContent(),/synchronous files.select/);
        await page.click('#game-resume');assert.strictEqual(await page.locator('#game-controls').getAttribute('data-phase'),'error');
        assert.strictEqual(await page.locator('#game-controls').getAttribute('data-sound-voices'),'0');
        assert.strictEqual(await page.evaluate(()=>document.fullscreenElement.id),'game-viewport');
        assert.strictEqual(await page.locator('#game-status').isVisible(),true);
        await page.evaluate(()=>globalThis.AMOS_GAME_DEMO_CLEANUP());
        assert.strictEqual(await page.evaluate(()=>document.fullscreenElement),null);
        assert.strictEqual(await page.locator('#game-controls').getAttribute('data-sound'),'disposed');
        assert.strictEqual(await page.locator('#game-controls').getAttribute('data-sound-context'),'closed');
      }
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
        await page.click('#selector-whole');assert.strictEqual(await page.locator('#selector-controls').getAttribute('data-running'),'true');
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
        assert.strictEqual(await page.locator('#using-controls').getAttribute('data-output'),'  7.00');
        await page.fill('#using-format','###;##');await page.click('#using-render');
        assert.match(await page.locator('#using-status').textContent(),/Decimal\/exponent/);
        assert.strictEqual(await page.locator('#using-controls').getAttribute('data-output'),'  7.00');
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
        await page.focus('#scan-input');await page.dispatchEvent('#scan-input','keydown',{key:'Help',code:'Help'});
        assert.strictEqual(await page.locator('#scan-held').getAttribute('data-help'),'-1');await page.dispatchEvent('#scan-input','keyup',{key:'Help',code:'Help'});
        assert.strictEqual(await page.locator('#scan-held').getAttribute('data-help'),'0');
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
