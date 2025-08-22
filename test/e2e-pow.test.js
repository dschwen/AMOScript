'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Transpiler = require('../lib/Transpiler');
const driver = require('../lib/amos/driver');

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

test('e2e: exponent precedence from Test27.AMOS', () => {
  const buf = fs.readFileSync(path.join(__dirname, '..', 'examples', 'Test27.AMOS'));
  const create = compileModuleFromBuffer(buf);

  const logs = [];
  const origLog = console.log;
  console.log = (...args) => logs.push(args);
  try {
    const prog = create({ setTimeout: (fn) => fn() });
    prog.tick(100);

    const flat = logs.flat();
    const nums = flat.filter(v => typeof v === 'number');
    // Expect 27, 128, 2187 (order may interleave with comments; just check presence)
    function has(n) { return nums.includes(n); }
    assert.ok(has(27));
    assert.ok(has(128));
    assert.ok(has(2187));
  } finally {
    console.log = origLog;
  }
});

