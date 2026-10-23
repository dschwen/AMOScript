/* jshint esversion: 6 */
'use strict';

module.exports = async function musicProbe(page) {
  const fs = require('fs'), path = require('path'), Transpiler = require('../../lib/Transpiler');
  const { binary, token: t, integer: n, word: w, text } = require('./tokens');
  const ext = offset => [w(0x4e), 1, 0, w(offset)];
  const bytes = fs.readFileSync(path.join(__dirname, '../../examples/Wonderland/Wonderland_Samples.Abk'));
  // Independent file addressing, separate from BankReader and createAudio:
  // 20-byte AmBk wrapper, word count, relative long offsets, 14-byte records.
  const samples = Array.from({ length: bytes.readUInt16BE(20) }, (_, index) => {
    const record = 20 + bytes.readUInt32BE(22 + index * 4), length = bytes.readUInt32BE(record + 10);
    return { number: index + 1, length, frequency: bytes.readUInt16BE(record + 8),
      pcm: Array.from({ length }, (_, i) => bytes.readInt8(record + 14 + i) / 128) };
  });
  const programSource = new Transpiler(binary([[t('Load'), text('samples')], [ext(0x1d6)],
    [ext(0x8a), n(5)], [ext(0xb4)], [t('Wait Key')]])).toModule();
  const hostSource = require('../../lib/amos/webAudio').createWebAudioHost.toString();
  return page.evaluate(async ({ programSource, hostSource, bank, samples }) => {
    const module = { exports: {} }; new Function('module', programSource)(module);
    const createHost = new Function(`return (${hostSource});`)();
    function make(context) {
      const host = createHost(context);
      const program = module.exports({ audio: host, files: { read: () => atob(bank) },
        now: () => 0, setTimeout: () => 1, clearTimeout() {} });
      program.tick(100);
      return { host, program };
    }
    async function compare(sample, mask, looping, disableLoop = false) {
      const context = new OfflineAudioContext(2, 20000, 8000), expected = new OfflineAudioContext(2, 20000, 8000);
      const { host, program } = make(context), channel = [0, 1, 1, 0][Math.log2(mask)];
      if (looping) program.samLoopOn(mask);
      program.samPlayVoices(mask, sample.number);
      if (disableLoop) program.samLoopOff(mask);
      // Native Web Audio control graph, with independently decoded source PCM,
      // independently calculated Paula period and explicit stereo routing.
      const buffer = expected.createBuffer(1, sample.length, 8000); buffer.getChannelData(0).set(sample.pcm);
      const source = expected.createBufferSource(), gain = expected.createGain(), merger = expected.createChannelMerger(2);
      source.buffer = buffer; source.playbackRate.value = (3546895 / Math.max(124, Math.floor(3546895 / sample.frequency))) / 8000;
      source.loop = looping && !disableLoop; gain.gain.value = 56 / 64;
      source.connect(gain); gain.connect(merger, 0, channel); merger.connect(expected.destination); source.start();
      const [actual, golden] = await Promise.all([context.startRendering(), expected.startRendering()]);
      let maxDifference = 0, energy = 0, otherEnergy = 0;
      for (let c = 0; c < 2; c++) {
        const a = actual.getChannelData(c), b = golden.getChannelData(c);
        for (let i = 0; i < a.length; i++) {
          maxDifference = Math.max(maxDifference, Math.abs(a[i] - b[i]));
          if (c === channel) energy += a[i] * a[i]; else otherEnergy += a[i] * a[i];
        }
      }
      if (maxDifference > 1e-6 || energy <= 0 || otherEnergy !== 0) throw new Error(`PCM/stereo comparison failed for sample ${sample.number}`);
      program.stop(); host.dispose();
      if (!looping) {
        const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 128;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#101c30'; ctx.fillRect(0, 0, 640, 128);
        ctx.strokeStyle = '#8ef0bd'; ctx.beginPath();
        for (let x = 0; x < 640; x++) {
          const y = 64 - sample.pcm[Math.floor(x * sample.length / 640)] * 60;
          if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        if (globalThis.AMOS_DEMO_OBSERVE) globalThis.AMOS_DEMO_OBSERVE({ name: `Sample ${sample.number} (${sample.length} bytes)`, width: 640, height: 128,
          rgba: ctx.getImageData(0, 0, 640, 128).data });
      }
      return { number: sample.number, channel, maxDifference, nonzero: true };
    }
    const comparisons = [];
    for (const sample of samples) comparisons.push(await compare(sample, 1 << ((sample.number - 1) % 4), false));
    await compare(samples[2], 4, true); await compare(samples[2], 4, true, true);
    const context = new OfflineAudioContext(2, 512, 8000), { host, program } = make(context);
    const active = expected => { if (JSON.stringify(host.activeVoices()) !== JSON.stringify(expected)) throw new Error('Voice lifecycle differs'); };
    program.samPlayVoices(3, 1); active([0, 1]);
    program.samPlayVoices(2, 3); active([0, 1]);
    program.samStop(1); active([1]); program.stop(); active([]);
    host.dispose(); host.dispose();
    const stopped = await context.startRendering();
    if (!stopped.getChannelData(0).every(value => value === 0) || !stopped.getChannelData(1).every(value => value === 0)) throw new Error('Stopped audio leaked');

    // Audible output is an explicit user action. No live AudioContext is created
    // while the automated offline assertions run.
    if (globalThis.AMOS_SAMPLE_DEMO_CLEANUP) globalThis.AMOS_SAMPLE_DEMO_CLEANUP();
    const old = document.getElementById('sample-controls'); if (old) old.remove();
    const controls = document.createElement('div'); controls.id = 'sample-controls';
    const status = document.createElement('p'); status.id = 'sample-status'; status.textContent = 'Audition original samples (sound starts only after clicking).';
    controls.append(status); let live = null, disposed = false;
    for (const sample of samples) {
      const button = document.createElement('button'); button.id = `audio-sample-${sample.number}`; button.textContent = `Play sample ${sample.number}`;
      button.addEventListener('click', async () => {
        try {
          if (!live) { const context = new AudioContext(); live = { context, ...make(context) }; }
          await live.context.resume(); if (disposed) return;
          live.program.samPlayVoices(1, sample.number);
          status.textContent = `Playing sample ${sample.number}`; status.dataset.playing = String(sample.number);
        } catch (error) { status.textContent = `Audio failed: ${error.message}`; status.dataset.playing = 'error'; }
      });
      controls.append(button);
    }
    const stop = document.createElement('button'); stop.id = 'audio-stop'; stop.textContent = 'Stop sound';
    stop.addEventListener('click', () => { if (live) live.program.samStop(); status.textContent = 'Stopped'; status.dataset.playing = ''; });
    controls.append(stop); document.body.append(controls);
    globalThis.AMOS_SAMPLE_DEMO_CLEANUP = () => {
      disposed = true;
      if (live) { live.program.stop(); live.host.dispose(); live.context.close().catch(() => {}); }
    };
    return { samples: comparisons, loopChecks: 2, lifecycleChecks: 5, gameRunning: false,
      evidence: 'Original PCM assets / independent native Web Audio control graphs; no Amiga execution capture.' };
  }, { programSource, hostSource, samples, bank: bytes.toString('base64') });
};
