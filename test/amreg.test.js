'use strict';
const assert = require('assert');
const { binary, token:t, integer:n, word:w, text, compile, execute } = require('./helpers/program');
const query = index => [t('Amreg'), t('('), n(index), t(')')];
test('Amreg: original global getter/setter is a signed word with integer expression typing', () => {
  assert.deepStrictEqual(t('Amreg'), [0x1f,0xa2]);
  const { program:p, logs } = execute(binary([[query(0),t('='),n(32768)], [query(25),t('='),n(65535)],
    [t('Print'),query(0),t(','),query(25),t(','),query(25),t('/'),n(2)]]));
  assert.deepStrictEqual(logs,[[-32768,-1,0]]); assert.strictEqual(p.amreg(1),0);
  p.setAmreg(1,65536); assert.strictEqual(p.amreg(1),0);
  for(const i of [-1,26]) { assert.throws(()=>p.amreg(i),/global AMAL register/); assert.throws(()=>p.setAmreg(i,1),/global AMAL register/); }
});
test('Amreg: factories are isolated and unsupported channel forms/type errors retain compiler guards', () => {
  const a=execute(binary([[query(3),t('='),n(99)]])).program,b=execute(binary([])).program;
  assert.strictEqual(a.amreg(3),99); assert.strictEqual(b.amreg(3),0);
  assert.throws(()=>compile(binary([[t('Print'),w(0x1fb0),t('('),n(0),t(','),n(1),t(')')]])),/Unsupported token/);
  assert.throws(()=>compile(binary([[query(0),t('='),text('no')]])),/numeric expression/);
  assert.throws(()=>execute(binary([[query(26),t('='),n(1)]])),/global AMAL register at line 1, byte 22/);
});
test('Planet Zybex registers: unchanged clear_amal preserves score/bullet count and resets all other globals', () => {
  const { program:p }=execute(require('./helpers/planetZybexRegisters')(),1000);
  assert.strictEqual(p.state.halted,true); assert.strictEqual(p.state.variables.int_score,1234); assert.strictEqual(p.state.variables.int_bullets,4);
  assert.deepStrictEqual(Array.from({length:26},(_,i)=>p.amreg(i)),Array.from({length:26},(_,i)=>i===9?1234:i===20?4:i>=1&&i<=8?100:0));
});
