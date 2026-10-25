/* jshint esversion: 6 */
'use strict';

// Independent source-derived oracle for this pinned tune, reading its literal
// order/cell/header bytes. No production MOD reader or tracker calls.
module.exports = function roller2NoteAudit(bytes) {
  const instruments = [0, 0, 0, 0], volumes = [0, 0, 0, 0];
  const notes = [], byChannel = [0, 0, 0, 0], bySample = Array(10).fill(0);
  let field = 6, speed = 6, rows = 0;
  for (let order = 0; order < bytes[950]; order++) {
    let patternBreak = false;
    for (let row = 0; row < 64 && !patternBreak; row++) {
      const cells = [];
      for (let channel = 0; channel < 4; channel++) {
        const at = 1084 + bytes[952 + order] * 1024 + row * 16 + channel * 4;
        const instrument = (bytes[at] & 240) | (bytes[at + 2] >> 4);
        const period = (bytes[at] & 15) * 256 + bytes[at + 1];
        const effect = bytes[at + 2] & 15, parameter = bytes[at + 3];
        cells.push({ effect, parameter });
        if (instrument) { instruments[channel] = instrument; volumes[channel] = bytes[45 + (instrument - 1) * 30]; }
        if (effect === 12) volumes[channel] = Math.min(64, parameter);
        if (period) {
          notes.push([field, channel, instruments[channel], period, volumes[channel]]);
          byChannel[channel]++; bySample[instruments[channel] - 1]++;
        }
        if (effect === 15) speed = Math.max(1, Math.min(31, parameter));
        if (effect === 13) patternBreak = true;
      }
      // Slides affect held volumes before the next row's optional assignments.
      for (let tick = 1; tick < speed; tick++) for (let channel = 0; channel < 4; channel++) {
        const c = cells[channel];
        if (c.effect === 10) volumes[channel] = Math.max(0, Math.min(64,
          volumes[channel] + (c.parameter >> 4 || -(c.parameter & 15))));
      }
      field += speed; rows++;
    }
  }
  return { notes, byChannel, bySample, rows };
};
