/* jshint esversion: 6 */
const fs = require('fs');
const Transpiler = require('../lib/Transpiler');

const file = process.argv[2];
if (!file) { console.error('Usage: node tools/dump_ir.js <file.AMOS>'); process.exit(1); }
const buf = fs.readFileSync(file);
const t = new Transpiler(buf);
console.log('OPS:');
t._ops.forEach((op, i) => console.log(i, op));
console.log('LABELS:', t._labels);
console.log('IP:', t._buffer.ip, 'LINE_INDEX:', t._buffer.lineNumber());
