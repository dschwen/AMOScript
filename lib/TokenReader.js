/* jshint esversion: 6 */
'use strict';

const { token_by_name: names } = require('./TokenTable');
const byCode = Object.fromEntries(Object.entries(names).map(([name, code]) => [code, name]));
const extensions = require('./ExtensionTable');

// Decode payloads once, within their declared source line. No semantic actions.
class TokenReader {
  constructor(buffer) {
    this.buffer = buffer;
  }

  read() {
    const b = this.buffer;
    const tokens = [];
    for (let line = 0; line < b.lines.length; line++) {
      const start = b.lines[line];
      const end = start + b.getByte(start) * 2;
      b.ip = start + 2;
      const requireBytes = count => {
        if (b.ip + count > end) throw new Error(`Truncated token at line ${line + 1}, byte ${b.ip}`);
      };
      const word = () => { requireBytes(2); return b.popWord(); };
      const dword = () => { requireBytes(4); return b.popDWord(); };
      const string = length => {
        requireBytes(length + length % 2);
        return b.popString(length);
      };
      let ended = false;
      while (b.ip < end) {
        const location = { line: line + 1, offset: b.ip };
        const code = word();
        const token = { code, name: byCode[code], location };
        if (code === 0) {
          if (b.ip !== end) throw new Error(`Unexpected data after line ${line + 1} terminator at byte ${b.ip}`);
          token.name = 'EOL';
          ended = true;
        } else if (code === 0x4e) {
          requireBytes(4);
          const slot = b.popByte(), reference = b.popByte(), offset = word();
          const entry = extensions[slot] && extensions[slot][offset];
          if (!entry) throw new Error(`Unsupported extension ${slot}:0x${offset.toString(16)} at line ${line + 1}, byte ${location.offset}`);
          token.name = entry.name;
          token.extension = { slot, reference, offset };
        } else if ([0x6, 0xc, 0x12, 0x18].includes(code)) {
          word(); // AMOS internal reference offset
          requireBytes(2);
          const length = b.popByte();
          token.flags = b.popByte();
          // Identifier lengths may include their terminating zero/padding.
          // String literal lengths instead describe all bytes, including NUL.
          token.value = string(length).split('\0')[0].toLowerCase();
          token.name = { 6: 'variable', 12: 'label', 18: 'procedureCall', 24: 'labelRef' }[code];
        } else if ([0x1e, 0x36, 0x3e, 0x46].includes(code)) {
          const bits = dword();
          token.name = 'number';
          token.value = code === 0x46
            ? ((bits & 128) ? -1 : 1) * (bits >>> 8) * Math.pow(2, (bits & 127) - 88)
            : bits;
        } else if (code === 0x26 || code === 0x2e) {
          token.name = 'string';
          token.value = string(word());
        } else if (code === names.Rem || code === names['`']) {
          requireBytes(2);
          b.popByte();
          const length = b.popByte();
          token.value = string(length);
          token.name = 'comment';
        } else if (['For', 'If', 'Else', 'Else If', 'Do', 'While', 'Repeat', 'Data'].includes(token.name)) {
          word();
        } else if (token.name === 'Exit' || token.name === 'Exit If' || token.name === 'On') {
          word(); word();
        } else if (token.name === 'Procedure') {
          token.size = dword();
          word();
          requireBytes(2);
          token.flags = b.popByte();
          b.popByte();
          if (token.flags & 0x30) throw new Error(`Unsupported encrypted or compiled procedure at line ${line + 1}, byte ${location.offset}`);
        }
        if (!token.name) throw new Error(`Unsupported token 0x${code.toString(16)} at line ${line + 1}, byte ${location.offset}`);
        tokens.push(token);
      }
      if (!ended) throw new Error(`Missing terminator at line ${line + 1}, byte ${end}`);
    }
    tokens.push({ name: 'EOF', location: { line: b.lines.length + 1, offset: b.ip } });
    return tokens;
  }
}

module.exports = TokenReader;
