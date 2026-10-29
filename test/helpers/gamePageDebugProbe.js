/* jshint esversion: 6 */
'use strict';
module.exports = async function gamePageDebugProbe(page) {
  const { binary, token: t, integer: n, text } = require('./tokens');
  const start = () => [t('Start'), t('('), n(4), t(')')];
  const bytes = binary([[t('Reserve As Work'), n(4), t(','), n(4)],
    [t('Bload'), text('raw.bin'), t(','), n(4)],
    [t('Bsave'), text('save.dat'), t(','), start(), t('To'), start(), t('+'), n(4)],
    [t('Bsave'), text('new.dat'), t(','), start(), t('To'), start(), t('+'), n(2)],
    [t('Wait Key')], [t('Return')]]);
  const build = require('../../tools/build_game_page').buildGamePage;
  const assets = { 'raw.bin': Buffer.from([0, 128, 255, 10]).toString('base64'), 'save.dat': Buffer.from('old').toString('base64') };
  return page.evaluate(async ({ normal, debug }) => {
    const check = (condition, message) => { if (!condition) throw Error(message); };
    const wait = async predicate => { for (let i = 0; i < 150; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 20)); } throw Error('Game page did not reach expected phase'); };
    const area = document.createElement('section'); area.id = 'game-page-debug-examples';
    // Moving an already mounted iframe ancestor reloads its browsing context.
    document.body.append(area);
    const frames = [];
    for (const [name, source] of [['normal', normal], ['debug', debug]]) {
      const heading = document.createElement('h2'); heading.textContent = `${name === 'debug' ? 'Debug' : 'Normal'} application page`;
      const frame = document.createElement('iframe'); frame.id = `game-page-${name}`; frame.title = heading.textContent; frame.style.cssText = 'width:100%;height:580px;border:1px solid #888'; frame.allow = 'fullscreen *; autoplay *'; frame.allowFullscreen = true;
      const loaded = new Promise(resolve => { frame.onload = resolve; }); frame.srcdoc = source;
      area.append(heading, frame); await loaded;
      frames.push(frame);
    }
    const plain = frames[0].contentDocument, doc = frames[1].contentDocument, win = frames[1].contentWindow;
    check(!plain.querySelector('.game-debug') && !plain.querySelector('[data-debug-log]'), 'Normal page contains debug UI');
    for (const action of ['stop', 'resume', 'restart']) {
      const button = plain.getElementById(`game-${action}`);
      check(button.querySelector('svg') && button.getAttribute('aria-label') && button.title, 'Icon control lacks accessible name');
    }
    const menu = doc.querySelector('.game-debug'); check(menu && !menu.open, 'Debug menu should start closed');
    check(!menu.querySelector('a'), 'Unchanged assets offered for download');
    doc.getElementById('game-restart').click();
    check(doc.getElementById('game-viewport').dataset.phase === 'running', 'Save fixture failed');
    menu.open = true; await new Promise(resolve => setTimeout(resolve, 0)); doc.querySelector('[data-debug-refresh]').click();
    const links = [...menu.querySelectorAll('a')]; check(links.length === 2, 'Expected only new and modified files');
    const payloads = {};
    for (const link of links) payloads[link.download] = [...new Uint8Array(await (await win.fetch(link.href)).arrayBuffer())];
    check(JSON.stringify(payloads['save.dat']) === '[0,128,255,10]' && JSON.stringify(payloads['new.dat']) === '[0,128]', 'Binary export changed bytes');
    const oldUrl = links[0].href; doc.querySelector('[data-debug-refresh]').click();
    let revoked = false; try { await win.fetch(oldUrl); } catch (_) { revoked = true; } check(revoked, 'Refresh retained old object URL');
    // Returning a file to its original contents removes it from the changed list.
    win.AMOS_GAME_PAGE.files.write('save.dat', 'old'); doc.querySelector('[data-debug-refresh]').click();
    check(menu.querySelectorAll('a').length === 1 && menu.querySelector('a').download === 'new.dat', 'Reverted file remains modified');
    doc.getElementById('game-restart').click(); doc.querySelector('[data-debug-refresh]').click();
    check(menu.querySelectorAll('a').length === 2, 'Restart lost session files');
    for (const frame of frames) {
      const d = frame.contentDocument;
      if (frame === frames[0]) d.getElementById('game-restart').click();
      const canvas = d.getElementById('game-input');
      canvas.focus(); canvas.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown', { code: 'KeyA', key: 'a', bubbles: true }));
      await wait(() => d.getElementById('game-viewport').dataset.phase === 'error');
      check(d.getElementById('game-status').textContent === 'Game stopped after an error. Restart to try again.', 'Compact error notice is missing');
    }
    check(/Return.*line 6|line 6.*Return/.test(doc.querySelector('[data-debug-log]').textContent), 'Detailed source error is missing');
    const lastUrl = menu.querySelector('a').href;
    await win.AMOS_GAME_PAGE.dispose();
    revoked = false; try { await win.fetch(lastUrl); } catch (_) { revoked = true; } check(revoked, 'Disposal retained download URL');
    check(!doc.querySelector('.game-debug'), 'Disposal retained debug menu');
    await frames[0].contentWindow.AMOS_GAME_PAGE.dispose();
    // Leave fresh runnable examples on the shared demo page after verification.
    for (const [i, source] of [normal, debug].entries()) { const loaded = new Promise(resolve => { frames[i].onload = resolve; }); frames[i].srcdoc = source; await loaded; }
    return { modifiedFiles: 2, binaryBytes: [0, 128, 255, 10], compactErrors: 2, revokedUrls: 2, icons: 3 };
  }, { normal: build(bytes, { title: 'File export example', assets }), debug: build(bytes, { title: 'File export example — debug', assets, debug: true }) });
};
