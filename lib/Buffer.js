/* jshint esversion: 6 */

// binary buffer with helper functions
(() => {
  var bounds = require('binary-search-bounds');

  module.exports = class Buffer {
    constructor(buffer) {
      this.buffer = buffer;
      this.ip = 0;
      this.checkRange(0, 20);
      this.code_bytes = this.getDWord(16) >>> 0;
      this.checkRange(20, this.code_bytes);

      // check magic
      var magic = '';
      for (let i = 0; i < 16; ++i)
        magic += String.fromCharCode(this.buffer[i]);
      var valid_magic = [
        "AMOS Basic V134 ", "AMOS Basic v134 ",
        "AMOS Basic V1.3 ", "AMOS Basic v1.3 ",
        "AMOS Basic V1.00", "AMOS Basic v1.00",
        "AMOS Pro101V\0\0\0\0", "AMOS Pro101v\0\0\0\0"
      ];
      if (valid_magic.indexOf(magic) < 0)
        throw new Error('Invalid AMOS file header');
      this.magic = magic;

      // set instruction pointer
      this.ip = 20;

      // get the line start pointers
      var lines = [], i = 20;
      while (i < this.code_bytes + 20)
      {
        const length = this.getByte(i) * 2;
        if (length < 4 || i + length > this.code_bytes + 20) {
          throw new Error(`Invalid AMOS line length at byte ${i}`);
        }
        lines.push(i);
        i += length;
      }
      this.lines = lines;
    }

    // get either the current line number or the line number in offset bytes
    // after the current instruction pointer
    lineNumber(offset = 0)
    {
      let ip = this.ip + offset;
      return ip >= this.code_bytes + 20 ? this.lines.length : bounds.le(this.lines, ip);
    }

    exhausted() {
      return this.ip >= this.code_bytes + 20;
    }

    popString(len) {
      this.checkRange(this.ip, len + len % 2);
      // fetch a string with a given length
      var s = '';
      for (let i = 0; i < len; ++i) {
        let byte = this.getByte(this.ip + i);
        s += String.fromCharCode(byte);
      }
      this.ip += len;

      // string lengths are zero padded to even size
      if (len % 2)
        this.ip++;

      return s;
    }

    popByte() {
      var byte = this.getByte(this.ip);
      this.ip++;
      return byte;
    }

    checkRange(adr, length) {
      if (!Number.isInteger(adr) || !Number.isInteger(length) || adr < 0 || length < 0 || adr + length > this.buffer.length) {
        throw new Error(`Truncated AMOS data at byte ${adr} (need ${length} bytes)`);
      }
    }

    getByte(adr = this.ip) {
      this.checkRange(adr, 1);
      return this.buffer[adr];
    }

    popWord() {
      var word = this.getWord(this.ip);
      this.ip += 2;
      return word;
    }

    getWord(adr = this.ip) {
      this.checkRange(adr, 2);
      return (this.buffer[adr] << 8) + this.buffer[adr+1];
    }

    popDWord() {
      var dword = this.getDWord(this.ip);
      this.ip += 4;
      return dword;
    }

    getDWord(adr = this.ip) {
      this.checkRange(adr, 4);
      return (this.buffer[adr]   << 24) +
             (this.buffer[adr+1] << 16) +
             (this.buffer[adr+2] << 8) +
              this.buffer[adr+3];
    }
  }
})();
