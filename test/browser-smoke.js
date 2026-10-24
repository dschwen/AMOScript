/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(__dirname, '../.cache/ms-playwright');
const { chromium } = require('playwright');
const { comparePixels } = require('./helpers/displayFrames');
const { encodePng } = require('./helpers/displayPng');
const { runScenario } = require('./helpers/browserScenarios');

async function run() {
  const browser = await chromium.launch({ headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('Browser page error:', error.message); });
    await page.goto(pathToFileURL(path.join(__dirname, '../demos/programs.html')).href);
    await runScenario('fade', page);
    console.log('Fade passed: original timed fade, nine independent RGB frames, immutable snapshots, physical-buffer preservation and no animation-clock dependency.');
    await runScenario('scancodes', page);
    console.log('Scancodes passed: raw key/character pairing, destructive reads, repeats, joystick passthrough, cleanup and original Escape/title branch.');
    await runScenario('computed-branches', page);
    console.log('Computed branches passed: On Gosub/Goto fallthrough/return traces and three original Wonderland enemy initializers.');
    await runScenario('screen-windows', page);
    console.log('Screen windows passed: original game/editor setup, landscape offsets, panel pixels, blank gaps and View staging.');
    await runScenario('wonderland-menu', page);
    console.log('Joysticks passed: keyboard remapping, standard/raw gamepad decoding, focus/disconnect/security cleanup and original menu selections/animations.');
    await runScenario('key-repeat', page);
    console.log('Key Speed passed: fixed 50 Hz units, held-key repeats, native duplicate suppression and release/lifecycle cleanup.');
    await runScenario('music', page);
    console.log('Web Audio passed: six original sample PCM/stereo/rate comparisons, loops, voice replacement, Stop and disposal.');
    const wonderland = await runScenario('wonderland', page);
    console.log('Wonderland title: original first 64 lines execute through Wait Vbl, Load Iff and the menu Bob; Canvas and copper match independent composition in both startup branches.');
    console.log(`Wonderland: ${wonderland.images.length} original images match independent PNGs; ${wonderland.unrecognizedEncodings} encodings still unrecognized; gameRunning=${wonderland.gameRunning}`);
    const gpu = await runScenario('webgl-integers', page);
    const artifacts = path.join(__dirname, 'artifacts');
    fs.mkdirSync(artifacts, { recursive: true });
    const readback = Uint8ClampedArray.from(gpu.pixels);
    const diff = comparePixels(2, 2, readback,
      Uint8ClampedArray.from([131, 124, 2, 255, 251, 4, 3, 255, 17, 238, 0, 255, 67, 188, 1, 255]));
    const png = encodePng(2, 2, readback);
    fs.writeFileSync(path.join(artifacts, 'webgl-readback.png'), png);
    fs.writeFileSync(path.join(artifacts, 'webgl-readback-diff.png'), encodePng(2, 2, diff.diff));
    // Check our artifact writer with Chromium's independent PNG decoder.
    const decoded = await page.evaluate(async url => {
      const image = new Image();
      image.src = url; await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      return Array.from(context.getImageData(0, 0, image.width, image.height).data);
    }, `data:image/png;base64,${png.toString('base64')}`);
    assert.deepStrictEqual(decoded, gpu.pixels);
    console.log('WebGL2 probe passed: R8UI chip bytes, uint addressing, integer framebuffer and top-left readback (SwiftShader).');
    await runScenario('webgl-resources', page);
    console.log('WebGL2 resources passed: exact chip/table readback, independent dirty uploads and loss/restore/disposal.');
    const gpuRenderer = await runScenario('webgl-renderer', page, artifacts);
    console.log(`WebGL2 renderer passed: ${gpuRenderer.checked} GPU/CPU frames (${gpuRenderer.imageCount} independent image fields, ${gpuRenderer.namedCount} mode/sprite/copper matrices, 100 seeded frames), decode traces, ${gpuRenderer.presentationChecks} presentation checks and restoration.`);
    const dma = await runScenario('sprite-dma', page);
    fs.writeFileSync(path.join(artifacts, 'sprite-dma.png'), Buffer.from(dma.png.split(',')[1], 'base64'));
    console.log('Sprite DMA probe passed: standalone CPU factories, chained reuse, armed-row retention and Canvas pixels.');
    await runScenario('trigonometry', page, artifacts);
    const ehbResult = await runScenario('ehb', page, artifacts);
    fs.writeFileSync(path.join(artifacts, 'ehb.png'), Buffer.from(ehbResult.png.split(',')[1], 'base64'));
    const hamResult = await runScenario('ham', page, artifacts);
    fs.writeFileSync(path.join(artifacts, 'ham.png'), Buffer.from(hamResult.png.split(',')[1], 'base64'));
    await runScenario('sprites', page, artifacts);
    await runScenario('banks', page, artifacts);
    await page.click('#run');
    assert.strictEqual(await page.locator('#output').textContent(), 'Start\nOne\nTwo\nThree\nEnd\n');
    await page.click('#graphics');
    assert.strictEqual(await page.locator('#output').textContent(), 'AMOScript\nPress a key to continue\n');
    assert.strictEqual(await page.evaluate(() => AMOS.state.waiting), 'key');
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const pixels = await page.evaluate(() => {
      const context = document.getElementById('screen').getContext('2d');
      return [[20, 100], [200, 80], [16, 160]].map(([x, y]) => Array.from(context.getImageData(x, y, 1, 1).data));
    });
    assert.deepStrictEqual(pixels, [[0, 136, 255, 255], [34, 204, 136, 255], [255, 136, 0, 255]]);
    const imagePixels = await page.evaluate(() => {
      const context = document.getElementById('screen').getContext('2d');
      return [[200, 104], [256, 104], [205, 109], [204, 108], [203, 106]].map(([x, y]) => Array.from(context.getImageData(x, y, 1, 1).data));
    });
    assert.deepStrictEqual(imagePixels, [[0, 136, 255, 255], [0, 0, 0, 255], [255, 255, 255, 255], [34, 204, 136, 255], [255, 136, 0, 255]]);
    const bounds = await page.locator('#screen').boundingBox();
    const point = await page.evaluate(() => {
      const canvas = document.getElementById('screen');
      return { x: canvas.clientLeft + canvas.clientWidth / 2, y: canvas.clientTop + canvas.clientHeight / 2 };
    });
    await page.mouse.move(bounds.x + point.x, bounds.y + point.y);
    await page.mouse.down();
    assert.deepStrictEqual(await page.evaluate(() => AMOS.state.input.mouse), { x: 160, y: 100, buttons: 1 });
    await page.mouse.up();
    assert.strictEqual(await page.evaluate(() => AMOS.state.input.mouse.buttons), 0);
    await page.keyboard.press('Enter');
    try {
      await page.waitForFunction(() => AMOS.state.halted, null, { timeout: 5000 });
    } catch (error) {
      console.error(await page.evaluate(() => ({ focused: document.activeElement.id, ip: AMOS.state.ip, waiting: AMOS.state.waiting, stopped: AMOS.state.stopped, output: document.getElementById('output').textContent })));
      throw error;
    }
    assert.strictEqual(await page.locator('#output').textContent(), 'AMOScript\nPress a key to continue\nReady\n');
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const flippedPixels = await page.evaluate(() => {
      const context = document.getElementById('screen').getContext('2d');
      return [[256, 128], [200, 128], [267, 136], [260, 136], [204, 135], [204, 136]].map(([x, y]) => Array.from(context.getImageData(x, y, 1, 1).data));
    });
    assert.deepStrictEqual(flippedPixels, [[0, 136, 255, 255], [0, 0, 0, 255], [255, 255, 255, 255], [34, 204, 136, 255], [255, 255, 255, 255], [34, 204, 136, 255]]);
    await page.screenshot({ path: path.join(artifacts, 'graphics.png'), fullPage: true });
    await page.click('#bobs');
    assert.strictEqual(await page.evaluate(() => AMOS.state.waiting), 'key');
    assert.deepStrictEqual(await page.evaluate(() => [AMOS.state.variables.int_hitstart, AMOS.state.variables.int_otherstart]), [-1, 1]);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    assert.strictEqual(await page.evaluate(() => AMOS.state.halted), false);
    const hiddenBob = await page.evaluate(() => Array.from(document.getElementById('screen').getContext('2d').getImageData(40, 112, 1, 1).data));
    assert.deepStrictEqual(hiddenBob, [0, 136, 255, 255]);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getElementById('screen').getContext('2d').getImageData(40, 112, 1, 1).data[1] === 204, null, { timeout: 5000 });
    assert.strictEqual(await page.evaluate(() => AMOS.state.waiting), 'key');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => AMOS.state.waiting === 'key' && AMOS.state.variables.int_x === 140, null, { timeout: 5000 });
    assert.deepStrictEqual(await page.evaluate(() => [AMOS.state.variables.int_hitend, AMOS.state.variables.int_otherend]), [0, 0]);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const bobPixels = await page.evaluate(() => {
      const context = document.getElementById('screen').getContext('2d');
      return [[40, 112], [124, 112], [128, 112], [144, 128]].map(([x, y]) => Array.from(context.getImageData(x, y, 1, 1).data));
    });
    assert.deepStrictEqual(bobPixels, [[0, 136, 255, 255], [34, 204, 136, 255], [0, 136, 255, 255], [34, 204, 136, 255]]);
    await page.screenshot({ path: path.join(artifacts, 'bobs.png'), fullPage: true });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => AMOS.state.halted);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const restoredBobPixel = await page.evaluate(() => Array.from(document.getElementById('screen').getContext('2d').getImageData(124, 112, 1, 1).data));
    assert.deepStrictEqual(restoredBobPixel, [0, 136, 255, 255]);
    await page.click('#bobs');
    await page.click('#stop');
    assert.strictEqual(await page.evaluate(() => AMOS.state.stopped), true);
    await require('./helpers/checkBrowserDemos')(browser);
    assert.deepStrictEqual(errors, []);
    console.log('Browser smoke passed: standalone bank load/save/reload/appending/reservation/swap/shrink/erasure, trigonometry/angle modes and pixels, Canvas shapes, direct sprite manual updates/movement/isolation/cursor restoration, bank images, flipping/masks, buffered Bobs with modes/limits and collisions, swaps, restoration, input, switching, and Stop.');
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
