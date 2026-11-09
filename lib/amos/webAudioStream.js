/* jshint esversion: 6 */
'use strict';

// Compose scheduled PCM with the existing native sample host. The caller owns
// AudioContext activation/closure and invalidation of retired VM bindings.
function createWebAudioStreamHost(context, createSampleHost, options = {}) {
  const latency = options.latency == null ? 0.04 : options.latency;
  const maxAhead = options.maxAhead == null ? 1 : options.maxAhead;
  if (!Number.isFinite(latency) || latency < 0 || latency > 0.25 || !Number.isFinite(maxAhead) || maxAhead < 0.1 || maxAhead > 2 || maxAhead < latency) throw new Error('Invalid PCM stream buffering options');
  const native = createSampleHost(context, options), streams = new Map();
  const merger = context.createChannelMerger(2), input = context.createGain(), filter = context.createBiquadFilter();
  merger.connect(input); input.connect(context.destination);
  filter.type = 'lowpass'; filter.frequency.value = options.filterFrequency || 3300; filter.Q.value = Math.SQRT1_2; filter.connect(context.destination);
  let disposed = false;
  const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
  function forward(event) {
    // The PCM mixer reserves one-half gain per Paula channel. Apply the same
    // normalization to ordinary samples sharing those channels.
    const result = native.command(event.volume != null ? { ...event, volume: event.volume * 0.5 } : event);
    if (result && typeof result.then === 'function') throw new Error('Native audio host must complete synchronously');
  }
  function retire(entry, node, cancel) {
    entry.nodes.delete(node); node.source.onended = null;
    try { if (cancel) node.source.stop(); } catch (_) { /* failed start/closed host */ }
    finally { node.source.disconnect(); }
  }
  function stop(mask) {
    for (const [voice, entry] of streams) if (mask & (1 << voice)) {
      streams.delete(voice);
      for (const node of [...entry.nodes]) retire(entry, node, true);
    }
  }
  function queue(event) {
    const rate = event.sampleRate, frame = event.frame;
    if (!integer(rate,8000,192000) || !integer(frame,0,Number.MAX_SAFE_INTEGER) || !integer(event.stream,1,Number.MAX_SAFE_INTEGER) || !integer(event.mask,0,15) || !Array.isArray(event.channels) || event.channels.length !== 4) throw new Error('Invalid PCM stream block');
    const count = event.channels[0].length;
    if (!integer(count,1,65536) || frame > Number.MAX_SAFE_INTEGER - count) throw new Error('Invalid PCM stream length');
    for (const data of event.channels) {
      if (Object.prototype.toString.call(data) !== '[object Float32Array]' || data.length !== count) throw new Error('Invalid PCM stream channels');
      for (const v of data) if (!Number.isFinite(v) || Math.abs(v) > 1) throw new Error('Invalid PCM stream value');
    }
    const now = context.currentTime, plans = [];
    const reference = [...streams.values()].find(e => e.stream === event.stream && e.rate === rate);
    for (let voice = 0; voice < 4; voice++) if (event.mask & (1 << voice)) {
      const old = streams.get(voice), same = old && old.stream === event.stream;
      if (same && (old.rate !== rate || old.next !== frame)) throw new Error('PCM stream blocks must be contiguous at one sample rate');
      const entry = same ? old : { stream: event.stream, rate, origin: reference ? reference.origin : frame,
        anchor: reference ? reference.anchor : now + latency, next: frame, nodes: new Set() };
      const start = entry.anchor + (frame - entry.origin) / rate, end = start + count / rate;
      if (end > now + maxAhead + 1e-9) throw new Error('PCM stream queue exceeds lookahead bound');
      const liveNodes = [...entry.nodes].filter(n => n.end > now);
      if (end > now && liveNodes.length >= 128) throw new Error('PCM stream queue exceeds node bound');
      const offset = Math.max(0, Math.ceil((now - start) * rate - 1e-7));
      let buffer = null;
      if (offset < count) { buffer = context.createBuffer(1,count,rate); buffer.copyToChannel(event.channels[voice],0); }
      plans.push({ voice, entry, same, start, end, offset, buffer });
    }
    // Validate/allocate every selected channel before changing any ownership.
    try {
      for (const p of plans) {
        if (!p.same) { stop(1 << p.voice); forward({ type: 'stop', mask: 1 << p.voice }); streams.set(p.voice,p.entry); }
        for (const node of [...p.entry.nodes]) if (node.end <= now) retire(p.entry,node,false);
        p.entry.next = frame + count;
        if (!p.buffer) continue; // Expired PCM advances the timeline but is never replayed.
        const source = context.createBufferSource(), node = { source, end: p.end };
        p.entry.nodes.add(node);
        source.buffer = p.buffer; source.connect(merger,0,p.voice === 0 || p.voice === 3 ? 0 : 1);
        source.onended = () => retire(p.entry,node,false);
        source.start(p.start + p.offset / rate,p.offset / rate);
      }
    } catch (error) { try { stop(event.mask); } catch (_) { /* preserve host error */ } throw error; }
  }
  function command(event) {
    if (disposed) throw new Error('PCM audio host is disposed');
    if (event.type === 'stop') { stop(event.mask); forward(event); return; }
    if (context.state === 'closed') throw new Error('Audio context is closed');
    if (event.type === 'pcm') { queue(event); return; }
    if (event.type === 'play') stop(event.mask);
    if (event.type === 'voice' && (event.volume != null || event.rate != null) && [...streams.keys()].some(v => event.mask & (1 << v))) throw new Error('PCM voice values must be rendered before streaming');
    if (event.type === 'filter') { input.disconnect(); input.connect(event.enabled ? filter : context.destination); }
    forward(event);
  }
  return Object.freeze({ command,
    activeVoices: () => [...new Set([...native.activeVoices(), ...[...streams].filter(([,e]) => [...e.nodes].some(n => n.end > context.currentTime)).map(([v]) => v)])].sort(),
    dispose() {
      if (disposed) return; disposed = true;
      try { stop(15); native.dispose(); } finally { merger.disconnect(); input.disconnect(); filter.disconnect(); }
    } });
}

if (typeof module === 'object' && module.exports) module.exports = createWebAudioStreamHost;
else globalThis.AMOS_WEB_AUDIO_STREAM = createWebAudioStreamHost;
