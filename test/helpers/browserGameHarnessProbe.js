/* jshint esversion: 6 */
'use strict';
module.exports = async function browserGameHarnessProbe(page) {
  const fs = require('fs'), path = require('path'), Transpiler = require('../../lib/Transpiler');
  const { binary, token: t, integer: n, text, word: w, identifier: id } = require('./tokens');
  const message = 'ÄÖÜ äöü ß';
  const bytes = binary([[t('Cls Colour'), n(0)], [t('Colour'), n(1), t(','), n(0xfff)], [t('Pen'), n(1)], [t('Paper'), n(0)],
    [t('Print'), text(message)], [t('Writing'), n(2)], [t('Print'), text(message)], [t('Ink'), n(1)],
    [t('Text'), n(0), t(','), n(23), t(','), text(message)],
    [t('Do'), w(0)], [id('mask'), t('='), t('Joy'), t('('), n(1), t(')')], [t('Wait Vbl')], [t('Loop')]]);
  const header = fs.readFileSync(path.join(__dirname, '../fixtures/font/font8x8_ext_latin.h'), 'utf8');
  const rows = [...header.matchAll(/\{\s*((?:0x[0-9a-f]+,?\s*){8})\}/gi)].map(match => match[1].match(/0x[0-9a-f]+/gi).map(Number));
  return page.evaluate(async ({ source, rows, message, timerSource, gpuSources, tutorial }) => {
    const compiled = { exports: {} }; new Function('module', source)(compiled);
    const clock = new Function(`return (${timerSource});`)()(4);
    const p = compiled.exports({ now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout }); p.tick(1000);
    const region = document.createElement('section'), canvas = document.createElement('canvas'); region.append(canvas); document.body.append(region);
    let pad = null, gpu = null, gpuFrames = 0;
    const host = AMOS_BROWSER.createCanvasHost(canvas, { hasFocus: () => true, getGamepads: () => pad,
      joysticks: [{ port: 1, keyboard: true, gamepad: true }], virtualJoystick: { container: region, visibility: 'always', fullscreenOnly: false }, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    const check = (value, message) => { if (!value) throw Error(message); };
    const button = direction => region.querySelector(`[data-direction="${direction}"]`);
    const pointer = (type, direction, pointerId) => button(direction).dispatchEvent(new PointerEvent(type, { pointerId, pointerType: 'touch', button: 0, bubbles: true, cancelable: true }));
    const key = (type, code) => canvas.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
    let assertions = 0;
    const mask = expected => { check(p.joystickInfo('Joy', 1) === expected, `Virtual/keyboard/gamepad mask differs: wanted ${expected}`); assertions++; };
    try {
      host.attach(p); host.render();
      const rgba = canvas.getContext('2d').getImageData(0, 0, 320, 200).data;
      for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) {
        const character = Math.floor(x / 8), code = character < message.length ? message.charCodeAt(character) : 32;
        const bits = y < 24 && code !== 32 ? rows[code - 160][y % 8] : 0, value = (bits >> (x % 8)) & 1 ? 255 : 0;
        const at = (y * 320 + x) * 4; check(rgba[at] === value && rgba[at + 1] === value && rgba[at + 2] === value && rgba[at + 3] === 255, `Latin-1 pixel mismatch ${x},${y}`);
      }
      if (globalThis.AMOS_DEMO_OBSERVE) globalThis.AMOS_DEMO_OBSERVE({ name: 'Independent Latin-1 Print, Writing and Text', width: 320, height: 200, rgba });
      const make = name => new Function(`return (${gpuSources[name]});`)(), model = make('model')();
      gpu = make('renderer')(model, make('sprites')(), make('resources')(model), make('shaders'), make('layout'))(document.createElement('canvas'));
      const gpuHost = AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas, { renderer: gpu, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
      const previous = p.display.canvasFrame; p.display.canvasFrame = () => { throw Error('GPU used CPU presentation'); };
      try { gpuHost.attach(p); gpuHost.render(); } finally { p.display.canvasFrame = previous; gpuHost.detach(); }
      const pixels = gpu.readPixels(), cpu = p.display.renderDisplay();
      check(gpu.stats.lastResult.backend === 'gpu' && pixels.length === cpu.length && pixels.every((v, i) => v === cpu[i]), 'Latin-1 GPU mismatch'); gpuFrames++;
      if (globalThis.AMOS_DEMO_OBSERVE) globalThis.AMOS_DEMO_OBSERVE({ name: 'WebGL Latin-1 text', width: 640, height: 200, rgba: pixels });
      pointer('pointerdown', 'up', 1); pointer('pointerdown', 'fire', 2); mask(17);
      check(p.inputValue('Inkey$') === '' && p.state.input.mouse.buttons === 0, 'Touch joystick generated text or AMOS mouse clicks');
      key('keydown', 'ArrowRight'); mask(25);
      pointer('pointerup', 'up', 1); mask(24); pointer('pointercancel', 'fire', 2); mask(8); key('keyup', 'ArrowRight'); mask(0);
      pointer('pointerdown', 'right', 3); pointer('pointerdown', 'right', 4); pointer('pointerup', 'right', 3); mask(8); pointer('lostpointercapture', 'right', 4); mask(0);
      key('keydown', 'ArrowLeft'); pointer('pointerdown', 'right', 5); mask(0); pointer('pointerup', 'right', 5); mask(4); key('keyup', 'ArrowLeft');
      pad = [{ connected: true, mapping: 'standard', axes: [-1, 0], buttons: [] }]; pointer('pointerdown', 'right', 6); mask(0); pad = []; mask(8);
      host.configureJoysticks([{ port: 1, keyboard: true, gamepad: true }]); mask(0);
      pointer('pointerdown', 'fire', 7); p.stop(); mask(0); p.resume(); mask(0);
      pointer('pointerdown', 'fire', 8); canvas.dispatchEvent(new Event('blur')); mask(0); canvas.dispatchEvent(new Event('focus'));
      pointer('pointerdown', 'fire', 9); host.setVirtualJoystickVisibility('off'); mask(0); check(!host.virtualJoystickStatus().visible, 'Touch Off is visible');
      host.setVirtualJoystickVisibility('always'); pointer('pointerdown', 'fire', 10); host.detach(); mask(0);
      check(region.querySelector('.amos-virtual-joystick') === null, 'Detached joystick DOM survived');
    } finally {
      host.detach(); p.stop(); if (gpu) { const gl = gpu.resources.context; gpu.dispose(); const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } region.remove();
    }
    const section = document.createElement('section'); section.id = 'harness-tutorial-controls';
    const help = document.createElement('p'); help.textContent = 'This runnable page is produced by build_game_page.js. Play requests sound/fullscreen and starts the compiled sample. Touch Auto appears on mobile in fullscreen; choose Touch On to try the five-button cross on desktop. It reads AMOS joystick port 1 alongside keyboard and Gamepad input.';
    const iframe = document.createElement('iframe'); iframe.id = 'harness-tutorial'; iframe.title = 'Generated AMOS game page'; iframe.allow = 'fullscreen *; autoplay *'; iframe.allowFullscreen = true; iframe.style.cssText = 'width:100%;height:620px;border:1px solid #888'; iframe.srcdoc = tutorial;
    section.append(help, iframe); document.body.append(section);
    return { assertions, gpuFrames, latin1Glyphs: 96, tutorial: true };
  }, { source: new Transpiler(bytes).toModule(), rows, message, timerSource: require('./fakeTimers').createFakeTimers.toString(), gpuSources: require('./webglHostSources')(), tutorial: require('../../tools/build_game_page').buildGamePage(bytes, { title: 'Umlauts and virtual joystick' }) });
};
