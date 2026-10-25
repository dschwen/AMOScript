/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path');
const { binary, token: t, integer: n, text, identifier: id, word: w, dword, execute, compile } = require('./helpers/program');
const limits = [t('Limit Mouse Rectangle'), n(128), t(','), n(42), t('To'), n(447), t(','), n(312)];
const assign = (axis, value) => [t(`${axis} Mouse`), t('='), value];

test('Mouse assignment: independent doubled-word vectors, EntNul, axis isolation and inclusive explicit bounds', () => {
  const { program: p } = execute(binary([limits, [t('Wait Key')]]));
  p.setMouse(200, 100, 5); assert.strictEqual(p.inputValue('Mouse Click'), 5);
  for (const [value, expected] of [[128,128],[447,447],[448,447],[-1,447],[32767,447],[32768,128],[65535,447],[65536,128],[-65536,128]]) {
    p.setMouseAxis('x', value); assert.strictEqual(p.inputValue('X Mouse'), expected);
    assert.strictEqual(p.inputValue('Y Mouse'), 100); assert.strictEqual(p.inputValue('Mouse Key'), 5); assert.strictEqual(p.inputValue('Mouse Click'), 0);
  }
  p.setMouseAxis('x', 200); p.setMouseAxis('x', -2147483648); assert.strictEqual(p.inputValue('X Mouse'), 200);
  p.setMouseAxis('y', -1); assert.strictEqual(p.inputValue('Y Mouse'), 312);
  p.setMouseAxis('y', 65536); assert.strictEqual(p.inputValue('Y Mouse'), 42);
  const before = p.display.screen().physicalPixels.slice(); p.setMouseAxis('x', 250); assert.deepStrictEqual(p.display.screen().physicalPixels, before); p.stop();
});

test('Mouse assignment: standalone typed DATA, arrays, procedure results and dynamic numeric values evaluate once', () => {
  let reads = 0;
  const { program: p, logs } = execute(binary([limits,
    [t('Data'), w(0), n(201)], [t('Read'), id('x')], [t('Dim'), id('a'), t('('), n(0), t(')')],
    [id('a'), t('('), n(0), t(')'), t('='), id('x')], assign('X', [id('a'), t('('), n(0), t(')')]),
    [t('Procedure'), dword(0), w(0), 0, 0, id('value')], [t('End Proc'), t('['), n(150), t(']')], [id('value', 0x12)], assign('Y', t('Param')),
    [t('Print'), t('X Mouse'), t(','), t('Y Mouse')],
    assign('X', [t('Val'), t('('), text('222.9'), t(')')]), assign('Y', [t('Val'), t('('), text('155'), t(')')]),
    [t('Print'), t('X Mouse'), t(','), t('Y Mouse')],
    assign('X', [n(128), t('-'), t('Exist'), t('('), text('once'), t(')')]), [t('Print'), t('X Mouse')]
  ]), 1000, { files: { exists() { reads++; return true; } } });
  assert.deepStrictEqual(logs, [[201,150],[222,155],[129]]); assert.strictEqual(reads, 1); p.stop();
});

test('Mouse assignment: errors carry source context, explicit limits are required and host injection retains its contract', () => {
  assert.throws(() => compile(binary([assign('X', text('bad'))])), /numeric/);
  assert.throws(() => compile(binary([[t('Y Mouse'), n(3)]])), /Expected =/);
  assert.throws(() => execute(binary([assign('X', n(200))])), /explicit Limit Mouse bounds.*line 1, byte/);
  const converted = execute(binary([limits, assign('X', [t('Val'), t('('), text('bad'), t(')')])]));
  assert.strictEqual(converted.program.inputValue('X Mouse'), 128); converted.program.stop();
  const { program: a } = execute(binary([[t('Wait Key')]])), { program: b } = execute(binary([limits, [t('Wait Key')]]));
  a.setMouse(-500, 70000, 2); assert.deepStrictEqual({ ...a.state.input.mouse }, { x:-500,y:70000,buttons:2 });
  a.setMouseAxis('x', -2147483648); assert.strictEqual(a.inputValue('X Mouse'), -500);
  assert.throws(() => a.setMouseAxis('x', 1), /explicit Limit/); b.setMouseAxis('x', 250); b.stop(); b.resume();
  assert.strictEqual(b.inputValue('X Mouse'), 250); assert.strictEqual(a.inputValue('X Mouse'), -500); a.stop(); b.stop();
});

test('Roller2 mouse movement: original LIMM and four joystick branches move by two, yield on VBL and clamp without changing title pixels', () => {
  const title = fs.readFileSync(path.join(__dirname, '../examples/Roller2/iffp/roller titel'), 'latin1');
  const { program: p, timers: c } = execute(require('./helpers/roller2MenuMouse')(), 1000, { files: { read: () => title } });
  assert.strictEqual(p.state.waiting, 'key'); assert.deepStrictEqual({ ...p.state.input.mouseLimits }, { x1:128,y1:42,x2:447,y2:312 });
  p.setMouse(200, 100, 0); const before = p.display.screen().physicalPixels.slice();
  for (const [mask, x, y] of [[4,198,100],[8,200,100],[1,200,98],[2,200,100],[15,200,100]]) {
    p.setJoystick(1, mask); p.sendKey('step'); c.tick(0); assert.strictEqual(p.state.waiting, 'sleep'); c.tick(20);
    assert.strictEqual(p.state.waiting, 'key'); assert.deepStrictEqual([p.inputValue('X Mouse'),p.inputValue('Y Mouse')],[x,y]);
  }
  p.setMouse(128,42,0); p.setJoystick(1,5); p.sendKey('step'); c.tick(20); assert.deepStrictEqual([p.inputValue('X Mouse'),p.inputValue('Y Mouse')],[128,42]);
  p.setMouse(447,312,0); p.setJoystick(1,10); p.sendKey('step'); c.tick(20); assert.deepStrictEqual([p.inputValue('X Mouse'),p.inputValue('Y Mouse')],[447,312]);
  assert.strictEqual(p.state.variables.int_movj, -1); assert.deepStrictEqual(p.display.screen().physicalPixels, before); p.stop(); assert.strictEqual(c.pending(),0);
});
