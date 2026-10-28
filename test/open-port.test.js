/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { binary, token: t, integer: n, text, identifier: id, word: w, compile, execute } = require('./helpers/program');
const { createMemoryPorts } = require('../lib/amos/ports');
const fixture = require('./fixtures/open-port.json');
const open = (channel = 1, name = 'par:') => [t('Open Port'), n(channel), t(','), text(name)];
const timers = () => { const clock = require('./helpers/fakeTimers').createFakeTimers(); return { now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout }; };
const make = options => compile(binary([[t('Wait Key')]])).create({ ...timers(), ...options });

test('Open Port: exact token uses an explicit adapter without resolving Dir$ or requiring files', () => {
  assert.deepStrictEqual(t('Open Port'), [0x18, 0xde]);
  const ports = createMemoryPorts(), p = execute(binary([open(), [t('Print#'), n(1), t(','), text('\x1b\0\xff')], [t('Close'), n(1)]]), 100, { ports }).program;
  assert.strictEqual(p.state.halted, true); assert.strictEqual(ports.snapshot()[0].bytes, '\x1b\0\xff\r\n');
  const q = make({ ports, files: { isDirectory: () => true } }); q.setDirectory('volume:folder/');
  q.fileOpen(2, 'PAR:', 'Open Port'); q.fileClose(2); assert.strictEqual(ports.snapshot()[1].device, 'PAR:'); q.stop();
  assert.throws(() => execute(binary([open()])), /ports host adapter at line 1, byte 22/);
  assert.throws(() => compile(binary([[t('Open Port'), n(1), t(','), n(2)]])), /must be a string/);
});

test('Open Port: output-only channel gates, conflicts, raw separators and byte strings', () => {
  const ports = createMemoryPorts(), p = make({ ports, files: { read: () => '', write() {} } });
  p.fileOpen(1, 'par:', 'Open Port');
  assert.throws(() => p.fileOpen(1, 'file', 'Open Out'), /already open/);
  for (const name of ['Eof', 'Lof', 'Pof']) assert.throws(() => p.fileInfo(name, 1), /Disc information/);
  assert.throws(() => p.fileRead(1, 'string'), /access mode/);
  p.filePrint(1, ['A', '\0\xff'], [',', ';']); p.filePrint(1, [], []); p.filePrint(1, ['B'], [',']);
  assert.strictEqual(ports.snapshot()[0].bytes, 'A\t\0\xff\r\nB\t');
  assert.throws(() => p.filePrint(1, ['\u0100'], []), /byte characters/);
  p.fileClose(1); p.fileOpen(1, 'ordinary', 'Open Out'); p.fileClose(1); p.stop();
});

test('Open Port: pending callbacks are guarded and names/metadata remain captured', () => {
  let p, opened = 0, closed = 0;
  const ports = { open(name, request) {
    opened++; assert.strictEqual(name, 'par:'); assert.strictEqual(request.channel, 1); assert.ok(Object.isFrozen(request));
    assert.throws(() => p.fileOpen(1, 'par:', 'Open Port'), /already open/);
    assert.throws(() => p.fileClose(1), /busy/);
    return { write(bytes) { assert.strictEqual(bytes, 'x'); assert.throws(() => p.fileClose(1), /busy/); }, close() { closed++; p.fileOpen(1, 'new', 'Open Out'); } };
  } };
  p = make({ ports, files: { read: () => '', write() {} } }); p.fileOpen(1, 'par:', 'Open Port'); p.filePrint(1, ['x'], [';']); p.fileClose();
  assert.deepStrictEqual([opened, closed, p.fileInfo('Lof', 1)], [1, 1, 0]); p.fileClose(1); p.stop();
});

test('Open Port: synchronous errors and thenables fail with source context; failed close cannot replay', () => {
  for (const handle of [null, Promise.resolve({}), { write() {}, close: 1 }]) {
    const p = make({ ports: { open: () => handle } }); assert.throws(() => p.fileOpen(1, 'par:', 'Open Port'), /synchronous write\/close/); assert.throws(() => p.fileClose(1), /not open/); p.stop();
  }
  let closes = 0;
  assert.throws(() => execute(binary([open(), [t('Print#'), n(1), t(','), text('x')]]), 100, { ports: { open: () => ({ write() { throw Error('write failed'); }, close() { closes++; throw Error('cleanup failed'); } }) } }), /write failed at line 2/);
  assert.strictEqual(closes, 1);
  const cleanup = [], { create } = compile(binary([open(), [t('Print#'), n(1), t(','), text('x')]]));
  const failing = create({ ...timers(), ports: { open: () => ({ write() { throw Error('failed output'); }, close() { cleanup.push('close'); } }) } });
  failing.audio.silence = () => cleanup.push('audio');
  assert.throws(() => failing.tick(100), /failed output/);
  assert.deepStrictEqual(cleanup, ['audio', 'close']);
  const interrupted = make({ ports: { open() { interrupted.closePorts(); return { write() {}, close() { closes++; } }; } } });
  assert.throws(() => interrupted.fileOpen(1, 'par:', 'Open Port'), /terminated during open/);
  assert.strictEqual(closes, 2); interrupted.stop();
  const disposing = make({ ports: { open() { return { write() { disposing.closePorts(); }, close() { closes++; } }; } } });
  disposing.fileOpen(1, 'par:', 'Open Port'); disposing.filePrint(1, ['x'], []);
  assert.strictEqual(closes, 3); assert.throws(() => disposing.filePrint(1, ['x'], []), /not open/); disposing.stop();
  for (const method of ['write', 'close']) {
    closes = 0; const p = make({ ports: { open: () => ({ write() { return method === 'write' ? Promise.resolve() : undefined; }, close() { closes++; return method === 'close' ? Promise.resolve() : undefined; } }) } });
    p.fileOpen(1, 'par:', 'Open Port');
    if (method === 'write') { assert.throws(() => p.filePrint(1, ['x'], []), /synchronously/); p.fileClose(1); }
    else { assert.throws(() => p.fileClose(1), /synchronously/); assert.throws(() => p.fileClose(1), /not open/); }
    assert.strictEqual(closes, 1); p.stop();
  }
});

test('Open Port: End closes owned handles once, while Stop/Resume retains them', () => {
  const ports = createMemoryPorts(), { create } = compile(binary([open(), [t('Wait Key')], [t('End')]])), p = create({ ...timers(), ports });
  p.tick(100); p.stop(); assert.strictEqual(ports.snapshot()[0].closed, false); p.resume(); p.sendKey('x'); p.tick(100);
  assert.strictEqual(ports.snapshot()[0].closed, true); p.tick(100); assert.strictEqual(ports.snapshot().length, 1);
  assert.throws(() => p.fileOpen(1, 'par:', 'Open Port'), /terminated/);
  const events = [];
  execute(binary([open(), [t('Edit')]]), 100, {
    ports: { open: () => ({ write() {}, close() { events.push('close'); } }) },
    system: { command(name) { events.push(name); } }
  });
  assert.deepStrictEqual(events, ['close', 'Edit']);
  let closed = 0;
  const multiple = make({ ports: { open: () => ({ write() {}, close() { closed++; throw Error('close failure'); } }) } });
  multiple.fileOpen(1, 'first:', 'Open Port'); multiple.fileOpen(2, 'second:', 'Open Port');
  assert.throws(() => multiple.closePorts(), /close failure/); assert.strictEqual(closed, 2);
  multiple.closePorts(); assert.strictEqual(closed, 2); multiple.stop();
});

test('Parallel capture: explicit device policy, per-adapter ownership, immutable snapshots and bounds', () => {
  const a = createMemoryPorts(), b = createMemoryPorts();
  assert.throws(() => a.open('ser:', { channel: 1 }), /Unsupported output port/);
  const first = a.open('PAR:', { channel: 1 }), second = b.open('par:', { channel: 1 }); first.write('a'); second.write('b');
  assert.throws(() => a.open('par:', { channel: 2 }), /already open/);
  const snapshot = a.snapshot(); first.write('c'); assert.strictEqual(snapshot[0].bytes, 'a'); assert.ok(Object.isFrozen(snapshot[0]));
  assert.throws(() => first.write('x'.repeat(1048576)), /limit/); first.close(); first.close(); assert.throws(() => first.write('x'), /closed/); second.close();
  assert.strictEqual(b.snapshot()[0].bytes, 'b');
});

test('Printer originals: all three unchanged programs finish with independent complete byte streams', () => {
  for (const [name, expected] of Object.entries(fixture)) {
    const raw = fs.readFileSync(path.join(__dirname, '../examples/Introideen', name)), ports = createMemoryPorts();
    assert.strictEqual(crypto.createHash('sha256').update(raw).digest('hex'), expected.sourceSha256);
    const { program } = execute(raw, 10000, { ports }); const jobs = ports.snapshot();
    assert.strictEqual(program.state.halted, true); assert.strictEqual(jobs.length, 1); assert.strictEqual(jobs[0].closed, true);
    assert.strictEqual(Buffer.from(jobs[0].bytes, 'latin1').toString('base64'), expected.base64, name);
  }
});

test('Uncached procedure calls: bracket form follows checked ordinary declarations and arities', () => {
  const proc = [t('Procedure'), [0,0,0,0], w(0), 0, 0, id('sample'), t('['), id('x'), t(']')];
  const source = binary([[id('sample'), t('['), n(7), t(']')], [t('End')], proc, [t('Print'), id('x')], [t('End Proc')]]);
  assert.deepStrictEqual(execute(source).logs, [[7]]);
  assert.throws(() => compile(binary([[id('missing'), t('['), n(7), t(']')]])), /Unknown procedure/);
});
