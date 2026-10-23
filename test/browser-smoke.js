/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(__dirname, '../.cache/ms-playwright');
const { chromium } = require('playwright');
const Transpiler = require('../lib/Transpiler');
const { binary, token: t, integer: n, text } = require('./helpers/tokens');

async function run() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('Browser page error:', error.message); });
    await page.goto(pathToFileURL(path.join(__dirname, '../index.html')).href);
    const trig = (name, value) => [t(name), t('('), n(value), t(')')];
    const trigSource = new Transpiler(binary([
      [t('Cls Colour'), n(0)], [t('Colour'), n(3), t(','), n(0xf00)], [t('Ink'), n(3)], [t('Degree')],
      [t('Plot'), n(10), t(','), n(100), t('-'), trig('Sin', 90), t('*'), n(20)],
      [t('Plot'), n(20), t(','), n(100), t('-'), trig('Cos', 0), t('*'), n(20)],
      [t('Print'), trig('Sin', 90), t(','), trig('Cos', 0), t(','), trig('Tan', 0)],
      [t('Radian')], [t('Print'), trig('Sin', 0)]
    ])).toModule();
    const trigResult = await page.evaluate(source => {
      const module = { exports: {} };
      new Function('module', source)(module);
      const logs = [];
      const program = module.exports({ print: (...args) => logs.push(args) });
      const canvas = document.createElement('canvas');
      const host = AMOS_BROWSER.createCanvasHost(canvas);
      host.attach(program);
      program.tick(100);
      host.render();
      const pixels = [[10, 80], [20, 80], [10, 79]].map(([x, y]) => Array.from(canvas.getContext('2d').getImageData(x, y, 1, 1).data));
      host.detach();
      return { logs, pixels, halted: program.state.halted };
    }, trigSource);
    assert.deepStrictEqual(trigResult, { logs: [[1, 1, 0], [0]],
      pixels: [[255, 0, 0, 255], [255, 0, 0, 255], [0, 0, 0, 255]], halted: true });
    const bankBytes = Buffer.from(fs.readFileSync(path.join(__dirname, 'fixtures/image-banks.hex'), 'utf8').replace(/\s/g, ''), 'hex');
    const bankSource = new Transpiler(binary([
      [t('Load'), text('objects.abk')], [t('Get Sprite Palette')], [t('Cls Colour'), n(0)],
      [t('Paste Bob'), n(10), t(','), n(10), t(','), n(1)],
      [t('Load Bank'), text('objects.abk'), t(','), n(1)],
      [t('Paste Bob'), n(30), t(','), n(10), t(','), n(3)],
      [t('Reserve As Work'), n(5), t(','), n(3)], [t('Reserve As Data'), n(6), t(','), n(4)],
      [t('Hot Spot'), n(1), t(','), n(0), t(','), n(0)], [t('Double Buffer')], [t('Bob Update Off')],
      [t('Bob'), n(0), t(','), n(60), t(','), n(10), t(','), n(1)], [t('Bob Update')], [t('Wait Key')],
      [t('Erase'), n(1)], [t('Bob Update')], [t('Erase Temp')]
    ])).toModule();
    const bankResult = await page.evaluate(({ source, bytes }) => {
      const module = { exports: {} };
      new Function('module', source)(module);
      const program = module.exports({ files: { read: () => bytes } });
      const canvas = document.createElement('canvas');
      const host = AMOS_BROWSER.createCanvasHost(canvas);
      host.attach(program);
      program.tick(100);
      host.render();
      const pixels = [[10, 10], [11, 10], [30, 10], [31, 10], [9, 10]].map(([x, y]) =>
        Array.from(canvas.getContext('2d').getImageData(x, y, 1, 1).data));
      const images = program.banks.get(1).images.length;
      const bobPixel = Array.from(canvas.getContext('2d').getImageData(60, 10, 1, 1).data);
      program.sendKey('x');
      program.tick(100);
      host.render();
      const restored = Array.from(canvas.getContext('2d').getImageData(60, 10, 1, 1).data);
      host.detach();
      return { pixels, images, bobPixel, restored, work: program.bankLength(5), data: program.bankLength(6), halted: program.state.halted };
    }, { source: bankSource, bytes: bankBytes.subarray(26, 124).toString('latin1') });
    assert.deepStrictEqual(bankResult, { pixels: [[255, 0, 0, 255], [0, 255, 0, 255],
      [255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 0, 255]], images: 4,
      bobPixel: [255, 0, 0, 255], restored: [0, 0, 0, 255], work: 0, data: 4, halted: true });
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
    const artifacts = path.join(__dirname, 'artifacts');
    fs.mkdirSync(artifacts, { recursive: true });
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
    assert.deepStrictEqual(errors, []);
    console.log('Browser smoke passed: standalone bank loading/appending/reservation/erasure, trigonometry/angle modes and pixels, Canvas shapes, bank images, flipping/masks, buffered Bobs with modes/limits and collisions, swaps, restoration, input, switching, and Stop.');
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
