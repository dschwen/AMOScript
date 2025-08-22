/* jshint esversion: 6 */
const fs = require('fs');
const BufferReader = require('../lib/Buffer');
const { token_by_name } = require('../lib/TokenTable');

function invert(obj) {
  const inv = {};
  Object.keys(obj).forEach(k => { inv[obj[k]] = k; });
  return inv;
}

const token_name = invert(token_by_name);

function dump(file) {
  const buf = fs.readFileSync(file);
  const reader = new BufferReader(new Uint8Array(buf));
  console.log('Magic:', reader.magic);
  console.log('Code bytes:', reader.code_bytes);
  console.log('Lines:', reader.lines.length);
  let lineIdx = 0;
  while (!reader.exhausted()) {
    const start = reader.ip;
    const lineLenWords = reader.getByte(start);
    const lineEnd = start + lineLenWords * 2;
    process.stdout.write(`\n-- line ${lineIdx} @${start} lenWords=${lineLenWords} --\n`);
    // skip 2 bytes (len), then 2 bytes (line number?) then tokens until 0x0000
    reader.popByte(); // len (hi)
    reader.popByte(); // len (lo)
    const lnHi = reader.popByte();
    const lnLo = reader.popByte();
    const tag = (lnHi << 8) + lnLo;
    const tagName = token_name[tag] || '';
    process.stdout.write(`(raw line tag 0x${lnHi.toString(16)} 0x${lnLo.toString(16)} = 0x${tag.toString(16)} ${tagName ? '['+tagName+']' : ''})\n`);
    // dump words until 0x0000
    while (reader.ip < lineEnd) {
      const w = reader.popWord();
      if (w === 0x0000) { process.stdout.write('ENDLINE\n'); break; }
      const name = token_name[w] || '';
      process.stdout.write(name ? `${name}(0x${w.toString(16)}) ` : `0x${w.toString(16)} `);
      // attempt to handle simple terminals (string/integer/float markers)
      if (w === 0x026 || w === 0x02e) {
        const len = reader.popWord();
        const s = reader.popString(len);
        process.stdout.write(`"${s}" `);
      } else if (w === 0x01e || w === 0x036 || w === 0x03e) {
        const d = reader.popDWord();
        process.stdout.write(`[int ${d}] `);
      } else if (w === 0x046) {
        const d = reader.popDWord();
        process.stdout.write(`[float 0x${d.toString(16)}] `);
      } else if (w === 0x006) {
        // identifier: skip word, then 2 bytes len/flags then string
        const skip = reader.popWord();
        const b1 = reader.popByte();
        const b2 = reader.popByte();
        const name = reader.popString(b1);
        process.stdout.write(`ident(${name}) `);
      }
    }
    // align to next line start
    reader.ip = lineEnd;
    lineIdx++;
  }
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('Usage: node tools/dump_tokens.js <file.AMOS>'); process.exit(1); }
  dump(file);
}
