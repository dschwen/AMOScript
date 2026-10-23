/* jshint esversion: 6 */
'use strict';

function createFrameStateModel() {
  // ABI v1: see docs/display-snapshots.md. No DOM, filesystem or Node dependencies.
  const VERSION = 1;
  const metadataKeys = ['schemaVersion', 'revision', 'chipset', 'samplesPerLowresPixel',
    'outputWidth', 'outputHeight', 'lines', 'interlaceField', 'maxEvents',
    'videoRate', 'pixelAspect', 'origin'];
  const tableTypes = { lineRegs: Uint32Array, linePal: Uint8Array, lineSprites: Uint32Array,
    lineEvents: Uint32Array, eventOffsets: Uint32Array, overflowEvents: Uint32Array };
  const MAX_OVERFLOW_EVENTS = 65536;

  function fail(message) { throw new Error(`Display snapshot: ${message}`); }
  function isTypedArray(value, Type) {
    return ArrayBuffer.isView(value) && Object.prototype.toString.call(value) === `[object ${Type.name}]`;
  }
  function integer(value, min, max, name) {
    if (!Number.isSafeInteger(value) || value < min || value > max) fail(`invalid ${name}`);
  }
  function keys(object, expected, name) {
    if (!object || typeof object !== 'object' || Array.isArray(object) ||
        Object.keys(object).length !== expected.length || expected.some(key => !Object.prototype.hasOwnProperty.call(object, key))) {
      fail(`invalid ${name} fields`);
    }
  }
  function rational(value, name) {
    keys(value, ['numerator', 'denominator'], name);
    integer(value.numerator, 1, 1000000, `${name} numerator`);
    integer(value.denominator, 1, 1000000, `${name} denominator`);
  }
  function validateDimensions(frame) {
    integer(frame.outputWidth, 1, 4096, 'output width');
    integer(frame.outputHeight, 1, 4096, 'output height');
    integer(frame.lines, 0, 2048, 'field lines');
    if (![null, 0, 1].includes(frame.interlaceField)) fail('invalid field parity');
    const expected = frame.interlaceField == null ? frame.outputHeight : Math.ceil((frame.outputHeight - frame.interlaceField) / 2);
    if (frame.lines !== expected) fail('inconsistent field dimensions');
  }
  function validateMetadata(frame) {
    if (frame.schemaVersion !== VERSION) fail(`unsupported schema version ${frame.schemaVersion}`);
    integer(frame.revision, 0, Number.MAX_SAFE_INTEGER, 'revision');
    if (!['OCS', 'ECS', 'AGA'].includes(frame.chipset)) fail('invalid chipset');
    if ((frame.chipset === 'OCS' && frame.samplesPerLowresPixel !== 2) ||
        (frame.chipset === 'AGA' && frame.samplesPerLowresPixel !== 4) ||
        ![2, 4].includes(frame.samplesPerLowresPixel)) fail('invalid native sampling grid');
    validateDimensions(frame);
    integer(frame.maxEvents, 1, 256, 'event capacity');
    rational(frame.videoRate, 'video rate');
    rational(frame.pixelAspect, 'pixel aspect');
    keys(frame.origin, ['x', 'y'], 'origin');
    integer(frame.origin.x, -2147483648, 2147483647, 'origin x');
    integer(frame.origin.y, -2147483648, 2147483647, 'origin y');
  }
  function tableLengths(frame, overflowLength) {
    return { lineRegs: frame.lines * 32, linePal: frame.lines * 1024,
      lineSprites: frame.lines * 32, lineEvents: frame.lines * frame.maxEvents * 4,
      eventOffsets: frame.lines + 1, overflowEvents: overflowLength };
  }
  function validateEvents(events, start, count) {
    let previous = -2147483648;
    for (let i = start; i < start + count * 4; i += 4) {
      const x = events[i] | 0;
      if (x < previous) fail('events are not ordered');
      previous = x;
      if (events[i + 1] > 0x1fe || events[i + 1] % 2 || events[i + 2] > 0xffff || events[i + 3] !== 0) fail('invalid register event');
    }
  }
  function validateSnapshot(snapshot) {
    keys(snapshot, ['chip', 'frame'], 'snapshot');
    const { chip, frame } = snapshot;
    if (!isTypedArray(chip, Uint8Array) || ![524288, 1048576, 2097152].includes(chip.length)) fail('invalid chip memory size');
    keys(frame, metadataKeys.concat(Object.keys(tableTypes)), 'frame');
    validateMetadata(frame);
    if (!isTypedArray(frame.overflowEvents, Uint32Array) || frame.overflowEvents.length % 4 ||
        frame.overflowEvents.length > MAX_OVERFLOW_EVENTS * 4) fail('invalid overflow event storage');
    const lengths = tableLengths(frame, frame.overflowEvents.length);
    for (const [name, Type] of Object.entries(tableTypes)) {
      if (!isTypedArray(frame[name], Type) || frame[name].length !== lengths[name]) fail(`invalid ${name} table`);
    }
    if (frame.eventOffsets[0] !== 0 || frame.eventOffsets[frame.lines] * 4 !== frame.overflowEvents.length) fail('invalid overflow offsets');
    for (let line = 0; line < frame.lines; line++) {
      const row = line * 32;
      for (let plane = 0; plane < 8; plane++) {
        const pointer = frame.lineRegs[row + plane];
        if (pointer % 2 || pointer > chip.length - 2) fail(`invalid plane pointer on line ${line}`);
      }
      for (let col = 8; col <= 12; col++) if (frame.lineRegs[row + col] > 65535) fail('invalid register word');
      if (frame.lineRegs[row + 16] > 7) fail('invalid DMA flags');
      for (let col = 18; col < 32; col++) if (frame.lineRegs[row + col] !== 0) fail('nonzero reserved register');
      const count = frame.lineRegs[row + 17];
      const start = frame.eventOffsets[line], end = frame.eventOffsets[line + 1];
      if (end < start || end * 4 > frame.overflowEvents.length ||
          end - start !== (count > frame.maxEvents ? count : 0)) fail('inconsistent overflow event count');
      const fastStart = line * frame.maxEvents * 4;
      validateEvents(frame.lineEvents, fastStart, Math.min(count, frame.maxEvents));
      if (count > frame.maxEvents) {
        validateEvents(frame.overflowEvents, start * 4, count);
        for (let i = 0; i < frame.maxEvents * 4; i++) {
          if (frame.lineEvents[fastStart + i] !== frame.overflowEvents[start * 4 + i]) fail('overflow prefix differs from fast events');
        }
      }
    }
    return snapshot;
  }

  function copyMetadata(frame) {
    const result = {};
    for (const key of metadataKeys) result[key] = typeof frame[key] === 'object' && frame[key] !== null ? { ...frame[key] } : frame[key];
    return result;
  }
  function createSnapshot(input) {
    validateSnapshot(input);
    const frame = copyMetadata(input.frame);
    for (const [name, Type] of Object.entries(tableTypes)) frame[name] = Type.from(input.frame[name]);
    Object.freeze(frame.videoRate); Object.freeze(frame.pixelAspect); Object.freeze(frame.origin);
    // Typed arrays cannot be frozen. These owned copies are read-only by contract;
    // producers must publish a new snapshot rather than mutate a published one.
    return Object.freeze({ chip: Uint8Array.from(input.chip), frame: Object.freeze(frame) });
  }

  function serializeSnapshot(input) {
    validateSnapshot(input);
    const tables = {};
    let offset = 0;
    for (const [name, Type] of Object.entries(tableTypes)) {
      const length = input.frame[name].length;
      tables[name] = { type: Type === Uint32Array ? 'u32be' : 'u8', offset, length,
        stride: name === 'lineRegs' || name === 'lineSprites' ? 32 : name === 'linePal' ? 1024 :
          name === 'lineEvents' ? input.frame.maxEvents * 4 : name === 'overflowEvents' ? 4 : 1 };
      offset += length * Type.BYTES_PER_ELEMENT;
    }
    const bytes = new Uint8Array(offset), view = new DataView(bytes.buffer);
    for (const [name, Type] of Object.entries(tableTypes)) {
      const start = tables[name].offset, source = input.frame[name];
      if (Type === Uint8Array) bytes.set(source, start);
      else for (let i = 0; i < source.length; i++) view.setUint32(start + i * 4, source[i], false);
    }
    return { header: { format: 'amos-display', schemaVersion: VERSION, frame: copyMetadata(input.frame),
      chipByteLength: input.chip.length, tablesByteLength: bytes.length, tables },
    chip: Uint8Array.from(input.chip), tables: bytes };
  }

  function deserializeSnapshot(header, chip, bytes) {
    keys(header, ['format', 'schemaVersion', 'frame', 'chipByteLength', 'tablesByteLength', 'tables'], 'header');
    if (header.format !== 'amos-display' || header.schemaVersion !== VERSION) fail('unsupported snapshot format/version');
    keys(header.frame, metadataKeys, 'frame metadata');
    validateMetadata(header.frame);
    if (!isTypedArray(chip, Uint8Array) || chip.length !== header.chipByteLength ||
        ![524288, 1048576, 2097152].includes(chip.length)) fail('truncated/invalid chip blob');
    if (!isTypedArray(bytes, Uint8Array) || bytes.length !== header.tablesByteLength) fail('truncated table blob');
    keys(header.tables, Object.keys(tableTypes), 'table descriptors');
    const overflow = header.tables.overflowEvents;
    keys(overflow, ['type', 'offset', 'length', 'stride'], 'overflowEvents descriptor');
    integer(overflow.length, 0, MAX_OVERFLOW_EVENTS * 4, 'overflow length');
    const lengths = tableLengths(header.frame, overflow.length), frame = copyMetadata(header.frame);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 0;
    for (const [name, Type] of Object.entries(tableTypes)) {
      const descriptor = header.tables[name];
      keys(descriptor, ['type', 'offset', 'length', 'stride'], `${name} descriptor`);
      const stride = name === 'lineRegs' || name === 'lineSprites' ? 32 : name === 'linePal' ? 1024 :
        name === 'lineEvents' ? frame.maxEvents * 4 : name === 'overflowEvents' ? 4 : 1;
      if (descriptor.type !== (Type === Uint32Array ? 'u32be' : 'u8') || descriptor.offset !== offset ||
          descriptor.length !== lengths[name] || descriptor.stride !== stride) fail(`invalid ${name} descriptor`);
      const length = descriptor.length, size = length * Type.BYTES_PER_ELEMENT;
      if (offset + size > bytes.length) fail(`truncated ${name}`);
      const data = new Type(length);
      if (Type === Uint8Array) data.set(bytes.subarray(offset, offset + size));
      else for (let i = 0; i < length; i++) data[i] = view.getUint32(offset + i * 4, false);
      frame[name] = data;
      offset += size;
    }
    if (offset !== bytes.length) fail('trailing table bytes');
    return createSnapshot({ chip, frame });
  }

  return { VERSION, createSnapshot, validateSnapshot, validateDimensions, serializeSnapshot, deserializeSnapshot };
}

module.exports = Object.assign({ createFrameStateModel }, createFrameStateModel());
