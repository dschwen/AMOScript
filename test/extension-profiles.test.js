/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), vm = require('vm'), fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');
const Transpiler = require('../lib/Transpiler');
const profiles = require('../lib/ExtensionProfiles');
const { binary, token: t, word: w, dword, integer: n, identifier: id, text } = require('./helpers/program');
const { createFakeTimers } = require('./helpers/fakeTimers');
const mappings = { 8: 'amcaf-1.50beta4', 12: 'turbo-plus-2.15' };
const ext = (slot, offset, reference = 0) => [w(0x4e), [slot, reference], w(offset)];
const fn = (slot, offset, args) => [ext(slot, offset), t('('), args, t(')')];

test('Extension profiles: implemented offsets, kinds, result types and separators match the recovered binary tables', () => {
  for (const [library, directory] of [['amcaf-1.50beta4', 'amcaf-v1.50beta4'], ['turbo-plus-2.15', 'turbo-plus-v2.15']]) {
    const catalog = require('../tools/reference/' + directory + '/catalog.json');
    for (const [offset, entry] of Object.entries(profiles.libraries[library])) {
      const token = catalog.tokens.find(token => token.offset === Number(offset));
      assert.ok(token); assert.strictEqual(entry.name.toLowerCase(), token.name);
      assert.strictEqual(entry.result || null, token.returnType);
      assert.strictEqual(!!entry.result, token.kind === 'function');
      assert.deepStrictEqual(entry.args.map(type => type === 'number' ? 'integer' : type), token.args);
      assert.deepStrictEqual(entry.separators || entry.args.slice(1).map(() => ','), token.separators);
    }
  }
});
function compile(lines, extensions = mappings) {
  const transpiler = new Transpiler(binary(lines), { extensions });
  const sandbox = { module: { exports: {} } };
  vm.runInNewContext(transpiler.toModule(), sandbox);
  return { transpiler, create: sandbox.module.exports };
}
function start(create, options = {}) {
  const timers = createFakeTimers(), logs = [];
  const program = create({ ...options, now: timers.now, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout, print: (...args) => logs.push(args) });
  program.tick(1000);
  return { program, logs };
}

test('Extension profiles: slots are explicit, frozen per compile, relocatable and cannot fall back to another library', () => {
  const lines = [[t('Print'), fn(8, 0x16dc, n(-3))], [t('Wait Key')]];
  assert.throws(() => compile(lines, {}), /Unsupported extension 8:0x16dc.*line 1/);
  assert.throws(() => compile(lines, { 8: 'turbo-plus-2.15' }), /Unsupported extension.*turbo-plus-2.15/);
  const config = { 8: 'amcaf-1.50beta4' }, a = compile(lines, config);
  config[8] = 'turbo-plus-2.15';
  assert.ok(Object.isFrozen(a.transpiler.extensions));
  assert.deepStrictEqual(start(a.create).logs, [[-1]]);
  assert.deepStrictEqual(start(compile([[t('Print'), fn(19, 0x16dc, n(2))], [t('End')]], { 19: 'amcaf-1.50beta4' }).create).logs, [[0]]);
  assert.throws(() => compile([[ext(8, 0x109e), n(3)] ]), /Unsupported extension.*amcaf-1.50beta4/);
  for (const config of [null, [], { 0: 'amcaf-1.50beta4' }, { 256: 'amcaf-1.50beta4' }, { '08': 'amcaf-1.50beta4' }, { 8: 'amcaf' }]) assert.throws(() => profiles.normalize(config));
  assert.throws(() => profiles.parseMappings(['8=amcaf-1.50beta4', '8=turbo-plus-2.15']), /Duplicate/);
  assert.throws(() => profiles.parseMappings(['8']), /SLOT=LIBRARY/);
});

test('AMCAF functions: exact signatures, signed booleans, reversed clamp bounds and byte-string return types', () => {
  const { create } = compile([
    [t('Print'), fn(8, 0x16d0, n(-2)), t(';'), fn(8, 0x16dc, n(-1))],
    [t('Print'), fn(8, 0x1632, [n(15), t(','), n(20), t('To'), n(10)])],
    [t('Print'), fn(8, 0x1642, [n(10), t(','), n(10), t('To'), n(20)]), t(';'), fn(8, 0x1642, [n(20), t(','), n(10), t('To'), n(20)])],
    [id('s', 6, 2), t('='), fn(8, 0x08d2, n(0x80000001))],
    [t('Print'), fn(8, 0x0998, id('s', 6, 2)), t(';'), fn(8, 0x098c, fn(8, 0x08c4, n(65535)))],
    [t('Wait Key')]
  ]);
  assert.deepStrictEqual(start(create).logs, [[-1, -1], [20], [-1, -1], [-2147483647, 65535]]);
  assert.throws(() => compile([[t('Print'), fn(8, 0x1632, [n(1), t(','), n(2), t(','), n(3)])]]), /Expected To/);
  assert.throws(() => compile([[t('Print'), fn(8, 0x16dc, text('bad'))]]), /Wrong argument type/);
  assert.throws(() => compile([[t('Print'), fn(8, 0x098c, n(1))]]), /Wrong argument type/);
  assert.throws(() => compile([[ext(8, 0x16dc)]]), /function cannot be used as a statement/);
  assert.throws(() => start(compile([[t('Print'), fn(8, 0x0998, text('a'))]]).create), /enough string bytes.*line 1/);
});

test('AMCAF Bank Temporary: preserve allocation identity and per-factory ownership', () => {
  const { create } = compile([[t('Reserve As Data'), n(9), t(','), n(8)], [t('Wait Key')]]);
  const a = start(create).program, b = start(create).program;
  const bank = a.banks.get(9), data = bank.data, address = a.bankStart(9);
  a.extensionBankTemporary(9);
  assert.strictEqual(bank.permanent, false); assert.strictEqual(b.banks.get(9).permanent, true);
  assert.strictEqual(a.banks.get(9), bank); assert.strictEqual(bank.data, data); assert.strictEqual(a.bankStart(9), address);
  assert.throws(() => a.extensionBankTemporary(99), /Bank not reserved/);
  a.stop(); b.stop();
  const p = start(compile([[t('Reserve As Data'), n(9), t(','), n(8)], [ext(8, 0x008a, 7), n(9)], [t('Wait Key')]]).create).program;
  assert.strictEqual(p.banks.get(9).permanent, false); p.stop();
});

test('Extension expressions: evaluate operands once left-to-right and preserve assignments when a later operand throws', () => {
  const select = label => [t('Val'), t('('), t('Fsel$'), t('('), text(label), t(')'), t(')')];
  const { create } = compile([[id('a'), t('='), n(5)],
    [id('a'), t('='), fn(8, 0x1632, [select('value'), t(','), select('lower'), t('To'), select('upper')])], [t('Wait Key')]]);
  const calls = [];
  const a = start(create, { files: { select({ path }) { calls.push(path); return { value: '10', lower: '20', upper: '30' }[path]; } } }).program;
  assert.deepStrictEqual(calls, ['value', 'lower', 'upper']); assert.strictEqual(a.state.variables.int_a, 20); a.stop();
  const timers = createFakeTimers(); calls.length = 0;
  const b = create({ now: timers.now, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
    files: { select({ path }) { calls.push(path); if (path === 'lower') throw Error('failed operand'); return '10'; } } });
  assert.throws(() => b.tick(1000), /failed operand.*line 2/);
  assert.deepStrictEqual(calls, ['value', 'lower']); assert.strictEqual(b.state.variables.int_a, 5);
});

test('Extension return types: string arrays, DATA values and procedure results retain byte strings and signed integers', () => {
  const element = i => [id('a', 6, 2), t('('), n(i), t(')')];
  const { create } = compile([
    [t('Dim'), element(1)], [t('Read'), element(0)],
    [element(1), t('='), fn(8, 0x08c4, n(0x8000))],
    [t('Print'), fn(8, 0x098c, element(0)), t(';'), fn(8, 0x098c, element(1))],
    [id('encode', 0x12), t('['), n(-1), t(']')],
    [t('Print'), fn(8, 0x0998, t('Param$'))], [t('Wait Key')],
    [t('Data'), w(0), text('\xff\xff')],
    [t('Procedure'), dword(0), w(0), 0, 0, id('encode'), t('['), id('x'), t(']')],
    [t('End Proc'), t('['), fn(8, 0x08d2, id('x')), t(']')]
  ]);
  assert.deepStrictEqual(start(create).logs, [[65535, 32768], [-1]]);
});

test('Turbo Word Hunt: To separators, signed words, sorted/aligned ranges, all action modes and complete bounds preflight', () => {
  const hunt = args => fn(12, 0x0b86, args);
  const { create } = compile([
    [t('Reserve As Work'), n(20), t(','), n(8)],
    [id('p'), t('='), t('Start'), t('('), n(20), t(')')],
    [t('Doke'), id('p'), t(','), n(65535)],
    [t('Doke'), id('p'), t('+'), n(2), t(','), n(7)],
    [t('Print'), hunt([id('p'), t('To'), id('p'), t('+'), n(4), t(','), n(0), t(','), n(7), t('To'), n(7)]), t('-'), id('p')],
    [t('Wait Key')]
  ]);
  const { program: p, logs } = start(create); assert.deepStrictEqual(logs, [[2]]);
  const a = p.bankStart(20);
  assert.strictEqual(p.extensionWordHunt(a + 5, a + 1, 0, 7, 99), a + 2);
  assert.strictEqual(p.extensionWordHunt(a, a, 0, -1, 0), a);
  assert.strictEqual(p.extensionWordHunt(a, a + 2, 0, 7, 7), 0);
  assert.strictEqual(p.extensionWordHunt(a, a + 4, 1, -2, 0), a);
  assert.strictEqual(p.extensionWordHunt(a, a + 4, -1, -2, 0), a + 2);
  assert.throws(() => p.extensionWordHunt(a, a + 10, 0, -1, 0), /bounds/);
  assert.throws(() => p.extensionWordHunt(a + 8, a + 8, 0, 0, 0), /bounds/);
  assert.throws(() => p.extensionWordHunt(4, 6, 0, 0, 0), /bounds/);
  p.stop();
});

test('Extension profiles: CLI, standalone page and saved project builds use the same mapping', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'amos-extensions-'));
  try {
    const source = binary([[t('Print'), fn(8, 0x16dc, n(5))], [t('End')]]), input = path.join(dir, 'Main.AMOS'), output = path.join(dir, 'game.js');
    fs.writeFileSync(input, source);
    const cli = spawnSync(process.execPath, ['bin/amoscript', '--extension', '8=amcaf-1.50beta4', input, output], { encoding: 'utf8' });
    assert.strictEqual(cli.status, 0, cli.stderr);
    const sandbox = { module: { exports: {} } }; vm.runInNewContext(fs.readFileSync(output, 'utf8'), sandbox);
    assert.deepStrictEqual(start(sandbox.module.exports).logs, [[-1]]);
    const { buildGamePage } = require('../tools/build_game_page'), project = require('../tools/project');
    assert.throws(() => buildGamePage(source), /Unsupported extension/);
    const html = buildGamePage(source, { extensions: mappings }); assert.ok(html.includes('extensionOdd('));
    const p = { version: 1, main: input, mounts: [], options: { extensions: mappings } }, filename = path.join(dir, 'game.amos-project.json');
    project.saveProject(filename, p); const loaded = project.loadProject(filename);
    assert.deepStrictEqual(loaded.options.extensions, mappings);
    assert.ok(project.buildProject(loaded).html.includes('extensionOdd('));
    const page = path.join(dir, 'game.html');
    const cliPage = spawnSync(process.execPath, ['tools/build_game_page.js', input, page, '--extension', '8=amcaf-1.50beta4'], { encoding: 'utf8' });
    assert.strictEqual(cliPage.status, 0, cliPage.stderr); assert.ok(fs.existsSync(page));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
