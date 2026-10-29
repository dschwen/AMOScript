'use strict';
// Declared portable test atlas, not the missing Fastballfont/9 artwork.
function diskFontFixture() {
  const data = new Uint8Array(256 * 9 * 2);
  for (let code = 0; code < 256; code++) for (let y = 0; y < 9; y++) for (let x = 0; x < 10; x++) {
    if (code === 65 && (x === 0 || x === 9 || y === 4) || code === 63 && (x === y || x === 9 - y)) data[(code * 9 + y) * 2 + (x >> 3)] |= 0x80 >> (x & 7);
  }
  return { name: 'Prepared test font', width: 10, height: 9, baseline: 6, data };
}
module.exports = diskFontFixture;
