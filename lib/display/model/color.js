/* jshint esversion: 6 */
'use strict';

function createColorModel() {
  function hamWord(code, previous, paletteColour) {
    const operation = (code >> 4) & 3, value = code & 15;
    if (operation === 0) return paletteColour & 0xfff;
    if (operation === 1) return (previous & 0xff0) | value;
    if (operation === 2) return (previous & 0x0ff) | (value << 8);
    return (previous & 0xf0f) | (value << 4);
  }
  function halfbriteWord(word) { return (word >> 1) & 0x777; }
  function rgbaWord(word) { return [((word >> 8) & 15) * 17, ((word >> 4) & 15) * 17, (word & 15) * 17, 255]; }
  return Object.freeze({ hamWord, halfbriteWord, rgbaWord });
}

if (typeof module === 'object' && module.exports) module.exports = Object.assign({ createColorModel }, createColorModel());
else globalThis.AMOS_COLOR_MODEL = createColorModel();
