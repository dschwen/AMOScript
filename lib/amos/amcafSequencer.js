/* jshint esversion: 6 */
'use strict';

// Pure AMCAF 1.50beta4 tick controller. The injected pitch factory keeps this
// function standalone-embeddable. Returned DMA intents are not Web Audio events:
// a repeat pointer may change without restarting the currently fetched sample.
function createAmcafSequencer(module, createPitch) {
  const pitch = createPitch();
  const check = (v, min, max, name) => {
    if (!Number.isInteger(v) || v < min || v > max) throw new Error(`AMCAF sequencer: invalid ${name}`);
    return v;
  };
  const songLength = check(module.songLength, 1, 128, 'song length');
  if (module.patterns.length < 1 || module.patterns.length > 128 || module.samples.length !== 31) throw new Error('AMCAF sequencer: invalid module shape');
  const patterns = module.patterns.map((pattern, p) => {
    if (pattern.length !== 256) throw new Error('AMCAF sequencer: invalid pattern length');
    return pattern.map((c, i) => {
      const sample = check(c.sample, 0, 31, 'instrument'), period = check(c.period, 0, 4095, 'note');
      const effect = check(c.effect, 0, 15, 'effect'), parameter = check(c.parameter, 0, 255, 'parameter');
      if (![0,1,2,3,4,5,6,8,9,10,11,12,13,14,15].includes(effect) || effect === 14 && ![0,9,10,11].includes(parameter>>4) || effect === 11 && parameter > 127) {
        throw new Error(`AMCAF sequencer: unsupported effect ${effect.toString(16)}:${parameter.toString(16)} at pattern ${p}, row ${i >> 2}, channel ${i & 3}`);
      }
      return { sample, period, effect, parameter };
    });
  });
  if (module.orderTable.length !== 128) throw new Error('AMCAF sequencer: invalid order table');
  const orders = Array.from(module.orderTable, p => check(p, 0, patterns.length - 1, 'pattern index'));
  const samples = module.samples.map((s, i) => {
    const length = check(s.length, 0, 131070, 'sample length');
    const loopStart = check(s.loopStart, 0, length, 'loop start');
    const loopLength = check(s.loopLength, 0, 131070, 'loop length');
    // Empty MOD instruments conventionally have a one-word repeat header.
    // They produce silence, never an out-of-range PCM fetch.
    if (length && loopStart + loopLength > length) throw new Error('AMCAF sequencer: repeat exceeds sample');
    if (s.pcm.length !== length) throw new Error('AMCAF sequencer: invalid PCM length');
    return { number: i + 1, length, loopStart, loopLength,
      finetune: check(s.finetune, -8, 7, 'finetune'), volume: check(s.volume, 0, 64, 'volume'),
      pcm: Int8Array.from(s.pcm) };
  });
  const voices = Array.from({ length: 4 }, () => ({ sample: 0, period: 0, volume: 0,
    outputPeriod: 0, outputVolume: 0, effect: 0, parameter: 0, finetune: 0,
    target: 0, descending: false, portaSpeed: 0, vibratoMemory: 0, vibratoPosition: 0,
    fetchStart: 0, fetchLength: 0, sampleOffset: 0 }));
  const instruments=[0,0,0,0],vu=[0,0,0,0];let signal=0;
  let playing = true, ticks = 0, counter = 0, speed = 6, bpm = 125, order = 0, row = 0, master = 64, ends = 0;
  const signed = v => (v << 16) >> 16;
  const volume = v => { v.outputVolume = (v.volume * master) >> 6; };
  function offsetSample(voice, parameter) {
    if (parameter) voice.sampleOffset = parameter;
    const offsetWords = voice.sampleOffset << 7;
    // LAB_048C compares signed words and falls back to one DMA word.
    if (offsetWords >= signed(voice.fetchLength / 2)) voice.fetchLength = 2;
    else {
      voice.fetchLength -= offsetWords * 2;
      voice.fetchStart += offsetWords * 2;
    }
  }
  function startSample(voice, channel) {
    const sample = samples[voice.sample - 1];
    const start = sample && sample.length ? voice.fetchStart : 0;
    const length = sample && sample.length ? voice.fetchLength : 0;
    if (start + length > (sample ? sample.length : 0)) throw Error('AMCAF sequencer: sample fetch exceeds instrument');
    return Object.freeze({ voice: channel, sample: voice.sample, ...(start ? { start } : {}), length });
  }
  function retrigger(voice, channel, triggers, repeats, enabled) {
    const interval = voice.parameter & 15;
    if (!interval || counter % interval || !(enabled & (1 << channel))) return;
    triggers.push(startSample(voice, channel));
    voice.outputPeriod = voice.period;
    if (repeats) {
      const sample = samples[voice.sample - 1];
      repeats.push(Object.freeze({ voice: channel, sample: sample ? sample.number : 0,
        start: sample ? sample.loopStart : 0, length: sample && sample.length ? sample.loopLength : 0 }));
    }
  }
  function slideVolume(v) {
    const up = v.parameter >> 4;
    v.volume = Math.max(0, Math.min(64, v.volume + (up || -(v.parameter & 15))));
    volume(v);
  }
  function porta(v) {
    if (!v.target) return;
    v.period = (v.period + (v.descending ? -v.portaSpeed : v.portaSpeed)) & 65535;
    if (v.descending ? signed(v.period) <= signed(v.target) : signed(v.period) >= signed(v.target)) {
      v.period = v.target; v.target = 0;
    }
    v.outputPeriod = v.period;
  }
  function between(v, filters) {
    const e = v.effect, p = v.parameter;
    if(e===14){if(!(p>>4))filters.push(!(p&1));return;}
    if (!e && !p) { v.outputPeriod = v.period; volume(v); }
    else if (!e) {
      const output = pitch.arpeggio(v.period, v.finetune, p, counter);
      if (output !== null) v.outputPeriod = output;
    } else if (e === 1 || e === 2) {
      const s = pitch.slide(v.period, p, e === 2); v.period = s.period; v.outputPeriod = s.output;
    } else if (e === 3 || e === 5) {
      if (e === 3 && p) { v.portaSpeed = p; v.parameter = 0; }
      porta(v); if (e === 5) slideVolume(v);
    } else if (e === 4 || e === 6) {
      const s = pitch.vibrato(v.period, v.vibratoPosition, v.vibratoMemory, e === 4 ? p : 0);
      v.outputPeriod = s.output; v.vibratoPosition = s.position; v.vibratoMemory = s.memory;
      if (e === 6) slideVolume(v);
    } else {
      v.outputPeriod = v.period;
      if (e === 10) slideVolume(v);
    }
  }
  function snapshot() {
    return Object.freeze({ playing, ticks, counter, speed, bpm, order, row, master, ends,
      voices: Object.freeze(voices.map(v => Object.freeze({ ...v }))) });
  }
  function tick(enabled = 15) {
    check(enabled,0,15,'voice mask');
    if (!playing) return null;
    const at = { tick: ++ticks, order, row }, triggers = [], repeats = [], filters = [];
    let isRow = false;
    try {
      if (++counter < speed) voices.forEach((voice, channel) => {
        between(voice, filters);
        if (voice.effect === 14 && (voice.parameter >> 4) === 9) retrigger(voice, channel, triggers, repeats, enabled);
      });
      else {
        isRow = true; counter = 0;
        let jump = false, breakRow = 0;
        const cells = patterns[orders[order]];
        for (let channel = 0; channel < 4; channel++) {
          const c = cells[row * 4 + channel], v = voices[channel];
          v.effect = c.effect; v.parameter = c.parameter; instruments[channel]=c.sample&15;
          if (c.sample) {
            const s = samples[c.sample - 1];
            v.fetchStart = 0; v.fetchLength = s.loopStart ? s.loopStart + s.loopLength : s.length;
            v.sample = c.sample; v.finetune = s.finetune; v.volume = s.volume; volume(v);
            if(enabled & (1<<channel))vu[channel]=v.outputVolume;
          }
          if (c.period) {
            if (c.effect === 3 || c.effect === 5) {
              v.target = pitch.target(c.period, v.finetune);
              v.descending = signed(v.target) < signed(v.period);
              if (v.target === v.period) v.target = 0;
            } else {
              if (c.effect === 9) offsetSample(v, c.parameter);
              v.period = pitch.tune(c.period, v.finetune); v.outputPeriod = v.period; v.vibratoPosition = 0;
              triggers.push(startSample(v, channel));
            }
          }
          if(c.effect===8){signal=c.parameter;v.outputPeriod=v.period;volume(v);}
          else if (c.effect === 9) offsetSample(v, c.parameter);
          else if (c.effect === 11) {
            const previous = (c.parameter - 1) & 255;
            if (((previous << 24) >> 24) < order) {ends++;signal=255;}
            order = previous; jump = true; breakRow = 0;
          } else if (c.effect === 13) {
            const value = (c.parameter >> 4) * 10 + (c.parameter & 15);
            breakRow = value > 63 ? 0 : value; jump = true;
          } else if (c.effect === 15) {
            if (c.parameter && c.parameter < 32) { speed = c.parameter; counter = 0; }
            else if (c.parameter >= 32) bpm = c.parameter;
          } else if (c.effect === 12) {
            if(enabled & (1<<channel)){v.volume = Math.min(64, c.parameter); volume(v);if(c.period)vu[channel]=v.outputVolume;}
          } else if(c.effect===14){
            const kind=c.parameter>>4,amount=c.parameter&15;
            if(!kind)filters.push(!(c.parameter&1));
            else if (kind === 9) { if (!c.period) retrigger(v, channel, triggers, null, enabled); }
            else {v.volume=kind===10?Math.min(64,v.volume+amount):Math.max(0,v.volume-amount);volume(v);}
          } else { v.outputPeriod = v.period; volume(v); }
        }
        // Native repeat registers are written after all new-note DMA starts,
        // in reverse channel order, even when there was no new note.
        for (let channel = 3; channel >= 0; channel--) {
          const s = samples[voices[channel].sample - 1];
          repeats.push(Object.freeze({ voice: channel, sample: s ? s.number : 0,
            start: s ? s.loopStart : 0, length: s && s.length ? s.loopLength : 0 }));
        }
        if (jump || ++row === 64) {
          row = breakRow; order = (order + 1) & 127;
          if (order >= songLength) { order = 0; ends++; signal=255; }
        }
      }
      return Object.freeze({ ...at, isRow, ...(filters.length?{filters:Object.freeze(filters)}:{}), triggers: Object.freeze(triggers), repeats: Object.freeze(repeats), state: snapshot() });
    } catch (error) {
      playing = false;
      error.message += ` at AMCAF tick ${ticks}, order ${at.order}, row ${at.row}`;
      throw error;
    }
  }
  function readStatus(kind,voice){
    if(['instrument','note','vu'].includes(kind))check(voice,0,3,'query voice');
    if(kind==='order')return order;
    if(kind==='row')return row;
    if(kind==='instrument')return instruments[voice];
    if(kind==='note'){
      const period=voices[voice].period,value=period?Math.floor(3546895/period):0;
      if(value>65535)throw Error('AMCAF Cnote DIVU overflow is not implemented');
      return value;
    }
    if(kind==='vu'){const value=vu[voice];vu[voice]=0;return value;}
    if(kind==='signal'){const value=signal;signal=0;return value;}
    throw Error('Unknown AMCAF status query');
  }
  return Object.freeze({ tick, readStatus, get state() { return snapshot(); }, stop() { playing = false; },
    setTempo(value) { bpm = check(value, 32, 255, 'tempo'); },
    setVolume(value) {
      check(value, -2147483648, 2147483647, 'master volume');
      master = value < 0 ? 0 : Math.min(64, value & 65535);
    },
    sample(number) {
      const s = samples[check(number, 1, 31, 'sample number') - 1];
      return Object.freeze({ ...s, pcm: Int8Array.from(s.pcm) });
    } });
}

if (typeof module === 'object' && module.exports) module.exports = createAmcafSequencer;
else globalThis.AMOS_AMCAF_SEQUENCER = createAmcafSequencer;
