/* jshint esversion: 6 */
'use strict';

// Portable sample-and-hold rendering of AMCAF sequencer DMA intents. No host
// clocks or callbacks: apply a tick at its boundary, then render elapsed PCM.
// This models region reloads, not cycle-exact Paula word prefetch or analog DACs.
function createAmcafPcm(samples, options = {}) {
  const integer = (value, min, max, name) => {
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`AMCAF PCM: invalid ${name}`);
    return value;
  };
  const sampleRate = integer(options.sampleRate == null ? 48000 : options.sampleRate, 8000, 192000, 'sample rate');
  const standard = options.standard == null ? 'PAL' : options.standard;
  if (standard !== 'PAL' && standard !== 'NTSC') throw new Error('AMCAF PCM: unsupported audio standard');
  const clock = standard === 'PAL' ? 3546895 : 3579545;
  if (!Array.isArray(samples) || samples.length > 31) throw new Error('AMCAF PCM: invalid sample bank');
  let total = 0;
  const pcm = Array.from(samples, (s, i) => {
    if (!s || s.number !== i + 1) throw new Error('AMCAF PCM: invalid sample number');
    const length = integer(s.length, 0, 131070, 'sample length');
    if (!s.pcm || s.pcm.length !== length || (total += length) > 16 * 1024 * 1024) throw new Error('AMCAF PCM: invalid PCM storage');
    for (const value of s.pcm) integer(value, -128, 127, 'signed PCM byte');
    return Int8Array.from(s.pcm);
  });
  const voices = Array.from({ length: 4 }, () => ({ active: false, sample: 0, start: 0,
    length: 0, offset: 0, repeatSample: 0, repeatStart: 0, repeatLength: 0, period: 0, volume: 0 }));
  const raw = Array(4).fill(null);
  let frames = 0, tick = 0, stopped = false;
  function region(action, repeat) {
    const voice = integer(action.voice, 0, 3, 'voice'), sample = integer(action.sample, 0, pcm.length, 'instrument');
    const start = repeat ? integer(action.start, 0, 131070, 'repeat start') : 0;
    const length = integer(action.length, 0, 131070, 'region length');
    if (start + length > (sample ? pcm[sample - 1].length : 0)) throw new Error('AMCAF PCM: region exceeds sample');
    return { voice, sample, start, length };
  }
  function actions(list, repeat) {
    if (!Array.isArray(list) || list.length > 4) throw new Error('AMCAF PCM: invalid DMA intents');
    const result = list.map(a => region(a, repeat));
    if (new Set(result.map(a => a.voice)).size !== result.length) throw new Error('AMCAF PCM: duplicate voice intent');
    return result;
  }
  function apply(frame) {
    if (stopped) throw new Error('AMCAF PCM: renderer is stopped');
    const nextTick = integer(frame.tick, tick + 1, Number.MAX_SAFE_INTEGER, 'tick sequence');
    if (!Array.isArray(frame.state.voices) || frame.state.voices.length !== 4) throw new Error('AMCAF PCM: invalid voice state');
    const registers = frame.state.voices.map(v => ({ period: integer(v.outputPeriod, 0, 65535, 'period'),
      volume: integer(v.outputVolume, 0, 64, 'volume') }));
    const starts = actions(frame.triggers, false), repeats = actions(frame.repeats, true);
    for (let i = 0; i < 4; i++) {
      const start = starts.find(a => a.voice === i);
      if (!raw[i] && (start ? start.length > 0 : voices[i].active) && !registers[i].period) {
        throw new Error('AMCAF PCM: active zero period is unsupported');
      }
    }
    // All validation precedes any register, pointer or phase changes.
    for (let i = 0; i < 4; i++) if (!raw[i]) Object.assign(voices[i], registers[i]);
    for (const a of starts) if (!raw[a.voice]) Object.assign(voices[a.voice], { active: a.length > 0,
      sample: a.sample, start: 0, length: a.length, offset: 0 });
    for (const a of repeats) if (!raw[a.voice]) Object.assign(voices[a.voice], { repeatSample: a.sample,
      repeatStart: a.start, repeatLength: a.length });
    tick = nextTick;
  }
  function render(count, separate = false) {
    integer(count, 0, 1048576, 'frame count');
    const channels = separate ? Array.from({ length: 4 }, () => new Float32Array(count)) : null;
    const left = separate ? null : new Float32Array(count), right = separate ? null : new Float32Array(count);
    const result = separate ? { channels: Object.freeze(channels) } : { left, right };
    if (stopped) return Object.freeze(result);
    for (let i = 0; i < count; i++) {
      for (let number = 0; number < 4; number++) {
        const v = raw[number] || voices[number];
        if (!v.active) continue;
        const value = (raw[number] ? v.pcm[Math.floor(v.offset)] : pcm[v.sample - 1][v.start + Math.floor(v.offset)]) / 128 * v.volume / 64 * 0.5;
        if (separate) channels[number][i] = value;
        else (number === 0 || number === 3 ? left : right)[i] += value;
        v.offset += clock / v.period / sampleRate;
        if (v.offset >= v.length) {
          if (!v.repeatLength) { v.active = false; continue; }
          v.offset = (v.offset - v.length) % v.repeatLength;
          v.sample = v.repeatSample; v.start = v.repeatStart; v.length = v.repeatLength;
        }
      }
    }
    frames += count;
    return Object.freeze(result);
  }
  function rawPlay(mask, bytes, period) {
    integer(mask, 0, 15, 'voice mask'); integer(period, 1, 65535, 'raw period');
    if (!bytes || bytes.length < 2 || bytes.length > 131070 || bytes.length % 2) throw new Error('AMCAF PCM: invalid raw length');
    const owned = Int8Array.from(bytes, value => { integer(value, 0, 255, 'raw byte'); return value > 127 ? value - 256 : value; });
    for (let i = 0; i < 4; i++) if (mask & (1 << i)) {
      voices[i].active = false;
      raw[i] = { pcm: owned, period, volume: 64, offset: 0, length: owned.length, active: true, repeatLength: 0 };
    }
  }
  return Object.freeze({ apply, rawPlay, render: count => render(count), renderVoices: count => render(count, true),
    stopVoices(mask) {
      integer(mask, 0, 15, 'voice mask');
      voices.forEach((v, i) => { if (mask & (1 << i)) { v.active = false; v.volume = 0; raw[i] = null; } });
    },
    stop() { stopped = true; voices.forEach((v, i) => { v.active = false; raw[i] = null; }); },
    get state() { return Object.freeze({ sampleRate, standard, frames, tick, stopped,
      rawMask: raw.reduce((mask, v, i) => mask | (v ? 1 << i : 0), 0),
      voices: Object.freeze(voices.map((v, i) => Object.freeze(raw[i] ? { active: raw[i].active, raw: true, period: raw[i].period, volume: raw[i].volume, offset: raw[i].offset, length: raw[i].length } : { ...v }))) }); } });
}

if (typeof module === 'object' && module.exports) module.exports = createAmcafPcm;
else globalThis.AMOS_AMCAF_PCM = createAmcafPcm;
