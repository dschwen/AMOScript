/* jshint esversion: 6 */
'use strict';

module.exports = async function keyRepeatProbe(page) {
  const Transpiler = require('../../lib/Transpiler');
  const { binary, token: t, integer: n, identifier: id } = require('./tokens');
  const timing = [t('Key Speed'), n(10), t(','), n(2)];
  const source = new Transpiler(binary([timing, [id('again', 12)], [t('Wait Key')], [t('Goto'), id('again', 0x18)]])).toModule();
  const endSource = new Transpiler(binary([timing, [t('Wait Key')], [t('End')]])).toModule();
  const timerSource = require('./fakeTimers').createFakeTimers.toString();
  return page.evaluate(({ source, endSource, timerSource }) => {
    const module = { exports: {} }; new Function('module', source)(module);
    const clock = new Function(`return (${timerSource})();`)(), received = [];
    const make = factory => factory({ now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
    const program = make(module.exports), canvas = document.createElement('canvas');
    const host = AMOS_BROWSER.createCanvasHost(canvas, { now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
      requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    const send = program.sendKey;
    program.sendKey = key => { received.push([clock.now(), key]); send(key); };
    host.attach(program); program.tick(100);
    const event = (type, key, repeat = false) => canvas.dispatchEvent(new KeyboardEvent(type, { key, code: `Key${key.toUpperCase()}`, repeat, bubbles: true }));
    const equal = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Repeat differs: ${JSON.stringify(a)} / ${JSON.stringify(b)}`); };
    event('keydown', 'a'); event('keydown', 'a', true); clock.tick(199);
    equal(received, [[0, 'a']]); clock.tick(1); clock.tick(40); event('keyup', 'a'); clock.tick(200);
    equal(received, [[0, 'a'], [200, 'a'], [240, 'a']]); equal(clock.pending(), 0);
    const initial = received.slice();
    event('keydown', 'b'); program.stop(); equal(clock.pending(), 0); clock.tick(300);
    equal(received.length, 4); program.resume(); clock.tick(0);
    program.keySpeed(1, 1); event('keydown', 'c'); clock.tick(20);
    equal(received.slice(-2), [[740, 'c'], [760, 'c']]);
    canvas.dispatchEvent(new Event('blur')); clock.tick(100); equal(received.length, 6); equal(clock.pending(), 0);
    event('keydown', 'd'); host.detach(); program.stop(); equal(clock.pending(), 0); clock.tick(100); equal(received.length, 7);
    const ended = { exports: {} }; new Function('module', endSource)(ended);
    const ending = make(ended.exports); host.attach(ending); ending.tick(100);
    event('keydown', 'e'); clock.tick(0); equal(ending.state.halted, true); equal(clock.pending(), 0); host.detach();

    if (globalThis.AMOS_REPEAT_DEMO_CLEANUP) globalThis.AMOS_REPEAT_DEMO_CLEANUP();
    const previous = document.getElementById('repeat-controls'); if (previous) previous.remove();
    const controls = document.createElement('div'); controls.id = 'repeat-controls'; controls.dataset.status = 'running';
    const label = document.createElement('p'); label.textContent = 'Focus the canvas and hold a character key: 200 ms delay, then every 40 ms. Stop, blur and detach cancel repeats.';
    const liveCanvas = document.createElement('canvas'); liveCanvas.id = 'repeat-input'; liveCanvas.tabIndex = 0;
    liveCanvas.style.cssText = 'border:2px solid #8ba;max-width:100%';
    const log = document.createElement('pre'); log.id = 'repeat-log'; log.dataset.count = '0';
    const live = module.exports({ now: () => performance.now(), setTimeout, clearTimeout });
    const liveHost = AMOS_BROWSER.createCanvasHost(liveCanvas); let count = 0;
    const sendLive = live.sendKey;
    live.sendKey = key => { sendLive(key); log.dataset.count = String(++count); log.textContent = `${count} key events; latest: ${JSON.stringify(key)}`; };
    liveHost.attach(live); live.tick(100);
    controls.append(label, liveCanvas, log);
    for (const action of ['stop', 'resume', 'detach']) {
      const button = document.createElement('button'); button.id = `repeat-${action}`; button.textContent = action;
      button.addEventListener('click', () => {
        if (action === 'detach') { liveHost.detach(); live.stop(); }
        else if (action === 'stop') live.stop(); else { liveHost.attach(live); live.resume(); }
        controls.dataset.status = action === 'resume' ? 'running' : action === 'stop' ? 'stopped' : 'detached';
      });
      controls.append(button);
    }
    document.body.append(controls);
    globalThis.AMOS_REPEAT_DEMO_CLEANUP = () => { liveHost.detach(); live.stop(); };
    return { initial, lifecycleChecks: 5, timersRemaining: clock.pending(), ended: ending.state.halted };
  }, { source, endSource, timerSource });
};
