/* jshint esversion: 6 */
'use strict';

// Field history is an explicit input, never hidden state in either renderer.
function createFieldComposer(snapshotModel) {
  return function composeField(frame, rgba, previous = null, mode = 'weave') {
    snapshotModel.validateDimensions(frame);
    const stride = frame.outputWidth * 4, length = stride * frame.outputHeight;
    const bytes = value => ArrayBuffer.isView(value) &&
      ['[object Uint8Array]', '[object Uint8ClampedArray]'].includes(Object.prototype.toString.call(value));
    if (!bytes(rgba) || rgba.length !== stride * frame.lines) throw new Error('Field composition requires exact current-field RGBA bytes');
    if (previous != null && (!bytes(previous) || previous.length !== length)) throw new Error('Field composition requires matching previous output dimensions');
    if (!['weave', 'line-double'].includes(mode)) throw new Error('Unsupported field composition mode');
    if (frame.interlaceField == null) return Uint8ClampedArray.from(rgba);
    const result = previous == null ? new Uint8ClampedArray(length) : Uint8ClampedArray.from(previous);
    if (previous == null) for (let i = 3; i < length; i += 4) result[i] = 255;
    if (mode === 'line-double' && frame.lines) {
      for (let y = 0; y < frame.outputHeight; y++) {
        const row = Math.min(frame.lines - 1, Math.floor(y / 2));
        result.set(rgba.subarray(row * stride, (row + 1) * stride), y * stride);
      }
    } else for (let y = 0; y < frame.lines; y++) {
      result.set(rgba.subarray(y * stride, (y + 1) * stride), (y * 2 + frame.interlaceField) * stride);
    }
    return result;
  };
}

module.exports = createFieldComposer(require('../model/frameState'));
module.exports.createFieldComposer = createFieldComposer;
