/* jshint esversion: 6 */
'use strict';

// Bounded AMOS sample-bank reader and four-voice commands. No browser APIs.
function createAudio(banks, options = {}) {
  const standard = options.standard || 'PAL';
  if (!['PAL', 'NTSC'].includes(standard)) throw new Error('Unsupported audio standard');
  const clock = standard === 'PAL' ? 3546895 : 3579545;
  const state = { bank: 5, loopMask: 0, filterEnabled: true };
  let activeMask = 0;
  let trackerMask = 0;
  function notify(event) {
    if (options.host == null) return;
    if (typeof options.host.command !== 'function') throw new Error('Audio host requires a synchronous command method');
    const result = options.host.command(event);
    if (result && typeof result.then === 'function') throw new Error('Audio host commands must complete synchronously');
  }
  function command(event, origin = 'tracker') {
    if (event.type === 'play') {
      const mask = event.mask & 15;
      activeMask |= mask;
      trackerMask = (trackerMask & ~mask) | (origin === 'tracker' ? mask : 0);
    }
    try { notify(event); }
    finally { if (event.type === 'stop') { activeMask &= ~(event.mask & 15); trackerMask &= ~(event.mask & 15); } }
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
    notify({ type: 'loop', mask: mask & ~trackerMask, enabled });
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
    silence() { if (activeMask) stop(15); } };
}

if (typeof module === 'object' && module.exports) module.exports = createAudio;
else globalThis.AMOS_AUDIO = createAudio;
