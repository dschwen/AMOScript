/* jshint esversion: 6 */
'use strict';

function createSpriteDmaFactory(registerModel) {
  const { R } = registerModel;
  return function createSpriteDma(chip, registers, options, fail, event, bitplaneBusy) {
    const channels = Array.from({ length: 8 }, () => ({ armed: false, fetching: false, second: null }));
    const resetLine = options.standard === 'NTSC' ? 20 : 25;
    const maxWords = options.maxSpriteWords == null ? 16384 : options.maxSpriteWords;
    if (!Number.isInteger(maxWords) || maxWords < 0 || maxWords > 16384) fail('invalid sprite word budget');
    let words = 0;
    const get = reg => registers[reg / 2];
    const enabled = () => (get(R.DMACON) & 0x220) === 0x220;
    const handles = reg => reg >= R.SPR0PTH && reg < R.SPR0PTH + 32 || reg >= R.SPR0POS && reg < R.SPR0POS + 64;
    function vertical(channel) {
      const pos = get(R.SPR0POS + channel * 8), ctl = get(R.SPR0CTL + channel * 8);
      return { start: (pos >> 8) | ((ctl & 4) << 6), stop: (ctl >> 8) | ((ctl & 2) << 7) };
    }
    function compare(channel, line) {
      const bounds = vertical(channel), state = channels[channel];
      if (line === bounds.start) state.fetching = true;
      if (line === bounds.stop || line === resetLine) state.fetching = false;
    }
    function write(reg, value, line) {
      registers[reg / 2] = value;
      if (reg >= R.SPR0POS && reg < R.SPR0POS + 64) {
        const channel = Math.floor((reg - R.SPR0POS) / 8), slot = (reg - R.SPR0POS) % 8;
        if (slot === 2) channels[channel].armed = false;
        if (slot === 4) channels[channel].armed = true;
        if (slot === 0 || slot === 2) compare(channel, line);
      }
    }
    function fetch(channel, target, line) {
      if (bitplaneBusy()) fail(`sprite ${channel} and bitplane DMA contention is not implemented`);
      const reg = R.SPR0PTH + channel * 4, address = get(reg) * 65536 + (get(reg + 2) & 0xfffe);
      if (address > chip.length - 2) fail(`sprite ${channel} fetch out of bounds at address ${address}`);
      if (++words > maxWords) fail('sprite word budget exceeded');
      const value = chip[address] * 256 + chip[address + 1], next = address + 2;
      registers[reg / 2] = next >>> 16; registers[(reg + 2) / 2] = next & 65535;
      event(target, value);
      write(target, value, line);
    }
    function tick(line, horizontal) {
      // Two OCS word slots per channel, before the normal bitplane fetch.
      const position = horizontal - 0x15;
      if (position < 0 || position >= 32 || (position & 1)) return;
      const channel = Math.floor(position / 4), second = !!(position & 2), state = channels[channel];
      if (!second) {
        state.second = null;
        if (line < resetLine) return;
        compare(channel, line);
        const control = line === resetLine || line === vertical(channel).stop;
        if (!enabled() || (!control && !state.fetching)) return;
        const target = R.SPR0POS + channel * 8 + (control ? 0 : 4);
        state.second = target + 2;
        fetch(channel, target, line);
      } else if (state.second != null) {
        const target = state.second; state.second = null;
        if (enabled()) fetch(channel, target, line);
      }
    }
    function capture(frame, outputLine) {
      const row = outputLine * 32;
      for (let channel = 0; channel < 8; channel++) {
        const at = row + channel * 4, reg = R.SPR0POS + channel * 8, ctl = get(reg + 2);
        const start = ((get(reg) & 255) << 1) | (ctl & 1);
        frame.lineSprites[at] = ((start - frame.origin.x) * frame.samplesPerLowresPixel) >>> 0;
        frame.lineSprites[at + 1] = get(reg + 4); frame.lineSprites[at + 2] = get(reg + 6);
        frame.lineSprites[at + 3] = (channels[channel].armed ? 0x80000000 : 0) | (channel & 1 && ctl & 128 ? 1 : 0);
      }
    }
    return { handles, write, tick, capture, get words() { return words; } };
  };
}

module.exports = createSpriteDmaFactory(require('../model/registers'));
module.exports.createSpriteDmaFactory = createSpriteDmaFactory;
