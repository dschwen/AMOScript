/* jshint esversion: 6 */
'use strict';

// Field-driven AMOS tracker subset. The caller supplies decoded, owned MOD data
// and a synchronous audio command sink; this controller owns no host timers.
function createTracker(module, options = {}) {
  const clock = options.standard === 'NTSC' ? 3579545 : 3546895;
  if (options.standard != null && !['PAL', 'NTSC'].includes(options.standard)) throw new Error('Unsupported audio standard');
  // Reject unsupported effects before starting any audio, including unused
  // patterns. 000 is empty; 0xy arpeggio is deliberately not implemented yet.
  for (let p = 0; p < module.patterns.length; p++) for (let i = 0; i < 256; i++) {
    const c = module.patterns[p][i];
    if (!([10, 12, 13, 14, 15].includes(c.effect) || c.effect === 0 && c.parameter === 0)) {
      throw new Error(`Tracker: unsupported effect ${c.effect.toString(16)} at pattern ${p}, row ${i >> 2}, channel ${i & 3}`);
    }
  }
  // Native Track Play writes a zero long at EVERY sample address, including
  // empty/short records. Preserve spill into following samples in owned storage.
  const pcm = new Uint8Array(module.samples.reduce((sum, s) => sum + s.length, 0) + 32);
  let at = 0;
  for (const s of module.samples) { pcm.set(s.pcm, at); at += s.length; }
  at = 0;
  for (const s of module.samples) { pcm.fill(0, at, at + 4); at += s.length; }
  at = 0;
  const samples = module.samples.map(s => {
    const sample = { number: s.number, length: s.length, data: pcm.slice(at, at + s.length) };
    at += s.length; return sample;
  });
  const voices = Array.from({ length: 4 }, () => ({ sample: 0, period: 0, volume: 0, effect: 0, parameter: 0 }));
  const state = { playing: true, field: 0, counter: 0, speed: 6, order: 0, row: 0,
    loop: !!options.loop, filterEnabled: options.filterEnabled !== false, voices };
  function emit(event) {
    if (!options.host) return;
    const result = options.host.command({ ...event, field: state.field });
    if (result && typeof result.then === 'function') throw new Error('Tracker audio commands must complete synchronously');
  }
  function stop() {
    if (!state.playing) return;
    state.playing = false; emit({ type: 'stop', mask: 15 });
  }
  function tick() {
    if (!state.playing) return;
    state.field++;
    try {
      if (++state.counter < state.speed) {
        for (let v = 0; v < 4; v++) {
          const voice = voices[v];
          if (voice.effect !== 10 || !voice.parameter) continue;
          const up = voice.parameter >> 4;
          voice.volume = Math.max(0, Math.min(64, voice.volume + (up || -(voice.parameter & 15))));
          emit({ type: 'voice', mask: 1 << v, volume: voice.volume });
        }
        return;
      }
      state.counter = 0;
      const pattern = module.orderTable[state.order], cells = module.patterns[pattern];
      let patternBreak = false;
      for (let v = 0; v < 4; v++) {
        const cell = cells[state.row * 4 + v], voice = voices[v], mask = 1 << v;
        if (cell.sample) {
          voice.sample = cell.sample; voice.volume = module.samples[cell.sample - 1].volume;
          emit({ type: 'voice', mask, volume: voice.volume });
        }
        voice.effect = cell.effect; voice.parameter = cell.parameter;
        if (cell.period) voice.period = cell.period;
        if (cell.effect === 12) {
          voice.volume = Math.min(64, cell.parameter); emit({ type: 'voice', mask, volume: voice.volume });
        }
        if (cell.effect === 14) {
          state.filterEnabled = !(cell.parameter & 1); emit({ type: 'filter', enabled: state.filterEnabled });
        }
        if (cell.effect === 15) state.speed = Math.max(1, Math.min(31, cell.parameter));
        if (cell.effect === 13) patternBreak = true;
        if (cell.period) {
          const descriptor = module.samples[voice.sample - 1], sample = samples[voice.sample - 1];
          if (!sample || !sample.length) emit({ type: 'stop', mask });
          else {
            // With a repeat offset AMOS fetches only through the repeat end on
            // the first pass. A one-word repeat is the zeroed silent word.
            const end = descriptor.loopStart ? descriptor.loopStart + descriptor.loopLength : sample.length;
            emit({ type: 'play', mask, sample: { ...sample, length: end, data: sample.data.slice(0, end) },
              period: voice.period, rate: clock / voice.period, volume: voice.volume,
              loopMask: descriptor.loopLength ? mask : 0,
              ...(descriptor.loopLength ? { loopStart: descriptor.loopStart, loopEnd: descriptor.loopStart + descriptor.loopLength } : {}),
              filterEnabled: state.filterEnabled });
          }
        }
      }
      if (++state.row === 64 || patternBreak) {
        state.row = 0; state.order = (state.order + 1) & 127;
        if (state.order === module.songLength) {
          if (!state.loop) stop();
          // Preserve the native raw restart byte, rather than modern players'
          // usual restart-to-zero normalization. Bound unsafe restart bytes.
          else if (module.restart > 127) throw new Error('Tracker: restart exceeds order table');
          else state.order = module.restart;
        }
      }
    } catch (error) {
      try { stop(); } catch (_) { /* preserve the original failure */ }
      error.message += ` at tracker field ${state.field}, order ${state.order}, row ${state.row}`;
      throw error;
    }
  }
  return { state, tick, stop };
}

if (typeof module === 'object' && module.exports) module.exports = createTracker;
else globalThis.AMOS_TRACKER = createTracker;
