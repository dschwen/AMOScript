/* jshint esversion: 6 */
'use strict';

// Owned virtual bank addresses, separate from display DMA and machine RAM.
function createBankMemory(banks, options = {}) {
  const allocations = new Map();
  let next = 65536;
  function allocate(capacity) {
    const base = Math.ceil(next / 16) * 16;
    if (!Number.isSafeInteger(capacity) || capacity < 0 || base > 0x7fffffff || base + capacity > 0x80000000) throw new Error('Bank address space exhausted');
    next = base + Math.max(1, capacity) + 16;
    return { base, capacity };
  }
  function liveIcons(bank, allocation) {
    return bank.images.length === allocation.images.length && bank.palette.length === 32 && allocation.images.every((record, index) =>
      record ? bank.images[index] === record.image && record.image.width === record.width && record.image.height === record.height &&
        record.image.depth === record.depth && record.image.pixels.length === record.width * record.height : !bank.images[index]);
  }
  function prune() {
    for (const [bank, allocation] of allocations) if (banks.get(bank.number) !== bank || (allocation.images && !liveIcons(bank, allocation))) allocations.delete(bank);
  }
  function iconAllocation(bank) {
    if (bank.images.length > 32768 || bank.palette.length !== 32) throw new Error('Unsupported raw icon bank shape');
    const records = bank.images.map(image => {
      if (!image) return null;
      const { width, height, depth } = image, planeSize = width / 8 * height, requested = 10 + planeSize * depth;
      if (!Number.isInteger(width) || width <= 0 || width % 16 || !Number.isInteger(height) || height <= 0 || height > 65535 ||
          !Number.isInteger(depth) || depth < 1 || depth > 6 || !Number.isSafeInteger(planeSize) || planeSize * depth >= 65536 ||
          image.pixels.length !== width * height) throw new Error('Unsupported raw icon record');
      return { image, width, height, depth, planeSize, requested };
    });
    const table = { ...allocate(2 + records.length * 8 + 64), kind: 'table', images: records };
    const regions = [table];
    for (const record of records) if (record) {
      // Exec MEM_BLOCKSIZE=8. Only the rounded, owned tail is addressable;
      // deterministic zero padding is a portable default, not a heap capture.
      Object.assign(record, allocate(Math.ceil(record.requested / 8) * 8), { kind: 'image', padding: new Uint8Array(Math.ceil(record.requested / 8) * 8 - record.requested) });
      regions.push(record);
    }
    return { ...table, regions };
  }
  function start(number) {
    prune();
    const bank = banks.get(number);
    if (!bank) throw new Error('Bank not reserved');
    if (bank.type !== 'data' && bank.type !== 'icons') throw new Error('Start of sprite image banks is not implemented');
    let allocation = allocations.get(bank);
    if (!allocation) {
      allocation = bank.type === 'icons' ? iconAllocation(bank) : allocate(bank.data.length);
      allocations.set(bank, allocation);
    }
    return allocation.base;
  }
  function resolve(address, length = 1) {
    if (!Number.isInteger(address) || address < 0 || address > 0x7fffffff) throw new Error('Bank memory address out of bounds');
    if (!Number.isSafeInteger(length) || length < 0) throw new Error('Invalid bank memory range');
    prune();
    for (const [bank, allocation] of allocations) for (const region of allocation.regions || [allocation]) {
      if (address >= region.base && address <= region.base + region.capacity) {
        const offset = address - region.base, size = region.kind ? region.capacity : bank.data.length;
        if (size > region.capacity) throw new Error('Bank memory grew outside its allocation');
        if (offset > size || length > size - offset) break;
        return { bank, region, offset };
      }
    }
    throw new Error('Bank memory address out of bounds or retired');
  }
  function readable(access, length) {
    const { region, offset } = access;
    if (region.kind === 'table') for (let at = offset; at < offset + length; at++) {
      if (at >= 2 && at < 2 + region.images.length * 8 && (at - 2) % 8 >= 4) throw new Error('Raw icon mask pointers are not implemented');
    }
  }
  function writable(access, length) {
    if (length && (access.region.kind === 'table' || (access.region.kind === 'image' && access.offset < 10))) throw new Error('Raw icon table/header writes are not implemented');
    if (length && options.beforeWrite) options.beforeWrite(access.bank);
  }
  function byteAt(access, relative) {
    const { bank, region } = access, offset = access.offset + relative;
    if (!region.kind) return bank.data[offset];
    if (region.kind === 'table') {
      if (offset < 2) return (region.images.length >>> ((1 - offset) * 8)) & 255;
      const at = offset - 2;
      if (at < region.images.length * 8) {
        const record = region.images[Math.floor(at / 8)];
        return ((record ? record.base : 0) >>> ((3 - at % 8) * 8)) & 255;
      }
      const palette = at - region.images.length * 8;
      return (bank.palette[palette >>> 1] >>> ((1 - palette % 2) * 8)) & 255;
    }
    const image = region.image;
    if (offset < 10) {
      const header = [region.width / 16, region.height, region.depth, (image.hotspotX & 0x3fff) | image.orientation, image.hotspotY];
      return (header[offset >>> 1] >>> ((1 - offset % 2) * 8)) & 255;
    }
    if (offset >= region.requested) return region.padding[offset - region.requested];
    const at = offset - 10, plane = Math.floor(at / region.planeSize), first = (at % region.planeSize) * 8;
    let value = 0;
    for (let bit = 0; bit < 8; bit++) if (image.pixels[first + bit] & (1 << plane)) value |= 128 >>> bit;
    return value;
  }
  function putByte(access, relative, value) {
    const { bank, region } = access, offset = access.offset + relative;
    if (!region.kind) { bank.data[offset] = value & 255; return; }
    if (offset >= region.requested) { region.padding[offset - region.requested] = value & 255; return; }
    const at = offset - 10, plane = Math.floor(at / region.planeSize), first = (at % region.planeSize) * 8, mask = 1 << plane;
    for (let bit = 0; bit < 8; bit++) region.image.pixels[first + bit] = (region.image.pixels[first + bit] & ~mask) | ((value & (128 >>> bit)) ? mask : 0);
    // Native raw writes do not regenerate the separately owned image mask.
  }
  function readNumber(address, length) {
    const access = resolve(address, length); readable(access, length);
    let value = 0;
    for (let index = 0; index < length; index++) value = (value << 8) | byteAt(access, index);
    return value;
  }
  function writeNumber(address, value, length) {
    const access = resolve(address, length); writable(access, length);
    for (let index = 0; index < length; index++) putByte(access, index, value >>> ((length - index - 1) * 8));
  }
  return { start, locate: (address, length = 0) => resolve(address, length),
    deek: address => readNumber(address, 2),
    leek: address => readNumber(address, 4),
    doke: (address, value) => writeNumber(address, value, 2),
    loke: (address, value) => writeNumber(address, value, 4),
    address(value) {
      const address = value < 1024 ? start(value) : value;
      resolve(address, 0); return address;
    },
    checkRange(address, length) { resolve(address, length); },
    read(address, length) {
      const access = resolve(address, length); readable(access, length);
      if (!access.region.kind) return access.bank.data.slice(access.offset, access.offset + length);
      return Uint8Array.from({ length }, (_, index) => byteAt(access, index));
    },
    write(address, bytes) {
      const access = resolve(address, bytes.length); writable(access, bytes.length);
      if (!access.region.kind) { access.bank.data.set(bytes, access.offset); return; }
      for (let index = 0; index < bytes.length; index++) putByte(access, index, bytes[index]);
    },
    fill(address, end, pattern) {
      const length = end - address;
      if (!Number.isSafeInteger(length) || length < 0) throw new Error('Invalid Fill range (end precedes start)');
      // Native Fill uses a word-counted DBRA loop for its 16-byte blocks.
      // Larger wrapped-count forms require their own contract.
      if (length > 1048576) throw new Error('Unsupported Fill range above 1 MiB');
      if (length >= 16 && address % 2) throw new Error('Odd Fill block addresses are not implemented');
      const access = resolve(address, length); writable(access, length);
      for (let index = 0; index < length; index++) putByte(access, index, pattern >>> (24 - (index & 3) * 8));
    },
    copy(address, end, destination) {
      const length = end - address;
      if (!Number.isSafeInteger(length) || length <= 0) throw new Error('Invalid Copy range (end must follow start)');
      const source = resolve(address, length), target = resolve(destination, length);
      readable(source, length); writable(target, length);
      if (!source.region.kind && !target.region.kind) {
        // TypedArray#set snapshots overlapping sources, including either direction.
        target.bank.data.set(source.bank.data.subarray(source.offset, source.offset + length), target.offset);
      } else {
        const bytes = Uint8Array.from({ length }, (_, index) => byteAt(source, index));
        for (let index = 0; index < length; index++) putByte(target, index, bytes[index]);
      }
    },
    peek: address => readNumber(address, 1),
    poke: (address, value) => writeNumber(address, value, 1),
    release(bank) { allocations.delete(bank); } };
}

if (typeof module === 'object' && module.exports) module.exports = createBankMemory;
else globalThis.AMOS_BANK_MEMORY = createBankMemory;
