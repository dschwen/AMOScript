/* jshint esversion: 6 */
'use strict';

// CPU-owned bytes. Each consumer retains its own revision; queries never clear
// another renderer's dirty rows. Exposed byte writes require markDirty().
class ChipMemory {
  constructor(size = 2097152, historyLimit = 128) {
    if (![524288, 1048576, 2097152].includes(size)) throw new Error('Invalid chip memory size');
    if (!Number.isInteger(historyLimit) || historyLimit < 1 || historyLimit > 4096) throw new Error('Invalid chip dirty history limit');
    this.bytes = new Uint8Array(size);
    this.revision = 0;
    this.historyLimit = historyLimit;
    this.history = [];
    this.allocations = new Set();
    this.freeRanges = [{ address: 0, length: size }];
  }
  check(address, length) {
    if (!Number.isSafeInteger(address) || !Number.isSafeInteger(length) || address < 0 || length < 0 ||
        address > this.bytes.length - length) throw new Error('Chip memory access out of bounds');
  }
  readWord(address) {
    this.check(address, 2);
    if (address % 2) throw new Error('Unaligned chip word address');
    return this.bytes[address] * 256 + this.bytes[address + 1];
  }
  writeWord(address, value) {
    this.check(address, 2);
    if (address % 2) throw new Error('Unaligned chip word address');
    if (!Number.isInteger(value) || value < 0 || value > 65535) throw new Error('Invalid chip word');
    this.writeBytes(address, Uint8Array.of(value >> 8, value & 255));
  }
  readBytes(address, length) { this.check(address, length); return this.bytes.slice(address, address + length); }
  writeBytes(address, bytes) {
    if (!ArrayBuffer.isView(bytes) || Object.prototype.toString.call(bytes) !== '[object Uint8Array]') throw new Error('Chip write requires bytes');
    this.check(address, bytes.length);
    let first = -1, last = 0;
    for (let i = 0; i < bytes.length; i++) if (this.bytes[address + i] !== bytes[i]) {
      if (first === -1) first = i;
      last = i;
    }
    if (first === -1) return;
    if (this.revision === Number.MAX_SAFE_INTEGER) throw new Error('Chip revision exhausted');
    this.bytes.set(bytes, address);
    this.markDirty(address + first, last - first + 1);
  }
  markDirty(address, length) {
    this.check(address, length);
    if (!length) return;
    if (this.revision === Number.MAX_SAFE_INTEGER) throw new Error('Chip revision exhausted');
    this.revision++;
    this.history.push({ revision: this.revision, start: Math.floor(address / 2048), end: Math.ceil((address + length) / 2048) });
    if (this.history.length > this.historyLimit) this.history.shift();
  }
  dirtySince(revision) {
    if (!Number.isSafeInteger(revision) || revision < -1 || revision > this.revision) throw new Error('Invalid chip upload revision');
    const oldest = this.history.length ? this.history[0].revision - 1 : this.revision;
    const full = revision === -1 || revision < oldest;
    if (full) return { revision: this.revision, full: true, rows: [[0, this.bytes.length / 2048]] };
    const ranges = this.history.filter(entry => entry.revision > revision).map(entry => [entry.start, entry.end]).sort((a, b) => a[0] - b[0]);
    const rows = [];
    for (const range of ranges) {
      const previous = rows[rows.length - 1];
      if (previous && previous[1] >= range[0]) previous[1] = Math.max(previous[1], range[1]);
      else rows.push(range);
    }
    return { revision: this.revision, full: false, rows };
  }
  allocate(length, alignment = 2) {
    if (!Number.isSafeInteger(length) || length < 1 || !Number.isInteger(alignment) || alignment < 1 ||
        alignment > 2048 || (alignment & (alignment - 1))) throw new Error('Invalid chip allocation');
    for (let i = 0; i < this.freeRanges.length; i++) {
      const range = this.freeRanges[i];
      const address = Math.ceil(range.address / alignment) * alignment;
      const end = address + length, rangeEnd = range.address + range.length;
      if (end > rangeEnd) continue;
      const replacements = [];
      if (address > range.address) replacements.push({ address: range.address, length: address - range.address });
      if (end < rangeEnd) replacements.push({ address: end, length: rangeEnd - end });
      this.freeRanges.splice(i, 1, ...replacements);
      const allocation = Object.freeze({ address, length });
      this.allocations.add(allocation);
      return allocation;
    }
    throw new Error('Chip memory exhausted');
  }
  free(allocation) {
    if (!this.allocations.has(allocation)) throw new Error('Invalid chip allocation handle');
    this.writeBytes(allocation.address, new Uint8Array(allocation.length));
    this.allocations.delete(allocation);
    this.freeRanges.push({ address: allocation.address, length: allocation.length });
    this.freeRanges.sort((a, b) => a.address - b.address);
    this.freeRanges = this.freeRanges.reduce((ranges, range) => {
      const last = ranges[ranges.length - 1];
      if (last && last.address + last.length === range.address) last.length += range.length;
      else ranges.push({ ...range });
      return ranges;
    }, []);
  }
  snapshot() { return this.bytes.slice(); }
}

module.exports = ChipMemory;
