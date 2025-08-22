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

test('e2e: nested For/Next from Test14.AMOS', () => {
  const buf = fs.readFileSync(path.join(__dirname, '..', 'examples', 'Test14.AMOS'));
  const create = compileModuleFromBuffer(buf);

  const logs = [];
  const orig = console.log;
  console.log = (...args) => logs.push(args.join(','));
  try {
    const prog = create({ setTimeout: (fn) => fn() });
    // Run enough ticks to finish nested loops
    for (let i = 0; i < 1000; i++) {
      const r = prog.tick(1000);
      if (r.halted) break;
    }
  } finally {
    console.log = orig;
  }

  assert.deepStrictEqual(logs, [
    '1,1','1,2',
    '2,1','2,2',
    '3,1','3,2',
    '4,1','4,2',
  ]);
});

