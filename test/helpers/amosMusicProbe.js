/* jshint esversion: 6 */
'use strict';

module.exports = async function amosMusicProbe(page) {
  const fs = require('fs'), path = require('path');
  return page.evaluate(async ({ banks, reference, reader, player, audio, session }) => {
    const read = new Function(`return (${reader});`)(), create = new Function(`return (${player});`)();
    const createHost = new Function(`return (${audio});`)(), createSession = new Function(`return (${session});`)();
    const raw = banks.map(bank => Uint8Array.from(atob(bank), c => c.charCodeAt(0)).subarray(20)), modules = raw.map(read);
    const digest = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map(v => v.toString(16).padStart(2, '0')).join('');
    const traces = [];
    for (let b = 0; b < 2; b++) for (const standard of ['PAL', 'NTSC']) {
      const notes = [], controls = [], p = create(modules[b], { standard, host: { command(e) {
        if (e.type === 'play') notes.push([e.field, Math.log2(e.mask), e.sample.number, e.period, e.volume]);
        if (e.type === 'voice') controls.push([e.field, Math.log2(e.mask), e.period || 0, e.volume]);
      } } });
      const expected = reference[b].traces[standard]; p.advance(expected.fields); p.stop();
      if (await digest(notes) !== expected.notesSha256 || await digest(controls) !== expected.controlsSha256) throw Error('Music field trace mismatch');
      traces.push(notes.length);
    }
    const graphs = [];
    for (let b = 0; b < 2; b++) {
      const bytes = raw[b], view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), base = view.getUint32(0), count = view.getUint16(base);
      const p = create(modules[b]);
      for (let i = 0; i < count; i++) {
        // Independent raw descriptor/PCM reads, without the production decoder.
        const at = base + 2 + i * 32, start = base + view.getUint32(at), repeat = base + view.getUint32(at + 4);
        const initial = view.getUint16(at + 8) * 2, length = view.getUint16(at + 10) * 2, stored = view.getUint16(at + 14) * 2;
        const period = 269, rate = 3546895 / period, frames = Math.ceil((initial + length * 2 + 256) / rate * 8000);
        const context = new OfflineAudioContext(2, frames, 8000), expected = new OfflineAudioContext(2, frames, 8000), host = createHost(context);
        const volume = Math.min(63, view.getUint16(at + 12)) * 56 >> 6, channel = [0, 1, 1, 0][i % 4];
        host.command({ type: 'play', mask: 1 << (i % 4), sample: p.samples[i], rate, volume, loopMask: 1 << (i % 4), loopStart: initial, loopEnd: initial + length, filterEnabled: false });
        const external = repeat < start, audibleLength = external ? initial + length : repeat - start + length;
        if (!external && audibleLength > stored) throw Error('Repeat exceeds stored PCM');
        const buffer = expected.createBuffer(1, audibleLength, 8000), data = buffer.getChannelData(0);
        for (let j = 0; j < (external ? initial : audibleLength); j++) data[j] = (bytes[start + j] < 128 ? bytes[start + j] : bytes[start + j] - 256) / 128;
        if (external && bytes.subarray(repeat, repeat + length).some(v => v !== 0)) throw Error('Unexpected external non-silent repeat');
        const source = expected.createBufferSource(), gain = expected.createGain(), merger = expected.createChannelMerger(2);
        source.buffer = buffer; source.playbackRate.value = rate / 8000; source.loop = true;
        source.loopStart = (external ? initial : repeat - start) / 8000; source.loopEnd = (external ? initial + length : repeat - start + length) / 8000;
        gain.gain.value = volume / 64; source.connect(gain); gain.connect(merger, 0, channel); merger.connect(expected.destination); source.start();
        const [actual, golden] = await Promise.all([context.startRendering(), expected.startRendering()]);
        let difference = 0, energy = 0;
        for (let c = 0; c < 2; c++) for (let j = 0; j < frames; j++) { const a = actual.getChannelData(c)[j]; difference = Math.max(difference, Math.abs(a - golden.getChannelData(c)[j])); energy += a * a; }
        if (difference > 1e-6 || !energy) throw Error(`Music PCM mismatch ${b}:${i}: ${difference}`);
        graphs.push(difference); host.dispose();
      }
      p.stop();
    }
    const container = document.createElement('section'); container.innerHTML = '<p>Direct AMOS Music player: original end tunes. VM Music commands remain pending.</p><select id="amos-music-song"><option>Over.mus</option><option>Ywon.mus</option></select> <button id="amos-music-play">Play</button> <button id="amos-music-stop">Stop</button> <button id="amos-music-restart">Restart</button> <button id="amos-music-step">Step 6 fields</button> <label>Volume <input id="amos-music-volume" type="range" min="0" max="63" value="56"></label><pre id="amos-music-status"></pre>';
    document.body.appendChild(container);
    const element = id => document.getElementById(`amos-music-${id}`), sound = createSession(createHost);
    let current = null, interval = null, generation = 0;
    function status() { const s = sound.status(); element('status').textContent = JSON.stringify({ song: element('song').value, field: current.state.field, volume: current.state.volume, audio: s.state, plays: s.plays }); Object.assign(element('status').dataset, { field: String(current.state.field), state: s.state, plays: String(s.plays), voices: String(s.voices.length) }); }
    function stop() { generation++; clearInterval(interval); interval = null; if (current) current.stop(); sound.mute(); if (current) status(); }
    function fresh() { if (current) current.stop(); current = create(modules[element('song').selectedIndex], { volume: Number(element('volume').value), host: sound.bind() }); status(); }
    fresh();
    element('play').onclick = async () => { stop(); const token = generation; const enabled = await sound.enable(); if (!enabled || token !== generation) return; fresh(); const epoch = performance.now(); interval = setInterval(() => { try { const field = Math.floor((performance.now() - epoch) / 20); if (field - current.state.field > 250) throw Error('Playback delayed: restart required'); current.advance(field); status(); } catch (error) { stop(); element('status').textContent = error.message; } }, 4); };
    element('stop').onclick = stop; element('restart').onclick = () => { stop(); fresh(); };
    element('song').onchange = () => { stop(); fresh(); };
    element('step').onclick = () => { if (interval || !current.state.playing) { stop(); fresh(); } current.advance(current.state.field + 6); status(); };
    element('volume').oninput = () => { current.setVolume(Number(element('volume').value)); status(); };
    const hidden = () => { if (document.hidden) stop(); }; document.addEventListener('visibilitychange', hidden);
    globalThis.AMOS_MUSIC_DEMO_CLEANUP = async () => { stop(); document.removeEventListener('visibilitychange', hidden); await sound.dispose(); return sound.status(); };
    return { traces, graphs: graphs.length, maxDifference: Math.max(...graphs) };
  }, { banks: ['Over.mus', 'Ywon.mus'].map(name => fs.readFileSync(path.join(__dirname, '../../examples/Roller2/music', name)).toString('base64')),
    reference: require('../fixtures/roller2/music.json').banks, reader: require('../../lib/amos/musicBank').toString(), player: require('../../lib/amos/music').toString(),
    audio: require('../../lib/amos/webAudio').createWebAudioHost.toString(), session: require('../../lib/amos/browserAudio').createBrowserAudioSession.toString() });
};
