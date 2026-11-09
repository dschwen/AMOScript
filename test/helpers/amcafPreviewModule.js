'use strict';
// Distributable synthetic MOD-shaped data; no Ghostlight source or assets.
module.exports = function amcafPreviewModule() {
  const samples = Array.from({ length: 31 }, (_, i) => {
    const length = i < 2 ? 64 : 0;
    return { number: i + 1, length, loopStart: 0, loopLength: length ? 64 : 2,
      volume: i ? 20 : 32, finetune: 0,
      pcm: Int8Array.from({ length }, (_, n) => i ? (n < 32 ? 80 : -80) : Math.round((n < 32 ? n : 63 - n) * 6 - 96)) };
  });
  const pattern = Array.from({ length: 256 }, () => ({ sample: 0, period: 0, effect: 0, parameter: 0 }));
  const put = (row, voice, sample, period, effect = 0, parameter = 0) => {
    pattern[row * 4 + voice] = { sample, period, effect, parameter };
  };
  put(0, 0, 1, 428, 0, 0x37); put(0, 1, 2, 856, 4, 0x47);
  put(8, 0, 2, 0); // Repeat-sample change without any new-note trigger.
  put(12, 0, 0, 339, 3, 3); put(16, 0, 0, 428, 5, 1);
  put(16, 1, 0, 0, 6, 1); put(24, 0, 1, 508, 0, 0x47);
  put(32, 0, 1, 428, 4, 0x25); put(40, 0, 0, 0, 6, 1);
  put(48, 0, 2, 339); put(56, 0, 1, 428, 0, 0x37);
  return { songLength: 1, restart: 127, orderTable: new Uint8Array(128), patterns: [pattern], samples };
};
