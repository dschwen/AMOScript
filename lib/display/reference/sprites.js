/* jshint esversion: 6 */
'use strict';

function createSpriteModel() {
  function validate(frame, line) {
    let active = false;
    for (let channel = 0; channel < 8; channel++) {
      const at = line * 32 + channel * 4, flags = frame.lineSprites[at + 3];
      if ((flags & 0x7ffffffe) || ((flags & 1) && !(channel & 1))) {
        throw new Error(`Display reference: unsupported sprite flags on line ${line}, channel ${channel}`);
      }
      if (frame.lineSprites[at + 1] > 65535 || frame.lineSprites[at + 2] > 65535) {
        throw new Error(`Display reference: unsupported sprite data width on line ${line}, channel ${channel}`);
      }
      active = active || !!(flags & 0x80000000);
    }
    const priority = frame.lineRegs[line * 32 + 10];
    if (active && ((priority & 7) > 4 || ((priority >> 3) & 7) > 4)) {
      throw new Error(`Display reference: unsupported sprite/playfield priority on line ${line}`);
    }
    return active;
  }
  function sample(frame, line, x, rawIndex) {
    const row = line * 32;
    const samples = frame.samplesPerLowresPixel, data = frame.lineSprites;
    function pixel(channel) {
      const at = row + channel * 4;
      if (!(data[at + 3] & 0x80000000)) return 0;
      const sourceX = Math.floor((x - (data[at] | 0)) / samples);
      if (sourceX < 0 || sourceX >= 16) return 0;
      const bit = 15 - sourceX;
      return ((data[at + 1] >> bit) & 1) | (((data[at + 2] >> bit) & 1) << 1);
    }
    // Select the first nontransparent hardware pair before applying playfield
    // masks. A blocked sprite must not expose a lower-priority sprite.
    for (let pair = 0; pair < 4; pair++) {
      const even = pair * 2, a = pixel(even), b = pixel(even + 1);
      const attached = !!(data[row + (even + 1) * 4 + 3] & 1);
      const value = attached ? a | (b << 2) : a || b;
      if (!value) continue;
      const control = frame.lineRegs[row + 8], priority = frame.lineRegs[row + 10];
      const blockers = [];
      if (control & 0x400) {
        if ((rawIndex & 0x15) && pair >= (priority & 7)) blockers.push(1);
        if ((rawIndex & 0x2a) && pair >= ((priority >> 3) & 7)) blockers.push(2);
      } else if (rawIndex && pair >= ((priority >> 3) & 7)) blockers.push(2);
      return { channel: attached || a ? even : even + 1, pair, attached, value,
        paletteIndex: 16 + (attached ? value : pair * 4 + value),
        visible: blockers.length === 0, blockedBy: blockers };
    }
    return null;
  }
  return Object.freeze({ validate, sample });
}

if (typeof module === 'object' && module.exports) module.exports = Object.assign({ createSpriteModel }, createSpriteModel());
else globalThis.AMOS_SPRITE_MODEL = createSpriteModel();
