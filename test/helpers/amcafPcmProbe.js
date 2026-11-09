'use strict';
module.exports = async function amcafPcmProbe(page) {
  return page.evaluate(async ({ pitchSource, sequenceSource, pcmSource, moduleSource }) => {
    const make = source => new Function(`return (${source})`)();
    const createPitch = make(pitchSource), createSequence = make(sequenceSource), createPcm = make(pcmSource), preview = make(moduleSource);
    const check = (value, message) => { if (!value) throw new Error(message); };
    const bank = [
      { number: 1, length: 8, pcm: Int8Array.from([8,16,24,32,40,48,56,64]) },
      { number: 2, length: 6, pcm: Int8Array.from([80,88,96,104,112,120]) }
    ];
    const frame = (tick, period = 428, triggers = [], repeats = []) => ({ tick, triggers, repeats,
      state: { voices: Array.from({ length: 4 }, () => ({ outputPeriod: period, outputVolume: 64 })) } });
    let maxDifference = 0;
    for (const standard of ['PAL','NTSC']) for (let voice = 0; voice < 4; voice++) {
      const sampler = createPcm(bank, { sampleRate: 8000, standard }), side = voice === 0 || voice === 3 ? 0 : 1;
      sampler.apply(frame(1, 428, [{ voice, sample: 1, length: 8 }], [{ voice, sample: 1, start: 2, length: 4 }]));
      const a = sampler.render(128);
      sampler.apply(frame(2, 856, [], [{ voice, sample: 2, start: 1, length: 3 }]));
      const b = sampler.render(384), actual = [new Float32Array(512), new Float32Array(512)];
      actual[0].set(a.left); actual[0].set(b.left,128); actual[1].set(a.right); actual[1].set(b.right,128);
      // Independent absolute-phase formula: finish A's currently latched loop
      // before switching to B. Pitch changes alter future slope, not past phase.
      const step = (standard === 'PAL' ? 3546895 : 3579545) / 428 / 8000;
      const phaseAtChange = 128 * step, boundary = 8 + Math.ceil((phaseAtChange - 8) / 4) * 4;
      const literal = new Float32Array(512);
      for (let i = 0; i < 512; i++) {
        const phase = i < 128 ? i * step : phaseAtChange + (i - 128) * step / 2;
        literal[i] = (phase < 8 ? bank[0].pcm[Math.floor(phase)] : phase < boundary ? bank[0].pcm[2 + Math.floor((phase - 8) % 4)]
          : bank[1].pcm[1 + Math.floor((phase - boundary) % 3)]) / 256;
      }
      for (let i = 0; i < 512; i++) {
        check(actual[1 - side][i] === 0, 'Opposite stereo channel leaked');
        maxDifference = Math.max(maxDifference, Math.abs(actual[side][i] - literal[i]));
      }
      // Deliver rendered PCM through a real native stereo graph. Expected PCM
      // is independently calculated above, not copied from the sampler.
      const context = new OfflineAudioContext(2,512,8000), source = context.createBufferSource();
      const buffer = context.createBuffer(2,512,8000);
      buffer.copyToChannel(actual[0],0); buffer.copyToChannel(actual[1],1); source.buffer = buffer;
      source.connect(context.destination); source.start(); const rendered = await context.startRendering();
      for (let channel = 0; channel < 2; channel++) for (let i = 0; i < 512; i++) {
        maxDifference = Math.max(maxDifference, Math.abs(rendered.getChannelData(channel)[i] - (channel === side ? literal[i] : 0)));
      }
      sampler.stop();
    }
    check(maxDifference < 1e-6, `Repeat/pitch PCM comparison failed: ${maxDifference}`);
    const data = preview(), sequence = createSequence(data, createPitch);
    const sampler = createPcm(data.samples, { sampleRate: 8000 });
    // Explicit 50-Hz VBL preview clock, not a CIA-timing/VM integration claim.
    const left = new Float32Array(385 * 160), right = new Float32Array(left.length);
    let repeatOnly = 0, notes = 0;
    for (let tick = 1; tick <= 384; tick++) {
      const f = sequence.tick(); sampler.apply(f); notes += f.triggers.length;
      if (tick === 54) repeatOnly = f.repeats.filter(r => r.voice === 0 && r.sample === 2 && !f.triggers.some(t => t.voice === 0)).length;
      const pcm = sampler.render(160); left.set(pcm.left,tick * 160); right.set(pcm.right,tick * 160);
    }
    check(notes > 2 && repeatOnly === 1 && left.some(v => v !== 0) && right.some(v => v !== 0), 'Synthetic music did not reach its notes/repeat change');
    sampler.stop(); sequence.stop();
    if (globalThis.AMOS_AMCAF_PCM_CLEANUP) await globalThis.AMOS_AMCAF_PCM_CLEANUP();
    document.getElementById('amcaf-pcm-controls')?.remove();
    const controls = document.createElement('section'); controls.id = 'amcaf-pcm-controls';
    const status = document.createElement('p'); status.id = 'amcaf-pcm-status'; status.dataset.state = 'off'; status.dataset.contexts = '0';
    status.textContent = 'Play a synthetic AMCAF music preview (50-Hz clock; no game assets).';
    const play = document.createElement('button'); play.id = 'amcaf-pcm-play'; play.textContent = 'Play music preview';
    const stop = document.createElement('button'); stop.id = 'amcaf-pcm-stop'; stop.textContent = 'Stop';
    controls.append(play,stop,status); document.body.append(controls);
    let live = null, generation = 0, disposed = false, contexts = 0;
    const pending = new Set();
    function stopLive() {
      generation++; const old = live; live = null;
      if (old) {
        if (old.source) { old.source.onended = null; try { old.source.stop(); } catch (_) { /* failed start */ } finally { old.source.disconnect(); } }
        const closed = old.context.close().catch(() => {}).finally(() => {
          contexts--; status.dataset.contexts = String(contexts); pending.delete(closed);
        });
        pending.add(closed);
      }
      status.dataset.state = 'off'; status.textContent = 'Stopped';
    }
    play.addEventListener('click', async () => {
      if (disposed) return;
      stopLive(); const token = generation;
      try {
        const context = new AudioContext(); live = { context, source: null };
        contexts++; status.dataset.contexts = String(contexts);
        const instance = live, resumed = context.resume();
        await resumed;
        if (disposed || token !== generation || instance !== live) return;
        const source = context.createBufferSource(), buffer = context.createBuffer(2,left.length,8000);
        buffer.copyToChannel(left,0); buffer.copyToChannel(right,1);
        source.buffer = buffer; source.loop = true; source.connect(context.destination); instance.source = source; source.start();
        status.dataset.state = 'playing'; status.textContent = 'Playing synthetic music preview';
      } catch (error) {
        if (disposed || token !== generation) return;
        stopLive(); status.dataset.state = 'error'; status.textContent = `Audio failed: ${error.message}`;
      }
    });
    stop.addEventListener('click', () => { if (!disposed) stopLive(); });
    const onHide = () => { void cleanup(); };
    async function cleanup() {
      disposed = true; stopLive(); window.removeEventListener('pagehide',onHide);
      await Promise.all([...pending]);
    }
    window.addEventListener('pagehide',onHide);
    globalThis.AMOS_AMCAF_PCM_CLEANUP = cleanup;
    return { comparisons: 8, maxDifference, previewTicks: 384, instrumentOnlyChange: repeatOnly, notes,
      evidence: 'Synthetic source-derived PCM and native Web Audio delivery; no Amiga capture or VM/CIA timing.' };
  }, { pitchSource: require('../../lib/amos/amcafPitch').toString(), sequenceSource: require('../../lib/amos/amcafSequencer').toString(),
    pcmSource: require('../../lib/amos/amcafPcm').toString(), moduleSource: require('./amcafPreviewModule').toString() });
};
