/* jshint esversion: 6 */
'use strict';

// Source-derived AMOS Music subset, stepped by explicit fields. No timers or
// browser APIs. VM bank/scheduler integration is a separate acceptance gate.
function createMusic(module, options = {}) {
  const standard = options.standard || 'PAL', clock = standard === 'PAL' ? 3546895 : 3579545;
  if (!['PAL', 'NTSC'].includes(standard)) throw new Error('Unsupported music audio standard');
  const number = options.song == null ? 1 : options.song, selected = module.songs[number - 1];
  const song = selected && { ...selected, voices: selected.voices.map(voice => ({ ...voice, orders: voice.orders.slice() })) };
  const patterns = module.patterns.map(pattern => pattern.map(stream => stream && { words: Uint16Array.from(stream.words) }));
  const instruments = module.instruments.map(instrument => ({ ...instrument }));
  if (!Number.isInteger(number) || number < 1 || !song) throw new Error('AMOS Music song not defined');
  if (options.host != null && typeof options.host.command !== 'function') throw new Error('AMOS Music audio host requires a synchronous command method');
  const supported = new Set([0, 3, 8, 9, 14, 16]);
  // Check every stream, including unused ones, before dispatching any sound.
  for (const pattern of patterns) for (const stream of pattern) if (stream) for (const word of stream.words) {
    if (!(word & 0x8000)) {
      if (word & 0x4000 || !(word & 0x0fff)) throw new Error('Unsupported AMOS Music note form');
    } else {
      const command = (word >> 8) & 127, value = word & 255;
      if (!supported.has(command)) throw new Error(`Unsupported AMOS Music command ${command}`);
      if (command === 8 && (!value || value >= 100)) throw new Error('Unsupported AMOS Music tempo');
      if (command === 9 && value >= instruments.length) throw new Error('AMOS Music instrument not defined');
    }
  }
  for (let v = 0; v < 4; v++) {
    let instrument = null, delay = false;
    for (const order of song.voices[v].orders) {
      const stream = patterns[order][v]; if (!stream) break;
      for (const word of stream.words) {
        if (!(word & 0x8000)) {
          if (instrument == null) throw new Error('AMOS Music note has no instrument');
          if (instruments[instrument].length * (word & 0xfff) * (standard === 'PAL' ? 50 : 60) < clock) throw new Error('Unsupported short AMOS Music initial fetch');
        }
        if ((word >> 8) === 0x89) instrument = word & 255;
        if ((word >> 8) === 0x90) delay = true;
      }
    }
    if (song.voices[v].loop && !delay) throw new Error('AMOS Music voice loop has no delay');
  }
  const samples = instruments.map(instrument => {
    // Explicitly append the repeat region. It may precede the initial fetch or
    // lie outside it; Web Audio must not truncate the initial fetch to loopEnd.
    const data = new Uint8Array(instrument.length + instrument.repeatLength);
    data.set(instrument.pcm); data.set(instrument.repeatPcm, instrument.length);
    return { number: instrument.number, name: instrument.name, length: data.length, data, initialLength: instrument.length };
  });
  const voices = Array.from({ length: 4 }, () => ({ count: 1, order: -1, position: 0, instrument: null, note: 0, volume: 0, baseVolume: 0,
    hardwareVolume: 0, effect: 0, slide: 0, loops: 0, ended: false }));
  const base = standard === 'PAL' ? 100 : 120;
  const state = { playing: true, field: 0, counter: base, tempo: 17, volume: options.volume == null ? 56 : options.volume, voices };
  const volumeCheck = level => { if (!Number.isInteger(level) || level < 0 || level > 63) throw new Error('Invalid AMOS Music volume'); };
  volumeCheck(state.volume);
  const scaled = value => ((value * state.volume) & 65535) >>> 6;
  function emit(event) {
    if (!options.host) return;
    const result = options.host.command({ ...event, field: state.field, source: 'amos-music' });
    if (result && typeof result.then === 'function') throw new Error('AMOS Music audio commands must complete synchronously');
  }
  function stop() { if (!state.playing) return; state.playing = false; emit({ type: 'stop', mask: 15 }); }
  function setVolume(level) { volumeCheck(level); state.volume = level; for (const voice of voices) voice.volume = scaled(voice.baseVolume); }
  function next(v) {
    const voice = voices[v], list = song.voices[v];
    voice.count = 0; voice.effect = 0; voice.position = 0;
    voice.order++;
    if (voice.order >= list.orders.length) {
      if (!list.loop) { voice.ended = true; return null; }
      voice.order = 0; voice.loops++;
    }
    const stream = patterns[list.orders[voice.order]][v];
    if (!stream) { voice.ended = true; return null; }
    return stream;
  }
  function step(v) {
    const voice = voices[v]; let stream = voice.order < 0 ? next(v) : patterns[song.voices[v].orders[voice.order]][v];
    for (let commands = 0; stream && commands < 4096; commands++) {
      const word = stream.words[voice.position++];
      if (word == null) throw new Error('AMOS Music pattern overrun');
      if (!(word & 0x8000)) {
        voice.note = word & 0xfff;
        const sample = samples[voice.instrument];
        emit({ type: 'play', mask: 1 << v, sample, period: voice.note, rate: clock / voice.note, volume: voice.hardwareVolume,
          loopMask: 1 << v, loopStart: sample.initialLength, loopEnd: sample.length, filterEnabled: options.filterEnabled !== false });
      } else {
        const command = (word >> 8) & 127, value = word & 255;
        if (command === 0) stream = next(v);
        else if (command === 3) { voice.baseVolume = Math.min(63, value); voice.volume = scaled(voice.baseVolume); }
        else if (command === 8) state.tempo = value;
        else if (command === 9) { voice.instrument = value; voice.baseVolume = Math.min(63, instruments[value].volume); voice.volume = scaled(voice.baseVolume); }
        else if (command === 14) { voice.slide = -value; voice.effect = 1; }
        else if (command === 16) { voice.count = value; if (!value) voice.ended = true; return; }
      }
    }
    if (stream) throw new Error('AMOS Music command budget exceeded');
  }
  function tick() {
    if (!state.playing) return;
    state.field++;
    try {
      state.counter = (state.counter + state.tempo) & 65535;
      if (state.counter < base) {
        for (let v = 0; v < 4; v++) {
          const voice = voices[v];
          if (voice.effect) {
            if (!voice.slide) voice.effect = 0;
            else {
              let period = (voice.note + voice.slide) & 65535;
              if (period < 0x71) { period = 0x71; voice.effect = 0; }
              if (period > 0x358) { period = 0x358; voice.effect = 0; }
              voice.note = period;
            }
          }
          voice.hardwareVolume = voice.volume;
          emit({ type: 'voice', mask: 1 << v, volume: voice.hardwareVolume, ...(voice.note ? { rate: clock / voice.note, period: voice.note } : {}) });
        }
        return;
      }
      state.counter -= base;
      let counting = 0;
      for (let v = 0; v < 4; v++) if (voices[v].count) { counting++; if (!--voices[v].count) step(v); }
      if (!counting) stop();
    } catch (error) { try { stop(); } catch (_) { /* retain the source failure */ } throw error; }
  }
  try { emit({ type: 'stop', mask: 15 }); } catch (error) { state.playing = false; throw error; }
  return { state, samples, tick, stop, setVolume,
    advance(field) {
      if (!Number.isSafeInteger(field) || field < state.field || field - state.field > 100000) throw new Error('Invalid AMOS Music field catch-up');
      while (state.playing && state.field < field) tick();
    } };
}

if (typeof module === 'object' && module.exports) module.exports = createMusic;
else globalThis.AMOS_MUSIC = createMusic;
