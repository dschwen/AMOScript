/* jshint esversion: 6 */
'use strict';
module.exports = async function roller2HighscoreProbe(page) {
  const Transpiler = require('../../lib/Transpiler'), assets = require('./roller2CurrentAssets')();
  // Declared external-file fixture: a real score of 299 qualifies naturally.
  assets['rii:Highscores'] = 'player\r\n 0\r\n'.repeat(10);
  return page.evaluate(({ source, assets, clockSource, filesSource, replaySource }) => {
    const make = text => new Function(`return (${text});`)(), module = { exports: {} }; new Function('module', source)(module);
    const files = make(filesSource)(Object.fromEntries(Object.entries(assets).map(([name, data]) => [name, atob(data)]))), clock = make(clockSource)(4);
    const canvas = document.createElement('canvas'); canvas.tabIndex = 0; document.body.append(canvas);
    const mapping = [{ port: 1, keyboard: { fire: ['ControlLeft', 'ControlRight'] } }];
    let host, held = null, assertions = 0, entered = false;
    const check = (value, message) => { if (!value) throw Error(message); assertions++; };
    const key = (type, code, modifiers = {}) => {
      const event = new KeyboardEvent(type, { code, key: /^Key[A-Z]$/.test(code) ? code.slice(3).toLowerCase() : code,
        ctrlKey: type === 'keydown' && /^Control/.test(code), bubbles: true, cancelable: true, ...modifiers });
      canvas.dispatchEvent(event); return event.defaultPrevented;
    };
    function capture(name, p) {
      host.render(); const frame = p.display.canvasFrame();
      if (globalThis.AMOS_DEMO_OBSERVE && frame) globalThis.AMOS_DEMO_OBSERVE({ name, width: frame.width, height: frame.height, rgba: frame.rgba });
    }
    try {
      const result = make(replaySource)(module.exports, clock, files, p => {
        host = AMOS_BROWSER.createCanvasHost(canvas, { hasFocus: () => true, joysticks: mapping, requestAnimationFrame: () => 1, cancelAnimationFrame() {} }); host.attach(p); host.focus();
        p.keySpeed(1, 1); key('keydown', 'KeyA'); check(p.inputValue('Inkey$') === 'a', 'Initial text key is missing');
        key('keydown', 'ControlLeft'); clock.tick(80); check(p.inputValue('Inkey$') === '', 'Ctrl fire retained text repeat');
        key('keyup', 'KeyA'); key('keyup', 'ControlLeft'); p.keySpeed(20, 4);
        for (const control of ['ControlLeft', 'ControlRight']) {
          check(key('keydown', control), 'Ctrl fire was not consumed'); check(p.joystickInfo('Joy', 1) === 16, 'Ctrl did not fire');
          key('keydown', 'ArrowRight', { ctrlKey: true }); check(p.joystickInfo('Joy', 1) === 24, 'Ctrl+arrow did not combine');
          key('keyup', 'ArrowRight', { ctrlKey: true }); key('keyup', control);
          check(p.joystickInfo('Joy', 1) === 0 && p.inputValue('Inkey$') === '', 'Ctrl chord leaked input');
        }
        key('keydown', 'ControlLeft'); check(!key('keydown', 'KeyC', { ctrlKey: true }), 'Unmapped Ctrl shortcut was consumed');
        check(p.joystickInfo('Joy', 1) === 0 && p.inputValue('Inkey$') === '', 'Ctrl shortcut leaked input'); key('keyup', 'ControlLeft');
        key('keydown', 'ControlLeft', { metaKey: true }); check(p.joystickInfo('Joy', 1) === 0, 'Meta chord reached joystick');
        host.configureJoysticks([{ port: 1, keyboard: true }]); key('keydown', 'ControlLeft'); check(p.joystickInfo('Joy', 1) === 0, 'Default profile captured Ctrl');
        host.configureJoysticks([{ port: 1, keyboard: { fire: ['ControlLeft'], consume: false } }]);
        check(!key('keydown', 'ControlLeft'), 'Non-consuming Ctrl mapping prevented default');
        check(!key('keydown', 'ArrowRight', { ctrlKey: true }) && p.inputValue('Inkey$') === '', 'Non-consuming Ctrl chord generated text');
        key('keyup', 'ArrowRight', { ctrlKey: true }); key('keyup', 'ControlLeft');
        host.configureJoysticks(mapping);
        return { joy(mask) {
          if (held) key('keyup', held); held = mask === 16 ? 'ControlLeft' : mask === 8 ? 'ArrowRight' : mask === 4 ? 'ArrowLeft' : mask === 1 ? 'ArrowUp' : mask === 2 ? 'ArrowDown' : null;
          if (held) key('keydown', held);
        }, key(code) { key('keydown', code); key('keyup', code); }, dispose() { if (held) key('keyup', held); host.detach(); } };
      }, (name, p) => capture(name, p), (p, input, clock) => {
        check(p.state.location.line >= 1055 && p.state.location.line <= 1062, 'Original name entry did not open');
        capture('Original high-score name entry', p);
        for (const code of ['KeyC', 'KeyO', 'KeyD', 'KeyE', 'KeyX']) input.key(code);
        clock.tick(100); check(p.state.variables.string_nampl === 'codex', 'Name text did not reach AMOS');
        capture('Typed high-score name', p); input.key('Enter'); clock.tick(400);
        check(files.read('RII:Highscores') === 'codex\r\n299\r\n' + 'player\r\n0\r\n'.repeat(9), 'Enter did not confirm and save the original score table'); entered = true;
      });
      check(entered && result.writes === 1 && result.returnedToMenu && result.freshGame, 'Score entry did not finish the real menu/fresh-game path');
      return { assertions, name: 'codex', score: result.score, writes: result.writes, entered, returnedToMenu: result.returnedToMenu, freshGame: result.freshGame };
    } finally { if (host) host.detach(); canvas.remove(); }
  }, { source: new Transpiler(Buffer.from(assets['rii:Roller II.AMOS'], 'latin1')).toModule(), assets: Object.fromEntries(Object.entries(assets).map(([name, data]) => [name, Buffer.from(data, 'latin1').toString('base64')])),
    clockSource: require('./fakeTimers').createFakeTimers.toString(), filesSource: require('./roller2GameFiles').toString(), replaySource: require('./roller2CurrentReplay').toString() });
};
