/* jshint esversion: 6 */
'use strict';

const boomFactory = typeof module === 'object' && module.exports ? require('./boom') : globalThis.AMOS_BOOM;

// Bounded AMOS sample-bank reader, finite Boom and four-voice commands. No browser APIs.
function createAudio(banks, options = {}) {
  const standard = options.standard || 'PAL';
  if (!['PAL', 'NTSC'].includes(standard)) throw new Error('Unsupported audio standard');
  const clock = standard === 'PAL' ? 3546895 : 3579545;
  const state = { bank: 5, loopMask: 0, filterEnabled: true };
  let noise = null, bellJob = null;
  function boomEngine() {
    if (!noise) {
      const factory = typeof boomFactory === 'function' ? boomFactory : globalThis.AMOS_BOOM;
      if (typeof factory !== 'function') throw new Error('Boom renderer is unavailable: load lib/amos/boom.js');
      noise = factory({ standard, vblHz: options.vblHz, fieldTime: options.fieldTime,
        seed: options.noiseSeed, beam: options.noiseBeam });
    }
    return noise;
  }
  const levels = [56, 56, 56, 56];
  function syncBoom() {
    if (bellJob) {
      const now = options.fieldTime ? options.fieldTime() : 0;
      if (!Number.isFinite(now) || now < 0) throw new Error('Invalid Bell field clock');
      const field = Math.floor(now) - bellJob.started;
      for (let voice = 0; voice < 4; voice++) if (bellJob.mask & (1 << voice)) levels[voice] = field < 1 ? bellJob.initial[voice] : bellJob.volumes[Math.min(30, field)];
    }
    if (!noise) return;
    const step = noise.advance();
    for (let voice = 0; voice < 4; voice++) if (step.mask & (1 << voice)) levels[voice] = step.volume;
  }
  let activeMask = 0;
  let trackerMask = 0;
  let effectMask = 0;
  let effectGeneration = 0;
  function notify(event) {
    if (options.host == null) return;
    if (typeof options.host.command !== 'function') throw new Error('Audio host requires a synchronous command method');
    const result = options.host.command(event);
    if (result && typeof result.then === 'function') throw new Error('Audio host commands must complete synchronously');
  }
  function command(event, origin = 'tracker') {
    syncBoom();
    if (bellJob && (event.type === 'stop' || event.type === 'play' && event.effect !== 'bell')) bellJob.mask &= ~(event.mask & 15);
    if (event.type === 'stop' && (event.mask & 15) === 15) effectGeneration++;
    if (event.type === 'play' && event.effect === 'boom') boomEngine().activate(event.mask);
    if ((event.type === 'play' && event.effect !== 'boom') || event.type === 'stop') { if (noise) noise.cancel(event.mask); }
    if (event.effect !== 'boom' && event.volume != null) {
      for (let voice = 0; voice < 4; voice++) if (event.mask & (1 << voice)) levels[voice] = event.volume;
    }
    if (event.type === 'play') {
      const mask = event.mask & 15;
      activeMask |= mask;
      effectMask = (effectMask & ~mask) | (event.effect ? mask : 0);
      trackerMask = (trackerMask & ~mask) | (origin === 'tracker' ? mask : 0);
    }
    try { notify(event); }
    finally { if (event.type === 'stop') { activeMask &= ~(event.mask & 15); trackerMask &= ~(event.mask & 15); effectMask &= ~(event.mask & 15); } }
  }
  function sample(number) {
    const bank = banks.get(state.bank);
    if (!bank || bank.type !== 'data' || typeof bank.name !== 'string' || bank.name.slice(0, 4) !== 'Samp') throw new Error('Sample bank not found');
    const data = bank.data;
    const bounds = (offset, size) => {
      if (!Number.isSafeInteger(offset) || offset < 0 || size < 0 || offset > data.length - size) throw new Error('Truncated sample bank');
    };
    const word = offset => { bounds(offset, 2); return data[offset] * 256 + data[offset + 1]; };
    const long = offset => word(offset) * 65536 + word(offset + 2);
    const count = word(0), tableEnd = 2 + count * 4;
    bounds(0, tableEnd);
    if (number < 1 || number > count) throw new Error('Sample not defined');
    const offset = long(2 + (number - 1) * 4);
    if (!offset) throw new Error('Sample not defined');
    if (offset < tableEnd || offset % 2) throw new Error('Invalid sample record offset');
    bounds(offset, 14);
    const frequency = word(offset + 8), length = long(offset + 10);
    if (!frequency || !length || length % 2 || length > 16 * 1024 * 1024) throw new Error('Unsupported sample frequency/length');
    bounds(offset + 14, length);
    return { bank: state.bank, number, name: String.fromCharCode(...data.subarray(offset, offset + 8)),
      frequency, length, data: data.slice(offset + 14, offset + 14 + length) };
  }
  function selectBank(number) {
    if (!Number.isInteger(number) || number < 1 || number > 16) throw new Error('Invalid Sam Bank number');
    // Original InSamBank selects a number; validation happens in GetSam/play.
    state.bank = number;
  }
  function loop(enabled, mask = 15) {
    mask &= 15;
    // Sam loops configure the sample interrupt stream, not tracker DMA loops.
    notify({ type: 'loop', mask: mask & ~trackerMask & ~effectMask & ~(options.reservedVoices ? options.reservedVoices() : 0), enabled });
    state.loopMask = enabled ? state.loopMask | mask : state.loopMask & ~mask;
  }
  function filter(enabled) {
    notify({ type: 'filter', enabled }); state.filterEnabled = enabled;
  }
  function play(mask, number, frequency = null) {
    const selected = sample(number);
    if (frequency != null && frequency <= 500) throw new Error('Sam Play frequency must exceed 500 Hz');
    frequency = frequency == null ? selected.frequency : frequency;
    const period = Math.max(124, Math.floor(clock / frequency));
    if (!Number.isFinite(frequency) || !Number.isInteger(period) || period > 65535) throw new Error('Unsupported sample frequency');
    // Mark before dispatch so a partially failing host is silenced by the driver.
    command({ type: 'play', mask: mask & 15, sample: selected, period, rate: clock / period,
      volume: 56, loopMask: state.loopMask, filterEnabled: state.filterEnabled }, 'sample');
  }
  function stop(mask = 15) {
    mask &= 15;
    command({ type: 'stop', mask });
  }
  return { state, sample, selectBank, loop, filter, play, stop, command,
    prepareDefault() { boomEngine(); },
    resetDefault() {
      const engine = boomEngine();
      state.bank = 5; state.loopMask = 0;
      stop(15); levels.fill(56); engine.reset();
      loop(false, 15);
    },
    bell() {
      syncBoom();
      const hz = options.vblHz == null ? 50 : options.vblHz, rate = 44100;
      const now = options.fieldTime ? options.fieldTime() : 0;
      if (!Number.isFinite(hz) || hz <= 0 || hz > 1000 || !Number.isFinite(now) || now < 0) throw new Error('Unsupported Bell timing');
      const phase = now - Math.floor(now), volumes = [0]; let fixed = 0;
      // Music.s: default square wave 1, Bell note 70, EnvBell 1/64,4/40,25/0.
      for (const [steps, goal] of [[1,64],[4,40],[25,0]]) {
        const delta = Math.trunc((((56 * goal) >> 6) - (fixed >> 16)) * 256 / steps) * 256;
        for (let i = 0; i < steps; i++) { fixed += delta; volumes.push(fixed >> 16); }
        fixed &= 0xffff0000;
      }
      const initial = levels.slice(), period = Math.max(124, Math.floor(clock / (8 * 1760)));
      bellJob = { started: Math.floor(now), initial, volumes, mask: 15 };
      const generation = ++effectGeneration;
      for (let voice = 3; voice >= 0; voice--) {
        if (generation !== effectGeneration) break;
        const length = Math.ceil((31 - phase) * rate / hz), data = new Float32Array(length);
        for (let i = 0; i < length; i++) {
          const field = Math.floor(phase + i * hz / rate), sample = Math.floor(i * clock / (rate * period)) & 7;
          data[i] = (sample < 4 ? 127 : -127) / 128 * (field === 0 ? initial[voice] : volumes[Math.min(30, field)]) / 64;
        }
        command({ type: 'play', effect: 'bell', mask: 1 << voice, period, nativeRate: clock / period, rate, volume: 64, loopMask: 0, filterEnabled: state.filterEnabled,
          sample: { bank: 0, number: 0, name: 'Bell    ', frequency: rate, length, data, format: 'float32' } }, 'effect');
      }
    },
    boom() {
      const engine = boomEngine();
      syncBoom();
      const generation = ++effectGeneration, events = engine.begin(levels);
      for (const event of events) {
        if (generation !== effectGeneration) break;
        command({ ...event, filterEnabled: state.filterEnabled }, 'effect');
      }
    },
    noiseState() { const engine = boomEngine(); syncBoom(); return engine.snapshot(false); },
    silence() { if (activeMask) stop(15); } };
}

if (typeof module === 'object' && module.exports) module.exports = createAudio;
else globalThis.AMOS_AUDIO = createAudio;
