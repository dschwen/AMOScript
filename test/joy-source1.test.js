'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { binary, token: t, integer: n, identifier: id, text, word, dword, compile, execute } = require('./helpers/program');
const BankReader = require('../lib/BankReader'), BankWriter = require('../lib/BankWriter');
const { createFakeTimers } = require('./helpers/fakeTimers'), { createMemoryFiles } = require('../lib/amos/files');
const root = path.join(__dirname, '../examples/Joy/Source1'), manifest = require('../examples/Joy/Source1/manifest.json');
const source = name => fs.readFileSync(path.join(root, name));
const memory = () => createMemoryFiles(Object.fromEntries(Object.entries(manifest.files).map(([name, entry]) => [name, fs.readFileSync(path.join(root, entry.path)).toString('latin1')])));
const fn = (name, ...args) => [t(name), t('('), ...args.flatMap((a, i) => [...(i ? t(',') : []), a]), t(')')];
const label = name => id(name, 12), target = name => id(name, 24);
function imageFile(mode) {
  const image = { width: 16, height: 1, depth: 2, hotspotX: 0, hotspotY: 0, pixels: Array(16).fill(mode + 1) };
  return BankWriter.byteString(BankWriter.write([{ number: 2, type: 'icons', images: Array.from({ length: mode + 1 }, () => image), palette: Array(32).fill(0) }]));
}

test('Joy Src1: seven supplied originals retain their hashes; all three nonempty sources compile and empty files stay explicit', () => {
  let compiled = 0, empty = 0;
  for (const entry of manifest.sources) {
    const bytes = source(entry.path); assert.strictEqual(bytes.length, entry.byteLength); assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    if (!bytes.length) { empty++; assert.throws(() => compile(bytes), /Truncated AMOS/); }
    else { compile(bytes); compiled++; }
  }
  assert.deepStrictEqual([compiled, empty], [3, 4]);
});

test('Pop: discards the innermost Gosub address without returning or changing the outer target', () => {
  const r = execute(binary([[t('Gosub'), target('outer')], [t('Print'), text('done')], [t('End')],
    [label('outer'), t('Gosub'), target('inner')], [t('Print'), text('wrong')], [t('Return')],
    [label('inner'), t('Pop')], [t('Print'), text('continued')], [t('Return')]]));
  assert.deepStrictEqual(r.logs, [['continued'], ['done']]); assert.strictEqual(r.program.state.stack.length, 0);
  assert.throws(() => execute(binary([[t('Pop')]])), /Pop without Gosub at line 1, byte 22/);
});

test('Pop: procedure-local Gosubs may be discarded, while caller/procedure boundaries reject without consuming the caller stack', () => {
  const procedure = [t('Procedure'), dword(0), word(0), 0, 0, id('p')];
  const good = execute(binary([[id('p')], [t('Print'), text('returned')], [t('End')], procedure,
    [t('Gosub'), target('inner')], [t('Goto'), target('leave')], [label('inner'), t('Pop')],
    [label('leave')], [t('End Proc')]]));
  assert.deepStrictEqual(good.logs, [['returned']]); assert.strictEqual(good.program.state.frames.length, 0);
  const p = compile(binary([[t('Gosub'), target('outer')], [t('End')], [label('outer'), id('p')], [t('Return')], procedure, [t('Pop')], [t('End Proc')]])).create({ setTimeout() {} });
  assert.throws(() => p.tick(100), /Pop without Gosub at line 6/); assert.strictEqual(p.state.stack.length, 1); assert.strictEqual(p.state.frames.length, 1);
});

test('Pop: errors pass through the normal On Error boundary and retained source location', () => {
  const r = execute(binary([[t('On Error'), t('Goto'), target('error')], [t('Pop')], [t('End')],
    [label('error'), t('Print'), text('caught')], [t('Resume Label'), target('done')], [label('done'), t('End')]]));
  assert.deepStrictEqual(r.logs, [['caught']]); assert.strictEqual(r.program.state.error.location.line, 2);
});

test('Uncached Joy forms: Limit Mouse overloads and Ink operands normalize, while cached arities and types stay strict', () => {
  const p = execute(binary([[t('Limit Mouse'), n(128), t(','), n(45), t('To'), n(447), t(','), n(164)],
    [t('Ink'), n(3), t(','), n(2), t(','), n(1)], [t('Wait Key')]])).program;
  assert.deepStrictEqual({ ...p.state.input.mouseLimits }, { x1: 128, y1: 45, x2: 447, y2: 164 });
  assert.deepStrictEqual([p.display.screen().ink, p.display.screen().inkBackground, p.display.screen().inkBorder], [3, 2, 1]); p.stop();
  assert.throws(() => compile(binary([[t('Ink2'), n(1), t(','), n(2), t(','), n(3)]])), /Expected end of statement/);
  assert.throws(() => compile(binary([[t('Limit Mouse Screen'), n(0), t(','), n(1), t('To'), n(2), t(','), n(3)]])), /Expected end of statement/);
  assert.throws(() => compile(binary([[t('Limit Mouse'), text('bad')]])), /numeric/);
});

test('Grouped banks: valid repeated chunks replace in file order; later malformed entries cannot mutate the live bank set', () => {
  const a = Buffer.from(imageFile(0), 'latin1'), b = Buffer.from(imageFile(2), 'latin1'), group = Buffer.concat([Buffer.from('416d42730002', 'hex'), a, b]);
  const decoded = BankReader.readFile(group).banks; assert.strictEqual(decoded.length, 1); assert.strictEqual(decoded[0].number, 2); assert.strictEqual(decoded[0].images.length, 3);
  const files = createMemoryFiles({ good: group.toString('latin1'), bad: group.subarray(0, -1).toString('latin1') });
  const p = execute(binary([[t('Load'), text('good')], [t('Wait Key')], [t('Load'), text('bad')]]), 100, { files }).program;
  const old = p.banks.get(2); p.sendKey('next'); assert.throws(() => p.tick(100), /Truncated bank/); assert.strictEqual(p.banks.get(2), old);
  const invalidFirst = Buffer.from(group); invalidFirst.writeUInt16BE(0xffff, 6 + a.length - 64);
  assert.throws(() => BankReader.readFile(invalidFirst), /palette colour/);
});

test('Original ICONBANKING: all six transitions and three no-op selections preserve the three bank identities', () => {
  const r = execute(require('./helpers/joyIconBanking')(), 1000, { files: createMemoryFiles({ zero: imageFile(0), one: imageFile(1), two: imageFile(2) }) });
  const p = r.program, identities = [p.banks.get(2), p.banks.get(10), p.banks.get(9)], routes = [0, 1, 1, 2, 2, 0, 0, 2, 1, 0];
  for (const mode of routes) {
    assert.strictEqual(p.state.waiting, 'key'); assert.strictEqual(p.banks.get(2), identities[mode]);
    assert.strictEqual(p.banks.get(2).images[0].pixels[0], mode + 1); assert.strictEqual(new Set(p.banks.values()).size, 3); assert.strictEqual(p.state.frames.length, 0);
    p.sendKey('next'); r.timers.tick(0);
  }
  assert.strictEqual(p.state.halted, true);
});

test('Original LabEdit versions: fill/clear and protected marker fill use Pop without stack leaks; Escape reaches Edit', () => {
  for (const file of ['LabEdit.AMOS', 'LabEdit.Bak']) {
    const clock = createFakeTimers(4), files = memory(), p = compile(source(file)).create({ now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, files });
    p.setMouse(133, 50, 0); p.tick(1000); clock.tick(40);
    const press = key => { p.sendKey(key); clock.tick(40); };
    assert.strictEqual(p.banks.get(2).images.length, 22);
    for (const key of ['5', '6']) { press(key); const before = Array.from(p.banks.get(10).data); press('f'); assert.deepStrictEqual(Array.from(p.banks.get(10).data), before); }
    press('2'); press('f'); let map = Array.from(p.banks.get(10).data); assert.deepStrictEqual(map.slice(0, 2), [17, 21]); assert.ok(map.slice(2).every(v => v === 3));
    press('c'); map = Array.from(p.banks.get(10).data); assert.deepStrictEqual(map.slice(0, 2), [17, 21]); assert.ok(map.slice(2).every(v => v === 0));
    press('\x1b'); assert.strictEqual(p.state.halted, true); assert.ok(p.state.editRequest); assert.strictEqual(p.state.stack.length, 0); assert.strictEqual(clock.pending(), 0);
  }
});

test('Original Labyrinth backup: grouped icons load and source startup reaches its read-before-bounds error without relaxing bank checks', () => {
  const clock = createFakeTimers(4), p = compile(source('Labyrinth.Bak')).create({ now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, files: memory() });
  assert.strictEqual(p.banks.get(2).images.length, 8); p.tick(1000);
  assert.throws(() => clock.tick(2400), /Bank memory address out of bounds or retired at line 70, byte 5450/); assert.strictEqual(p.state.halted, true);
});


test('Joy page pointer setup: malformed hardware coordinates/buttons reject before page emission', () => {
  const build = require('../tools/build_game_page').buildGamePage, bytes = binary([[t('Wait Key')]]);
  for (const initialMouse of [[-1,0,0], [0,65536,0], [0,0,8], [0,0], new Array(3), [0,0,0.5], [0,0,'0']]) assert.throws(() => build(bytes, { initialMouse }), /initialMouse/);
});
