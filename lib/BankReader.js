/* jshint esversion: 6 */
'use strict';

// On-disc bank layout: original +Lib.s Bnk.Load and manual Appendix E.
class BankReader {
  constructor(buffer, offset = 20 + buffer.code_bytes) {
    this.data = buffer.buffer;
    this.ip = offset;
    this.context = 'AMOS banks';
  }

  error(message) { throw new Error(`${message} in ${this.context} at byte ${this.ip}`); }
  require(length) {
    if (!Number.isSafeInteger(length) || length < 0 || this.ip + length > this.data.length) this.error(`Truncated bank data (need ${length} bytes)`);
  }
  word() {
    this.require(2);
    const result = this.data[this.ip] * 256 + this.data[this.ip + 1];
    this.ip += 2;
    return result;
  }
  long() { return this.word() * 65536 + this.word(); }
  bytes(length) {
    this.require(length);
    const result = this.data.subarray(this.ip, this.ip + length);
    this.ip += length;
    return result;
  }
  text(length) { return Array.from(this.bytes(length), byte => String.fromCharCode(byte)).join(''); }

  imageBank(type) {
    const number = type === 'AmSp' ? 1 : 2;
    this.context = `bank ${number} (${type})`;
    const count = this.word();
    this.require(count * 10 + 64);
    const images = [];
    for (let i = 0; i < count; i++) {
      this.context = `bank ${number}, image ${i + 1}`;
      const words = this.word(), height = this.word(), depth = this.word();
      const x = this.word() & 0x3fff, y = this.word();
      if (!words || !height || !depth) {
        if (words || height || depth || x || y) this.error('Invalid empty image header');
        images.push(null);
        continue;
      }
      if (depth > 6) this.error(`Unsupported image depth ${depth}`);
      const width = words * 16;
      const planeSize = words * 2 * height;
      const planar = this.bytes(planeSize * depth);
      const pixels = new Uint8Array(width * height);
      for (let plane = 0; plane < depth; plane++) {
        for (let pixel = 0; pixel < pixels.length; pixel++) {
          if (planar[plane * planeSize + (pixel >>> 3)] & (128 >>> (pixel & 7))) pixels[pixel] |= 1 << plane;
        }
      }
      images.push({ width, height, depth, hotspotX: x & 0x2000 ? x - 0x4000 : x, hotspotY: y & 0x8000 ? y - 0x10000 : y, pixels: Array.from(pixels) });
    }
    this.context = `bank ${number} palette`;
    const palette = Array.from({ length: 32 }, () => this.word());
    if (palette.some(rgb => rgb > 0xfff)) this.error('Unsupported palette colour');
    return { number, type: number === 1 ? 'sprites' : 'icons', images, palette };
  }

  dataBank() {
    const number = this.word() || 5;
    this.context = `bank ${number} (AmBk)`;
    const memory = this.word();
    if (memory > 1) this.error('Unsupported bank memory flag');
    const encodedLength = this.long();
    const length = encodedLength & 0x0fffffff;
    if (length < 8) this.error('Invalid bank length');
    this.require(length);
    const name = this.text(8);
    return { number, type: 'data', memory: memory === 0 ? 'chip' : 'fast', permanent: !!(encodedLength & 0x80000000), name, data: Array.from(this.bytes(length - 8)) };
  }

  entry() {
    const type = this.text(4);
    return type === 'AmBk' ? this.dataBank() : ['AmSp', 'AmIc'].includes(type) ? this.imageBank(type) : this.error(`Unsupported bank type ${JSON.stringify(type)}`);
  }

  static readFile(data) {
    const reader = new BankReader({ buffer: data }, 0);
    reader.require(4);
    const grouped = String.fromCharCode(...data.subarray(0, 4)) === 'AmBs';
    const banks = grouped ? reader.read() : [reader.entry()];
    if (reader.ip !== data.length) reader.error('Unexpected data after bank file');
    return { banks, grouped };
  }

  read() {
    if (this.ip === this.data.length) return []; // Code-only compiler fixtures.
    if (this.text(4) !== 'AmBs') this.error('Expected AmBs bank trailer');
    const count = this.word();
    const banks = [];
    const numbers = new Set();
    for (let i = 0; i < count; i++) {
      this.context = `bank entry ${i + 1}`;
      const bank = this.entry();
      if (numbers.has(bank.number)) this.error(`Duplicate bank number ${bank.number}`);
      numbers.add(bank.number);
      banks.push(bank);
    }
    if (this.ip !== this.data.length) this.error('Unexpected data after bank trailer');
    return banks;
  }
}

if (typeof module === 'object' && module.exports) module.exports = BankReader;
else globalThis.AMOS_BANK_READER = BankReader;
