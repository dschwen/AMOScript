/* jshint esversion: 6 */
'use strict';

// Portable byte addresses into owned generic-bank payloads. These are not Amiga
// hardware addresses or display chip pointers. Never reuse retired addresses.
function createBankMemory(banks) {
  const allocations = new Map();
  let next = 65536;
  function prune() {
    for (const bank of allocations.keys()) if (banks.get(bank.number) !== bank) allocations.delete(bank);
  }
  function start(number) {
    prune();
    const bank = banks.get(number);
    if (!bank) throw new Error('Bank not reserved');
    if (bank.type !== 'data') throw new Error('Start of image banks is not implemented');
    let allocation = allocations.get(bank);
    if (!allocation) {
      const base = Math.ceil(next / 16) * 16, capacity = bank.data.length;
      if (!Number.isSafeInteger(capacity) || capacity < 0 || base > 0x7fffffff || base + capacity > 0x80000000) throw new Error('Bank address space exhausted');
      allocation = { base, capacity };
      allocations.set(bank, allocation); next = base + Math.max(1, capacity) + 16;
    }
    return allocation.base;
  }
  function resolve(address, length = 1) {
    if (!Number.isInteger(address) || address < 0 || address > 0x7fffffff) throw new Error('Bank memory address out of bounds');
    if (!Number.isSafeInteger(length) || length < 0) throw new Error('Invalid bank memory range');
    prune();
    for (const [bank, allocation] of allocations) {
      if (address >= allocation.base && address <= allocation.base + allocation.capacity) {
        const offset = address - allocation.base;
        if (bank.data.length > allocation.capacity) throw new Error('Bank memory grew outside its allocation');
        if (offset > bank.data.length || length > bank.data.length - offset) break;
        return { bank, offset };
      }
    }
    throw new Error('Bank memory address out of bounds or retired');
  }
  return { start,
    address(value) {
      // Original bank_or_address treats operands below 1024 as bank numbers.
      const address = value < 1024 ? start(value) : value;
      resolve(address, 0); return address;
    },
    checkRange(address, length) { resolve(address, length); },
    read(address, length) { const { bank, offset } = resolve(address, length); return bank.data.slice(offset, offset + length); },
    write(address, bytes) { const { bank, offset } = resolve(address, bytes.length); bank.data.set(bytes, offset); },
    peek(address) { const { bank, offset } = resolve(address); return bank.data[offset]; },
    poke(address, value) { const { bank, offset } = resolve(address); bank.data[offset] = value & 255; },
    release(bank) { allocations.delete(bank); } };
}

if (typeof module === 'object' && module.exports) module.exports = createBankMemory;
else globalThis.AMOS_BANK_MEMORY = createBankMemory;
