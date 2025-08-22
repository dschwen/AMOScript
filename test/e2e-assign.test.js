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

test('e2e: assignment + variable print from Test2.AMOS', () => {
  const buf = fs.readFileSync(path.join(__dirname, '..', 'examples', 'Test2.AMOS'));
  const create = compileModuleFromBuffer(buf);

  const logs = [];
  const orig = console.log;
  console.log = (...a) => logs.push(a.join(' '));
  try {
    const prog = create({ setTimeout: (fn) => fn() });
    prog.tick(100);
    assert.ok(logs.includes('Hallo'));
  } finally {
    console.log = orig;
  }
});

