/* jshint esversion: 6 */
'use strict';

const { token_by_name: names } = require('../../lib/TokenTable');
const word = value => [(value >>> 8) & 255, value & 255];
const dword = value => [...word(value >>> 16), ...word(value)];
const token = name => {
  if (names[name] == null) throw new Error(`Unknown test token ${name}`);
  return word(names[name]);
};
const padded = text => [...Buffer.from(text, 'latin1'), ...(text.length % 2 ? [0] : [])];
const text = value => [...word(0x26), ...word(value.length), ...padded(value)];
const integer = value => [...word(0x3e), ...dword(value)];
const identifier = (name, type = 6, flags = 0) => [...word(type), 0, 0, name.length, flags, ...padded(name)];

function binary(lines) {
  const code = lines.flatMap(parts => {
    const bytes = parts.flat(Infinity);
    const size = bytes.length + 4;
    if (size % 2 || size > 510) throw new Error('Invalid test line size');
    return [size / 2, 0, ...bytes, 0, 0];
  });
  return Buffer.from([...Buffer.from('AMOS Basic v1.00'), ...dword(code.length), ...code]);
}

module.exports = { word, dword, token, text, integer, identifier, binary };
