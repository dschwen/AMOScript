/* jshint esversion: 6 */
'use strict';

// Only implemented commands belong here. Full recovered tables remain diagnostic.
const libraries = {
  'amcaf-1.50beta4': {
    0x008a: { name: 'Bank Temporary', method: 'extensionBankTemporary', args: ['number'] },
    0x08c4: { name: 'Chr.w$', method: 'extensionChrWord', args: ['number'], result: 'string' },
    0x08d2: { name: 'Chr.l$', method: 'extensionChrLong', args: ['number'], result: 'string' },
    0x098c: { name: 'Asc.w', method: 'extensionAscWord', args: ['string'], result: 'integer' },
    0x0998: { name: 'Asc.l', method: 'extensionAscLong', args: ['string'], result: 'integer' },
    0x1632: { name: 'Vclip', method: 'extensionVclip', args: ['number', 'number', 'number'], separators: [',', 'To'], result: 'integer' },
    0x1642: { name: 'Vin', method: 'extensionVin', args: ['number', 'number', 'number'], separators: [',', 'To'], result: 'integer' },
    0x16d0: { name: 'Even', method: 'extensionEven', args: ['number'], result: 'integer' },
    0x16dc: { name: 'Odd', method: 'extensionOdd', args: ['number'], result: 'integer' }
  },
  'turbo-plus-2.15': {
    0x0b86: { name: 'Word Hunt', method: 'extensionWordHunt', args: Array(5).fill('number'), separators: ['To', ',', ',', 'To'], result: 'integer' }
  }
};
for (const entries of Object.values(libraries)) {
  for (const entry of Object.values(entries)) {
    Object.freeze(entry.args);
    if (entry.separators) Object.freeze(entry.separators);
    Object.freeze(entry);
  }
  Object.freeze(entries);
}
Object.freeze(libraries);

function normalize(extensions = {}) {
  if (!extensions || typeof extensions !== 'object' || Array.isArray(extensions)) throw Error('extensions must be a slot-to-library object');
  const result = {};
  for (const [slot, library] of Object.entries(extensions)) {
    if (!/^[1-9][0-9]*$/.test(slot) || Number(slot) > 255) throw Error(`Invalid extension slot: ${slot}`);
    if (typeof library !== 'string' || !Object.hasOwn(libraries, library)) throw Error(`Unknown extension library: ${library}`);
    result[slot] = library;
  }
  return Object.freeze(result);
}

function parseMappings(values = []) {
  const result = {};
  for (const value of values) {
    const match = /^(\d+)=([^=]+)$/.exec(value);
    if (!match) throw Error('Expected extension mapping SLOT=LIBRARY');
    if (Object.hasOwn(result, match[1])) throw Error(`Duplicate extension slot: ${match[1]}`);
    result[match[1]] = match[2];
  }
  return normalize(result);
}

module.exports = { libraries, normalize, parseMappings };
