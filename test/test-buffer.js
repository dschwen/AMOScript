'use strict';

const assert = require('assert');
const BufferMod = require('../lib/Buffer');

// Build a minimal valid AMOS buffer
function makeBuf() {
  const arr = new Uint8Array(40);
  const magic = 'AMOS Basic v1.00'; // 16 bytes
  for (let i = 0; i < 16; i++) arr[i] = magic.charCodeAt(i);
  // code_bytes = 2 (big-endian)
  arr[16] = 0x00; arr[17] = 0x00; arr[18] = 0x00; arr[19] = 0x02;
  // line table content to allow constructor scan to progress: at 20 -> 1 (so i += 2 to 22 and stop)
  arr[20] = 0x01;
  // data for reads starting at ip=20
  arr[21] = 0x12; // popWord high
  arr[22] = 0x34; // popWord low
  // dword 0x0000002A starting at 23
  arr[23] = 0x00; arr[24] = 0x00; arr[25] = 0x00; arr[26] = 0x2A;
  // string bytes starting at 27
  arr[27] = 'A'.charCodeAt(0);
  arr[28] = 'B'.charCodeAt(0);
  arr[29] = 'C'.charCodeAt(0);
  arr[30] = 'D'.charCodeAt(0);
  return arr;
}

test('Buffer: magic and basic reads', () => {
  const buf = new BufferMod(makeBuf());
  assert.strictEqual(buf.magic, 'AMOS Basic v1.00');

  // ip starts at 20
  assert.strictEqual(buf.ip, 20);
  assert.strictEqual(buf.popByte(), 0x01); // line length byte
  assert.strictEqual(buf.popWord(), 0x1234);
  assert.strictEqual(buf.popDWord(), 0x2A);
  assert.strictEqual(buf.ip, 27);
});

test('Buffer: popString respects even alignment', () => {
  const buf = new BufferMod(makeBuf());
  buf.ip = 27;
  const s3 = buf.popString(3);
  assert.strictEqual(s3, 'ABC');
  assert.strictEqual(buf.ip, 31); // 27 + 3 + 1 (align)

  buf.ip = 27;
  const s4 = buf.popString(4);
  assert.strictEqual(s4, 'ABCD');
  assert.strictEqual(buf.ip, 31); // 27 + 4
});

