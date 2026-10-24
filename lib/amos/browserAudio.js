/* jshint esversion: 6 */
'use strict';

// One optional, caller-owned game session. Construction/binding never starts
// audio; enable() must be invoked directly from a user action.
function createBrowserAudioSession(createHost, createContext = () => new AudioContext()) {
  let context = null, host = null, requested = false, enabled = false;
  let pending = false, disposed = false, activation = 0, binding = 0;
  let error = null, plays = 0, lastSample = null, closing = null;
  function silence() { if (host) host.command({ type: 'stop', mask: 15 }); }
  async function enable() {
    if (disposed) return false;
    const token = ++activation; requested = true; pending = true; error = null;
    try {
      if (context && context.state === 'closed') { host.dispose(); host = null; context = null; }
      if (!context) context = createContext();
      if (!host) host = createHost(context);
      // Called before the first await, while the caller's gesture is active.
      await context.resume();
      if (disposed || token !== activation) return false;
      if (context.state !== 'running') throw new Error('AudioContext did not enter the running state');
      enabled = true; pending = false; return true;
    } catch (failure) {
      if (!disposed && token === activation) {
        enabled = false; pending = false; error = failure.message;
        try { silence(); } catch (_) { /* retain the activation error */ }
      }
      return false;
    }
  }
  function mute() {
    if (disposed) return;
    activation++; requested = false; enabled = false; pending = false; error = null;
    silence();
  }
  function bind() {
    if (disposed) throw new Error('Audio session is disposed');
    silence(); const token = ++binding;
    return Object.freeze({ command(event) {
      if (disposed || token !== binding) return;
      if (event.type === 'stop') { if (host) host.command(event); return; }
      // Drop muted/suspended effects: never queue stale sounds for activation.
      // Each play carries the current filter/loop state from the pure controller.
      if (!enabled || !context || context.state !== 'running') return;
      host.command(event);
      if (event.type === 'play' && event.mask) { plays++; lastSample = event.sample.number; }
    } });
  }
  function status() {
    const state = disposed ? 'disposed' : !requested ? 'off' : pending ? 'starting' : error ? 'error' :
      enabled ? context.state === 'running' ? 'on' : context.state === 'closed' ? 'error' : 'suspended' : 'off';
    return { state, requested, plays, lastSample, contextState: context ? context.state : null, voices: host && !disposed ? host.activeVoices() : [],
      error: error || (context && context.state === 'closed' && !disposed ? 'AudioContext is closed' : null) };
  }
  function dispose() {
    if (disposed) return closing || Promise.resolve();
    disposed = true; activation++; binding++; requested = false; enabled = false; pending = false;
    try { if (host) host.dispose(); } finally {
      closing = context && context.state !== 'closed' ? Promise.resolve().then(() => context.close()).catch(failure => { error = failure.message; }) : Promise.resolve();
    }
    return closing;
  }
  return { enable, mute, bind, status, dispose };
}

if (typeof module === 'object' && module.exports) module.exports = { createBrowserAudioSession };
else globalThis.AMOS_BROWSER_AUDIO = { createBrowserAudioSession };
