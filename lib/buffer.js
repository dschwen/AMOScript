/* jshint esversion: 6 */

// binary buffer with helper functions
(() => {
  module.exports = class Buffer {
    constructor(buffer) {
      this.buffer = buffer;
      this.code_bytes = this.getDWord(16);

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
        throw "Invalid AMOS file";
      this.magic = magic;

      // set instruction pointer
      this.ip = 20;
    }

    label() {
      return 'ip' + this.ip;
    }

    exhausted() {
      return this.ip >= this.code_bytes + 20;
    }

    popString(len) {
      // fetch a string with a given length
      var s = '';
      for (let i = 0; i < len; ++i)
        s += String.fromCharCode(this.getByte(this.ip + i));
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

    getByte(adr) {
      return this.buffer[adr];
    }

    popWord() {
      var word = this.getWord(this.ip);
      this.ip += 2;
      return word;
    }

    getWord(adr) {
      return (this.buffer[adr] << 8) + this.buffer[adr+1];
    }

    getDWord(adr) {
      return (this.buffer[adr]   << 24) +
             (this.buffer[adr+1] << 16) +
             (this.buffer[adr+2] << 8) +
              this.buffer[adr+3];
    }
  }
})();
