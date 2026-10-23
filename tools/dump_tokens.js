/* jshint esversion: 6 */
'use strict';

const fs = require('fs');
const BufferReader = require('../lib/Buffer');
const TokenReader = require('../lib/TokenReader');

if (!process.argv[2]) {
  console.error('Usage: node tools/dump_tokens.js <file.AMOS>');
  process.exitCode = 1;
} else {
  try {
    const reader = new BufferReader(fs.readFileSync(process.argv[2]));
    for (const token of new TokenReader(reader).read()) console.log(JSON.stringify(token));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
