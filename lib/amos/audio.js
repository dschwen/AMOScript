/* jshint esversion: 6 */
'use strict';

const boomFactory = typeof module === 'object' && module.exports ? require('./boom') : globalThis.AMOS_BOOM;

// Bounded AMOS sample-bank reader, finite Boom and four-voice commands. No browser APIs.
function createAudio(banks, options = {}) {
  const standard = options.standard || 'PAL';
  if (!['PAL', 'NTSC'].includes(standard)) throw new Error('Unsupported audio standard');
  const clock = standard === 'PAL' ? 3546895 : 3579545;
  const state = { bank: 5, loopMask: 0, filterEnabled: true };
  let noise = null;
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
    if (event.type === 'stop' && (event.mask & 15) === 15) effectGeneration++;
    if (event.type === 'play' && event.effect === 'boom') boomEngine().activate(event.mask);
    if ((event.type === 'play' && event.effect !== 'boom') || event.type === 'stop') { if (noise) noise.cancel(event.mask); }
    if (event.effect !== 'boom' && event.volume != null) {
      for (let voice = 0; voice < 4; voice++) if (event.mask & (1 << voice)) levels[voice] = event.volume;
    }
    if (event.type === 'play') {
      const mask = event.mask & 15;
      activeMask |= mask;
      effectMask = (effectMask & ~mask) | (event.effect === 'boom' ? mask : 0);
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
