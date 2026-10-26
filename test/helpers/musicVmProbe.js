/* jshint esversion: 6 */
'use strict';
module.exports = async function musicVmProbe(page) {
  const fs = require('fs'), path = require('path'), Transpiler = require('../../lib/Transpiler');
  return page.evaluate(async ({ sources, banks, reference, fakeTimers, audio, session }) => {
    const createTimers = new Function(`return (${fakeTimers});`)(), createHost = new Function(`return (${audio});`)(), createSession = new Function(`return (${session});`)();
    const factories = sources.map(source => { const module = { exports: {} }; new Function('module', source)(module); return module.exports; });
    const files = { read: name => atob(banks[/ywon/i.test(name) ? 1 : 0]) };
    const hash = async rows => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(rows))))).map(v => v.toString(16).padStart(2, '0')).join('');
    const traces = [], fades = [];
    for (let b = 0; b < 2; b++) for (const standard of ['PAL', 'NTSC']) {
      const timers = createTimers(), notes = [], controls = [], hz = standard === 'PAL' ? 50 : 60;
      const p = factories[b]({ files, audioStandard: standard, vblHz: hz, now: timers.now, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
        audio: { command(e) {
          if (e.type === 'play') notes.push([e.field, Math.log2(e.mask), e.sample.number, e.period, e.volume]);
          if (e.type === 'voice') controls.push([e.field, Math.log2(e.mask), e.period || 0, e.volume]);
        } } });
      p.tick(1000); const expected = reference[b].traces[standard], ticks = p.state.ticks;
      timers.tick(expected.fields * 1000 / hz + 0.01);
      if (await hash(notes) !== expected.notesSha256 || await hash(controls) !== expected.controlsSha256 || p.state.ticks !== ticks) throw Error('VM Music trace mismatch');
      traces.push(notes.length);
      p.stop(); const field = p.state.music.position.field; timers.tick(10000); p.resume(); timers.tick(1000 / hz + 0.01);
      if (p.state.music.position.field !== field + 1) throw Error('Music resume replayed elapsed fields');
      p.sendKey('x'); timers.tick(0); timers.tick(192 * 1000 / hz + 0.01);
      if (p.state.music.playing || p.banks.has(3) || p.state.music.volume !== 0 || timers.pending()) throw Error('Original volume fade/Off/Erase failed');
      fades.push(p.state.music.volume); p.stop();
    }
    const container = document.createElement('section');
    container.innerHTML = '<p>Original end-tune load/play and game-over volume fade. Declared Wait Key boundaries replace end-state graphics and menu return.</p><select id="music-vm-song"><option>Over.mus</option><option>Ywon.mus</option></select> <button id="music-vm-play">Play from start</button> <button id="music-vm-stop">Pause</button> <button id="music-vm-resume">Resume</button> <button id="music-vm-restart">Restart silently</button> <button id="music-vm-fade">Run original fade / Off / Erase</button><pre id="music-vm-status"></pre>';
    document.body.appendChild(container);
    const element = id => document.getElementById(`music-vm-${id}`), sound = createSession(createHost);
    let p = null, generation = 0, disposed = false;
    function status() { if (disposed) return; const s = sound.status(); const phase = p.state.stopped ? 'paused' : !p.state.music.playing ? 'finished' : p.state.waiting === 'sleep' ? 'fading' : 'playing'; element('status').textContent = JSON.stringify({ phase, field: p.state.music.position.field, volume: p.state.music.volume, audio: s.state, plays: s.plays }); Object.assign(element('status').dataset, { phase, field: String(p.state.music.position.field), audio: s.state, voices: String(s.voices.length), plays: String(s.plays) }); }
    function pause() { generation++; if (p) p.stop(); sound.mute(); if (p) status(); }
    function fresh(paused) { if (p) p.stop(); p = factories[element('song').selectedIndex]({ files, audio: sound.bind() }); p.tick(1000); if (paused) p.stop(); status(); }
    fresh(true);
    element('play').onclick = async () => { pause(); const token = generation; if (await sound.enable() && token === generation) fresh(false); status(); };
    element('stop').onclick = pause;
    element('resume').onclick = async () => { const token = ++generation; if (await sound.enable() && token === generation) p.resume(); status(); };
    element('restart').onclick = () => { pause(); fresh(true); };
    element('song').onchange = () => { pause(); fresh(true); };
    element('fade').onclick = () => { if (!p.state.stopped && p.state.music.playing) p.sendKey('x'); status(); };
    const timer = setInterval(status, 20), hidden = () => { if (document.hidden) pause(); }; document.addEventListener('visibilitychange', hidden);
    globalThis.AMOS_MUSIC_VM_CLEANUP = async () => { pause(); disposed = true; clearInterval(timer); document.removeEventListener('visibilitychange', hidden); await sound.dispose(); return sound.status(); };
    return { traces, fades };
  }, { sources: [false, true].map(won => new Transpiler(require('./roller2EndMusic')(won)).toModule()),
    banks: ['Over.mus', 'Ywon.mus'].map(name => fs.readFileSync(path.join(__dirname, '../../examples/Roller2/music', name)).toString('base64')),
    reference: require('../fixtures/roller2/music.json').banks, fakeTimers: require('./fakeTimers').createFakeTimers.toString(),
    audio: require('../../lib/amos/webAudio').createWebAudioHost.toString(), session: require('../../lib/amos/browserAudio').createBrowserAudioSession.toString() });
};
