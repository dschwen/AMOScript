'use strict';
module.exports = async function gamePageKeyboardProbe(page) {
  const { binary, token: t, integer: n, text, word: w, identifier: id } = require('./tokens');
  const str = () => id('typed', 6, 2);
  const bytes = binary([[t('Print'), text('Keyboard mode example')], [t('Do'), w(0)],
    [id('mask'), t('='), t('Joy'), t('('), n(1), t(')')],
    [str(), t('='), str(), t('+'), t('Inkey$')],
    [t('Open Out'), n(1), t(','), text('keys.txt')], [t('Print#'), n(1), t(','), str(), t(';')], [t('Close'), n(1)],
    [t('Locate'), n(0), t(','), n(2)], [t('Print'), str(), t(';')],
    [t('Locate'), n(0), t(','), n(4)], [t('Print'), text('Joystick mask: '), t(';'), id('mask'), t(';'), text('  '), t(';')],
    [t('Wait Vbl')], [t('Loop')]]);
  return page.evaluate(async ({ html }) => {
    const check = (v, message) => { if (!v) throw Error(message); };
    const wait = async predicate => { for (let i = 0; i < 150; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 20)); } throw Error('Keyboard mode example timed out'); };
    const section = document.createElement('section'), help = document.createElement('p'), frame = document.createElement('iframe');
    help.textContent = 'Choose Keyboard: Typing to enter z, Z, spaces or Enter. Switch back to Keyboard: Joystick to move with arrows and fire with Z. The screen shows received text and joystick input; Gamepad and touch remain available in either mode.';
    frame.title = 'Joystick and typing modes'; frame.allow = 'fullscreen *; autoplay *'; frame.allowFullscreen = true; frame.style.cssText = 'width:100%;height:640px;border:1px solid #888';
    const loaded = new Promise(resolve => { frame.onload = resolve; }); frame.srcdoc = html; section.append(help, frame); document.body.append(section); await loaded;
    const win = frame.contentWindow, doc = frame.contentDocument; let pads = [];
    Object.defineProperty(win.navigator, 'getGamepads', { configurable: true, value: () => pads });
    const app = () => win.AMOS_GAME_PAGE, mask = () => app().joystickStatus()[0].mask;
    const keyboard = doc.getElementById('game-keyboard');
    const mode = value => { keyboard.value = value; keyboard.dispatchEvent(new win.Event('change')); };
    const key = (type, code, value, shiftKey = false) => doc.getElementById('game-input').dispatchEvent(new win.KeyboardEvent(type, { code, key: value, shiftKey, bubbles: true, cancelable: true }));
    const press = (code, value, shift = false) => { key('keydown', code, value, shift); key('keyup', code, value, shift); };
    doc.getElementById('game-restart').click();
    await wait(() => app().files.exists('keys.txt'));
    check(keyboard.value === 'game', 'Default mode is not joystick');
    key('keydown', 'KeyZ', 'z'); check(mask() === 16, 'Z did not fire');
    mode('typing'); check(mask() === 0, 'Switching mode retained held fire'); key('keyup', 'KeyZ', 'z');
    press('KeyZ', 'z'); await wait(() => app().files.read('keys.txt') === 'z');
    press('KeyZ', 'Z', true); await wait(() => app().files.read('keys.txt') === 'zZ');
    press('Space', ' '); await wait(() => app().files.read('keys.txt') === 'zZ ');
    press('Enter', 'Enter'); await wait(() => app().files.read('keys.txt') === 'zZ \r');
    check(mask() === 0, 'Typing generated joystick input');
    pads = [{ connected: true, mapping: 'standard', axes: [0, 0], buttons: [{ pressed: true, value: 1 }] }];
    check(mask() === 16, 'Typing mode disabled Gamepad fire'); pads = []; check(mask() === 0, 'Gamepad release stuck');
    doc.getElementById('game-stop').click(); doc.getElementById('game-resume').click();
    check(keyboard.value === 'typing' && doc.getElementById('game-viewport').dataset.keyboard === 'typing', 'Stop/Resume lost typing mode');
    doc.getElementById('game-restart').click(); await wait(() => app().files.read('keys.txt') === '');
    check(keyboard.value === 'typing', 'Restart lost typing mode'); press('KeyZ', 'z'); await wait(() => app().files.read('keys.txt') === 'z');
    mode('game'); key('keydown', 'KeyZ', 'z'); check(mask() === 16, 'Restored joystick mapping did not fire'); key('keyup', 'KeyZ', 'z'); check(mask() === 0, 'Fire release stuck');
    await new Promise(resolve => setTimeout(resolve, 60)); check(app().files.read('keys.txt') === 'z', 'Joystick fire leaked into text');
    press('Enter', 'Enter'); await wait(() => app().files.read('keys.txt') === 'z\r'); // Enter is not mapped to fire.
    await app().dispose();
    const fresh = new Promise(resolve => { frame.onload = resolve; }); frame.srcdoc = html; await fresh;
    return { typed: 'zZ \r', fireKey: 'Z', gamepadInTypingMode: true, heldFireCleared: true, restartPreservesMode: true };
  }, { html: require('../../tools/build_game_page').buildGamePage(bytes, { title: 'Keyboard joystick and text entry', fire: ['KeyZ'] }) });
};
