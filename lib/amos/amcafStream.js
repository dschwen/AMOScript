/* jshint esversion: 6 */
'use strict';

// Synchronous bridge from externally clocked AMCAF ticks to independently
// cancellable voice PCM blocks. No host timers, AudioContext or imports.
function createAmcafStream(module, factories, options = {}) {
  const sequence = factories.sequence(module, factories.pitch);
  const sampler = factories.pcm(module.samples, options);
  const sampleRate = sampler.state.sampleRate;
  if (options.host != null && typeof options.host.command !== 'function') throw new Error('AMCAF stream requires a synchronous audio host');
  let frame = 0, stream = 1, mask = 15, paused = false, stopped = false, busy = false;
  function emit(event) {
    if (!options.host) return;
    const result = options.host.command(event);
    if (result && typeof result.then === 'function') throw new Error('AMCAF stream commands must complete synchronously');
  }
  function stop() {
    if (stopped) return;
    stopped = true; sequence.stop(); sampler.stop(); emit({ type: 'stop', mask });
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
    tick: () => run(() => { if (paused) return null; const next = sequence.tick(); sampler.apply(next); return next; }),
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
    setVolume: value => run(() => sequence.setVolume(value)),
    setTempo: value => run(() => sequence.setTempo(value)),
    pause: () => run(() => { if (!paused) { paused = true; emit({ type: 'stop', mask }); } }),
    resume: () => run(() => { if (paused) { paused = false; stream++; frame = 0; } }),
    stop,
    get state() { return Object.freeze({ frame, stream, mask, paused, stopped, sequence: sequence.state, sampler: sampler.state }); }
  });
}

if (typeof module === 'object' && module.exports) module.exports = createAmcafStream;
else globalThis.AMOS_AMCAF_STREAM = createAmcafStream;
