/* jshint esversion: 6 */
'use strict';

// Optional browser adapter. Caller owns the AudioContext and its user-gesture
// activation. The same adapter accepts OfflineAudioContext for deterministic tests.
function createWebAudioHost(context, options = {}) {
  const input = context.createGain(), filter = context.createBiquadFilter(), merger = context.createChannelMerger(2), voices = new Map();
  merger.connect(input);
  filter.type = 'lowpass'; filter.frequency.value = options.filterFrequency || 3300;
  filter.Q.value = Math.SQRT1_2;
  filter.connect(context.destination); input.connect(filter);
  let disposed = false;
  function stop(mask) {
    for (const [number, voice] of voices) if (mask & (1 << number)) {
      voices.delete(number); voice.source.onended = null;
      try { voice.source.stop(); } finally { voice.source.disconnect(); voice.gain.disconnect(); }
    }
  }
  function command(event) {
    if (disposed) throw new Error('Audio host is disposed');
    // OfflineAudioContext closes when rendering finishes. Cleanup must remain
    // valid after completion, even if onended delivery is still queued.
    if (event.type === 'stop') { stop(event.mask); return; }
    if (context.state === 'closed') throw new Error('Audio context is closed');
    if (event.type === 'filter') {
      input.disconnect(); input.connect(event.enabled ? filter : context.destination); return;
    }
    if (event.type === 'loop') {
      for (const [number, voice] of voices) if (event.mask & (1 << number)) voice.source.loop = event.enabled;
      return;
    }
    if (event.type === 'voice') {
      if (event.volume != null && (!Number.isFinite(event.volume) || event.volume < 0 || event.volume > 64)) throw new Error('Invalid audio voice volume');
      if (event.rate != null && (!Number.isFinite(event.rate) || event.rate <= 0)) throw new Error('Invalid audio voice rate');
      for (const [number, voice] of voices) if (event.mask & (1 << number)) {
        if (event.volume != null) voice.gain.gain.setValueAtTime(event.volume / 64, context.currentTime);
        if (event.rate != null) voice.source.playbackRate.setValueAtTime(event.rate / context.sampleRate, context.currentTime);
      }
      return;
    }
    if (event.type !== 'play') throw new Error('Unsupported audio host command');
    if (event.loopStart != null && (!Number.isInteger(event.loopStart) || !Number.isInteger(event.loopEnd) ||
        event.loopStart < 0 || event.loopStart >= event.loopEnd || event.loopEnd > event.sample.length)) throw new Error('Invalid audio sample loop');
    // Store signed 8-bit PCM at the context rate, then use playbackRate for the
    // actual Paula-clock/period rate. This also supports source rates below the
    // Web Audio createBuffer sample-rate minimum.
    const buffer = context.createBuffer(1, event.sample.length, context.sampleRate), pcm = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) pcm[i] = ((event.sample.data[i] << 24) >> 24) / 128;
    stop(event.mask);
    input.disconnect(); input.connect(event.filterEnabled ? filter : context.destination);
    try {
      for (let number = 0; number < 4; number++) if (event.mask & (1 << number)) {
        const source = context.createBufferSource(), gain = context.createGain();
        source.buffer = buffer; source.loop = !!(event.loopMask & (1 << number));
        if (event.loopStart != null) {
          source.loopStart = event.loopStart / context.sampleRate;
          source.loopEnd = event.loopEnd / context.sampleRate;
        }
        source.playbackRate.value = event.rate / context.sampleRate;
        gain.gain.value = event.volume / 64;
        source.connect(gain); gain.connect(merger, 0, number === 0 || number === 3 ? 0 : 1);
        const voice = { source, gain }; voices.set(number, voice);
        source.onended = () => {
          if (voices.get(number) !== voice) return;
          voices.delete(number); source.disconnect(); gain.disconnect();
        };
        source.start();
      }
    } catch (error) { stop(event.mask); throw error; }
  }
  return { command, activeVoices: () => [...voices.keys()].sort(),
    dispose() {
      if (disposed) return;
      stop(15); merger.disconnect(); input.disconnect(); filter.disconnect(); disposed = true;
    } };
}

if (typeof module === 'object' && module.exports) module.exports = { createWebAudioHost };
else globalThis.AMOS_WEB_AUDIO = { createWebAudioHost };
