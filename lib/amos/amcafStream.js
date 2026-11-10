/* jshint esversion: 6 */
'use strict';

// Synchronous bridge from externally clocked AMCAF ticks to independently
// cancellable voice PCM blocks. No host timers, AudioContext or imports.
function createAmcafStream(module, factories, options = {}) {
  const sequence = module ? factories.sequence(module, factories.pitch) : null;
  const sampler = factories.pcm(module ? module.samples : [], options);
  const sampleRate = sampler.state.sampleRate;
  if (options.host != null && typeof options.host.command !== 'function') throw new Error('AMCAF stream requires a synchronous audio host');
  const leases = [0, 0, 0, 0];
  let voiceMask = 15;
  let frame = 0, stream = 1, mask = module ? 15 : 0, paused = false, stopped = false, busy = false;
  function emit(event) {
    if (!options.host) return;
    const result = options.host.command(event);
    if (result && typeof result.then === 'function') throw new Error('AMCAF stream commands must complete synchronously');
  }
  function stop() {
    if (stopped) return;
    stopped = true; if (sequence) sequence.stop(); sampler.stop(); emit({ type: 'stop', mask });
  }
  function run(fn) {
    if (busy) throw new Error('AMCAF stream cannot be entered from its audio host');
    if (stopped) return false;
    busy = true;
    try { return fn(); }
    catch (error) { try { stop(); } catch (_) { /* retain the initiating failure */ } throw error; }
    finally { busy = false; }
  }
  return Object.freeze({
    readStatus:(kind,voice)=>sequence?sequence.readStatus(kind,voice):0,
    tick: () => run(() => { if (paused || !sequence) return null; const next = sequence.tick(voiceMask & ~sampler.state.rawMask); sampler.apply(next,voiceMask); for(const enabled of next.filters||[]) { emit({type:'filter',enabled}); if(stopped||paused)break; } return next; }),
    render: count => run(() => {
      if (paused) return false;
      if (!Number.isInteger(count) || count < 0 || count > 65536 || frame > Number.MAX_SAFE_INTEGER - count) throw new Error('AMCAF stream: invalid frame count');
      const at = frame, output = sampler.renderVoices(count); frame += count;
      if (count && mask) emit({ type: 'pcm', stream, frame: at, sampleRate, mask, channels: output.channels });
      return !stopped;
    }),
    setMask: value => run(() => {
      if (!Number.isInteger(value) || value < 0 || value > 15) throw new Error('AMCAF stream: invalid voice mask');
      const removed = mask & ~value; mask = value;
      if (removed) emit({ type: 'stop', mask: removed });
    }),
    setVoiceMask: value => run(() => {
      if (!Number.isInteger(value) || value < 0 || value > 15) throw new Error('AMCAF stream: invalid voice mask');
      voiceMask=value;const disabled=(~value)&15;
      // DMA is disabled immediately; merely re-enabling cannot restore phase.
      // Raw leases retain their countdown, with held DMA silenced as on hardware.
      sampler.silenceVoices(disabled);mask=(module?voiceMask:0)|sampler.state.rawMask;
      if(disabled)emit({type:'stop',mask:disabled});
    }),
    setVolume: value => run(() => { if (sequence) sequence.setVolume(value); }),
    stopVoices: value => run(() => {
      if (!Number.isInteger(value) || value < 0 || value > 15) throw new Error('AMCAF stream: invalid voice mask');
      for (let i=0;i<4;i++) if(value & (1<<i)) leases[i]=0;
      sampler.stopVoices(value);
      if (!sequence) mask &= ~value;
      if (value) emit({ type: 'stop', mask: value });
    }),
    rawPlay: (value, bytes, period, fields) => run(() => {
      if (!Number.isInteger(fields) || fields < 1 || fields > 32767) throw new Error('AMCAF stream: invalid raw lease');
      sampler.rawPlay(value, bytes, period);
      mask |= value;
      for (let i=0;i<4;i++) if(value & (1<<i)) leases[i]=fields;
      if(value) emit({ type: 'stop', mask: value });
    }),
    vbl: () => run(() => {
      if (paused) return;
      let released=0;
      for(let i=0;i<4;i++) if(leases[i] && --leases[i]===0) released |= 1<<i;
      if(released){sampler.stopVoices(released);mask=(mask&~released)|(sequence?(voiceMask&released):0);emit({type:'stop',mask:released});}
    }),
    setTempo: value => run(() => { if (sequence) sequence.setTempo(value); }),
    pause: () => run(() => { if (!paused) { paused = true; emit({ type: 'stop', mask }); } }),
    resume: () => run(() => { if (paused) { paused = false; stream++; frame = 0; } }),
    stop,
    get state() { return Object.freeze({ frame, stream, mask, paused, stopped, sequence: sequence ? sequence.state : null, leases: Object.freeze([...leases]), sampler: sampler.state }); }
  });
}

if (typeof module === 'object' && module.exports) module.exports = createAmcafStream;
else globalThis.AMOS_AMCAF_STREAM = createAmcafStream;
