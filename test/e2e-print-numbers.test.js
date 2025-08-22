'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Transpiler = require('../lib/Transpiler');
const driver = require('../lib/amos/driver');
const { createFakeTimers } = require('./helpers/fakeTimers');

function compileModuleFromBuffer(buf) {
  const t = new Transpiler(buf);
  const js = t.toModule();
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console: console,
    require: (p) => (p === './amos/driver' ? driver : require(p)),
  };
  vm.runInNewContext(js, sandbox, { filename: 'out.module.js' });
  return sandbox.module.exports;
}

test('e2e: numeric prints from Test7.AMOS', () => {
  const buf = fs.readFileSync(path.join(__dirname, '..', 'examples', 'Test7.AMOS'));
  const create = compileModuleFromBuffer(buf);

  const logs = [];
  const origLog = console.log;
  console.log = (...args) => logs.push(args);
  try {
    const ft = createFakeTimers();
    const prog = create({ setTimeout: ft.setTimeout });
    prog.tick(100);
    ft.runAll();
    // Expect several numeric lines; spot-check a few
    const flat = logs.flat();
    function hasApprox(val, tol=1e-3) { return flat.some(v => typeof v === 'number' && Math.abs(v - val) < tol); }
    function hasExact(val) { return flat.some(v => v === val); }
    assert.ok(hasApprox(3.141, 5e-3));
    assert.ok(hasExact(-100));
    assert.ok(hasExact(10000));
  } finally {
    console.log = origLog;
  }
});
