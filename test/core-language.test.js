/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const Transpiler = require('../lib/Transpiler');
const { token: t, integer: n, identifier: v, text, word, dword, binary, example, execute, compile } = require('./helpers/program');
const forHeader = (name, start, end, step = null) => [t('For'), word(0), v(name), t('='), n(start), t('To'), n(end), ...(step == null ? [] : [t('Step'), n(step)])];
const proc = (name, parameters = []) => [t('Procedure'), dword(0), word(0), 0, 0, v(name), ...(parameters.length ? [t('['), parameters.flatMap((p, i) => [...(i ? t(',') : []), ...v(p)]), t(']')] : [])];
const call = (name, args = []) => [v(name, 0x12), ...(args.length ? [t('['), args.flatMap((arg, i) => [...(i ? t(',') : []), ...arg.flat(Infinity)]), t(']')] : [])];

test('core: control-flow and integer/string fixtures have exact output', () => {
  const expected = new Map([
    [1, [['Hallo']]], [2, [['Hallo']]], [3, [[6]]],
    [4, Array.from({ length: 10 }, (_, i) => ['Number', i + 1])],
    [5, [["Hello I'm ", 'Daniel']]], [6, [['Test'], [2]]],
    [8, [['Hallo'], [1], ['End']]],
    [13, [2, 5, 8, 11, 14, 17, 20].map(x => [x])],
    [14, [1, 2, 3, 4].flatMap(x => [[x, 1], [x, 2]])],
    [15, [1, 2, 3, 4, 1, 2, 3, 4].map(x => [x])],
    [16, [1, 2, 3, 4, 5].map(x => [x])],
    [17, [[1], ['Done']]], [18, [[1], ['Done']]],
    [20, Array.from({ length: 15 }, (_, i) => [5 + i * 4])],
    [21, ['Start', 'One', 'Two', 'Three', 'End'].map(x => [x])],
    [22, [[9]]], [23, [['Not 4'], ['One'], ['Not nine']]]
  ]);
  for (const [number, logs] of expected) {
    const result = execute(example(number));
    assert.deepStrictEqual(result.logs, logs, `Test${number}`);
    assert.strictEqual(result.program.state.halted, true, `Test${number} should halt`);
    assert.strictEqual(result.timers.pending(), 0);
  }
});

test('core: expression functions and final variables are observable', () => {
  assert.ok(Math.abs(execute(example(12)).logs[0][0] - (Math.sin(3 + 5.099999904632568) + 1)) < 0.000001);
  const { variables } = execute(example(24)).program.state;
  assert.strictEqual(variables.int_a, ((1 & 2) | 3) ^ 4);
  assert.strictEqual(variables.int_b, 0);
  // AMOS evaluates operators by token order: division precedes multiplication.
  assert.strictEqual(variables.int_c, 3);
});

test('core: descending For loops and AMOS initial-body execution', () => {
  const data = binary([
    forHeader('i', 3, 1, -1), [t('Print'), v('i')], [t('Next'), v('i')],
    forHeader('i', 5, 1), [t('Print'), text('once')], [t('Next')]
  ]);
  assert.deepStrictEqual(execute(data).logs, [[3], [2], [1], ['once']]);
});

test('core: While/Wend and Repeat/Until check at opposite ends', () => {
  const data = binary([
    [t('While'), word(0), n(0)], [t('Print'), text('unexpected')], [t('Wend')],
    [t('Repeat'), word(0)], [t('Inc'), v('a')], [t('Until'), v('a'), t('>='), n(3)],
    [t('While'), word(0), v('a'), t('<'), n(5)], [t('Inc'), v('a')], [t('Wend')],
    [t('Print'), v('a')]
  ]);
  assert.deepStrictEqual(execute(data).logs, [[5]]);
});

test('core: nested conditionals and true comparisons use AMOS -1', () => {
  const data = binary([
    [t('If'), word(0), n(0)], [t('Print'), text('unexpected')],
    [t('Else'), word(0)], [t('If'), word(0), n(1)],
    [t('Print'), n(1), t('='), n(1)],
    [t('Else'), word(0)], [t('Print'), text('unexpected')],
    [t('Endif')], [t('Endif')]
  ]);
  assert.deepStrictEqual(execute(data).logs, [[-1]]);
});

test('core: defaults, typed names, case folding and identifier escaping', () => {
  const data = binary([
    [v('A_B'), t('='), n(8)], [v('a_5f_b'), t('='), n(9)],
    [t('Print'), v('a_b'), t(','), v('A_5F_B'), t(','), v('unused'), t(','), v('unused', 6, 1), t(','), v('unused', 6, 2)]
  ]);
  assert.deepStrictEqual(execute(data).logs, [[8, 9, 0, 0, '']]);
});

test('core: procedures initialize fresh locals on each call and isolate globals', () => {
  const data = binary([
    [v('a'), t('='), n(99)], proc('p'), [t('Inc'), v('a')],
    [t('Print'), v('a')], [t('End Proc')], call('p'), call('p'), [t('Print'), v('a')]
  ]);
  const { logs, program } = execute(data);
  assert.deepStrictEqual(logs, [[1], [1], [99]]);
  assert.strictEqual(program.state.frames.length, 0);
});

test('core: recursive procedures restore parameter frames', () => {
  const data = binary([
    proc('p', ['a']),
    [t('If'), word(0), v('a'), t('>'), n(0), t('Then'), call('p', [[v('a'), t('-'), n(1)]])],
    [t('Print'), v('a')], [t('End Proc')], call('p', [n(3)])
  ]);
  const { logs, program } = execute(data);
  assert.deepStrictEqual(logs, [[0], [1], [2], [3]]);
  assert.strictEqual(program.state.frames.length, 0);
});

test('core: invalid blocks, procedure calls and encoded unsupported forms are diagnosed', () => {
  const inputs = [
    [binary([forHeader('a', 1, 2), [t('Next'), v('b')]]), /Next variable/],
    [binary([forHeader('a', 1, 2)]), /Unclosed For/],
    [binary([[t('If'), word(0), n(1)]]), /Unclosed If/],
    [binary([[t('Else'), word(0)]]), /Mismatched/],
    [binary([[t('Do'), word(0)], [t('Wend')]]), /Mismatched/],
    [binary([call('missing')]), /Unknown procedure/],
    [binary([proc('p', ['a']), [t('End Proc')], call('p')]), /Wrong argument count/],
    [binary([[t('Exit'), word(0), word(0)]]), /Exit outside loop/],
    [binary([[t('Procedure'), dword(0), word(0), 0x20, 0, v('p')]]), /encrypted or compiled/]
  ];
  for (const [data, message] of inputs) assert.throws(() => new Transpiler(data), message);
});

test('core: invalid Return in Test19 fails with a source location', () => {
  assert.throws(() => execute(example(19)), /Return without Gosub at line 4, byte/);
});

test('core: Wait and Wait Vbl suspend without skipping forward on manual ticks', () => {
  for (const [number, duration] of [[9, 1000], [11, 20]]) {
    const { logs, program, timers } = execute(example(number), 2);
    assert.deepStrictEqual(logs, [['One']]);
    assert.strictEqual(program.state.waiting, 'sleep');
    assert.strictEqual(timers.pending(), 1);
    assert.strictEqual(program.tick(10).steps, 0);
    timers.tick(duration - 1);
    assert.deepStrictEqual(logs, [['One']]);
    timers.tick(1);
    assert.deepStrictEqual(logs, [['One'], ['Two']]);
    assert.strictEqual(program.state.halted, true);
    assert.strictEqual(timers.pending(), 0);
  }
});

test('core: Wait Key consumes buffered input or resumes on new input', () => {
  const { logs, program, timers } = execute(example(10));
  assert.deepStrictEqual(logs, [['One']]);
  assert.strictEqual(program.state.waiting, 'key');
  assert.strictEqual(timers.pending(), 0);
  program.sendKey('Enter');
  timers.runAll();
  assert.deepStrictEqual(logs, [['One'], ['Two']]);
  assert.strictEqual(program.state.halted, true);
  const create = compile(example(10)).create;
  const buffered = create({ setTimeout: timers.setTimeout, print() {} });
  buffered.sendKey('Enter');
  buffered.tick(100);
  assert.strictEqual(buffered.state.halted, true);
});

test('core: text host preserves semicolons, tab stops and trailing separators', () => {
  const data = binary([
    [t('Print'), text('AM'), t(';')],
    [t('Print'), text('OS'), t(','), text('next'), t(';'), text('!')], [t('Print')]
  ]);
  let output = '';
  const program = compile(data).create({ setTimeout() {}, write: text => { output += text; } });
  program.tick(100);
  assert.strictEqual(output, 'AMOS    next!\n\n');
});
