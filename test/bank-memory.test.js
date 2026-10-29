/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { binary, token: t, word: w, integer: n, identifier: id, text, execute, compile } = require('./helpers/program');
const { createMemoryFiles } = require('../lib/amos/files');
const reserve = (bank, size = 4) => [t('Reserve As Work'), n(bank), t(','), n(size)];
const fn = (name, value) => [t(name), t('('), value, t(')')];

test('bank memory: original Start/Peek/Poke bytes read unsigned values and write low bytes', () => {
  const lines = [reserve(4), [id('p'), t('='), w(0x140), t('('), n(4), t(')')],
    [w(0x21ca), id('p'), t(','), n(-1)], [w(0x21ca), id('p'), t('+'), n(1), t(','), n(258)],
    [t('Print'), w(0x21e6), t('('), id('p'), t(')'), t(','), fn('Peek', [id('p'), t('+'), n(1)])]];
  const { logs, program } = execute(binary(lines));
  assert.deepStrictEqual(logs, [[255, 2]]);
  assert.deepStrictEqual(Array.from(program.banks.get(4).data), [255, 2, 0, 0]);
  const fixture = require('./fixtures/conformance/bank-byte-access.json');
  const result = execute(Buffer.from(fixture.programHex, 'hex'));
  assert.deepStrictEqual(result.logs, fixture.expected.values);
  assert.strictEqual(result.program.state.input.keySpeed.intervalMs, 40);
  // Exercise the address-space boundary without allocating gigabytes of bytes.
  const memory = require('../lib/amos/bankMemory')(new Map([
    [4, { number: 4, type: 'data', data: { length: 0x3ffffff0 - 65536 } }],
    [5, { number: 5, type: 'data', data: new Uint8Array(0) }]
  ]));
  memory.start(4); assert.throws(() => memory.start(5), /address space exhausted/);
});

test('bank memory: swap preserves addresses; shrink preserves the prefix and retires the tail', () => {
  const { program } = execute(binary([reserve(4), reserve(5)]));
  const a = program.bankStart(4), b = program.bankStart(5);
  assert.notStrictEqual(a, b); program.poke(a, 17); program.poke(b, 99);
  program.swapBanks(4, 5);
  assert.strictEqual(program.bankStart(5), a); assert.strictEqual(program.bankStart(4), b);
  program.shrinkBank(5, 2);
  assert.strictEqual(program.bankStart(5), a); assert.strictEqual(program.peek(a), 17);
  assert.throws(() => program.peek(a + 2), /out of bounds|retired/);
  assert.throws(() => program.poke(a - 1, 1), /out of bounds|retired/);
  assert.strictEqual(program.peek(b), 99);
});

test('bank memory: erase, replacement and group reload retire addresses permanently', () => {
  const generic = Buffer.from('416d426b000500018000000b44617461202020200080ff', 'hex');
  const grouped = Buffer.concat([Buffer.from('416d42730001', 'hex'), generic]);
  const files = createMemoryFiles({ generic: generic.toString('latin1'), grouped: grouped.toString('latin1') });
  const { program } = execute(binary([reserve(5)]), 100, { files });
  const retired = [];
  for (const replace of [() => program.reserveWork(5, 3), () => program.loadBanks('generic'),
    () => program.loadBanks('grouped'), () => { program.eraseBank(5); program.reserveWork(5, 2); }]) {
    retired.push(program.bankStart(5)); replace();
    const next = program.bankStart(5);
    assert.ok(retired.every(address => address < next));
    retired.forEach(address => assert.throws(() => program.peek(address), /out of bounds|retired/));
  }
  const last = program.bankStart(5); program.eraseTemp();
  assert.throws(() => program.peek(last), /retired/);
  program.loadBanks('generic'); const permanent = program.bankStart(5); program.eraseAll();
  assert.throws(() => program.peek(permanent), /retired/);
});

test('bank memory: Poke updates saved bytes and subsequent audio reads; factories own separate storage', () => {
  const sample = '416d426b000500008000002053616d706c657320000100000006546f6e65202020200fa000000004007f80ff';
  const files = createMemoryFiles({ samples: Buffer.from(sample, 'hex').toString('latin1') });
  const { create } = compile(binary([[t('Load'), text('samples')], [t('Wait Key')]]));
  const options = { files, now: () => 0, setTimeout: () => 1, clearTimeout() {} }, a = create(options), b = create(options);
  a.tick(100); b.tick(100);
  const address = a.bankStart(5); a.poke(address + 20, 0x80);
  assert.strictEqual(a.audio.sample(1).data[0], 0x80); assert.strictEqual(b.audio.sample(1).data[0], 0);
  a.saveBanks('saved', 5);
  assert.strictEqual(files.read('saved').charCodeAt(40), 0x80);
});

test('bank memory: typed values flow through arrays, DATA and procedure results; invalid accesses carry locations', () => {
  const lines = [reserve(4), [t('Data'), w(0), n(129)], [t('Read'), id('value')],
    [t('Poke'), fn('Start', n(4)), t(','), id('value')], [t('Dim'), id('a'), t('('), n(1), t(')')],
    [id('a'), t('('), n(1), t(')'), t('='), fn('Peek', fn('Start', n(4)))],
    [t('Procedure'), [0, 0, 0, 0], w(0), 0, 0, id('readbyte')],
    [t('End Proc'), t('['), fn('Peek', fn('Start', n(4))), t(']')], [id('readbyte', 0x12)],
    [id('f', 6, 1), t('='), fn('Peek', fn('Start', n(4)))],
    [t('Print'), id('a'), t('('), n(1), t(')'), t(','), t('Param'), t(','), id('f', 6, 1)]];
  assert.deepStrictEqual(execute(binary(lines)).logs, [[129, 129, 129]]);
  assert.throws(() => execute(binary([[t('Print'), fn('Peek', n(0))]])), /at line 1, byte/);
  assert.throws(() => execute(binary([[t('Poke'), n(0), t(','), n(1)]])), /at line 1, byte/);
  assert.throws(() => execute(binary([[t('Print'), fn('Start', n(4))]])), /Bank not reserved at line 1/);
  for (const expr of [fn('Peek', text('x')), fn('Start', text('4'))]) assert.throws(() => compile(binary([[t('Print'), expr]])), /Wrong argument type/);
});

test('Wonderland: original 48-line startup reads embedded level seeds and initializes image masks', () => {
  const { create } = compile(require('./helpers/wonderlandStartup')(48, true));
  const samples = fs.readFileSync(path.join(__dirname, '../examples/Wonderland/Wonderland_Samples.Abk')).toString('latin1');
  const program = create({ files: { read: () => samples }, now: () => 0, setTimeout: () => 1, clearTimeout() {} });
  program.tick(100000);
  assert.strictEqual(program.state.halted, true);
  assert.deepStrictEqual([1, 2, 3, 4, 5].map(i => program.arrayGet(program.state.variables.array_int_rbowseed, [i])), [55, 7, 45, 10, 49]);
  assert.strictEqual(program.banks.get(1).images.length, 75);
  assert.throws(() => program.bankStart(1), /image banks/);
  assert.strictEqual(program.banks.get(1).images[0].masked, true);
  assert.strictEqual(program.banks.get(1).images[1].masked, false);
  assert.strictEqual(program.banks.get(1).images[74].masked, false);
  assert.deepStrictEqual({ ...program.state.input.keySpeed }, { delay: 10, interval: 2, delayMs: 200, intervalMs: 40 });
});
