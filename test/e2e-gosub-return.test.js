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

test('e2e: Test21.AMOS control flow order', () => {
  const buf = fs.readFileSync(path.join(__dirname, '..', 'examples', 'Test21.AMOS'));
  const create = compileModuleFromBuffer(buf);

  const logs = [];
  const origLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    const prog = create({ setTimeout: (fn) => fn() });
    prog.tick(1000);
    const seqAll = logs.filter(x => x === 'Start' || x === 'One' || x === 'Two' || x === 'Three' || x === 'End');
    const seq = seqAll.filter((v, i) => i === 0 || v !== seqAll[i - 1]);
    assert.deepStrictEqual(seq, ['Start', 'One', 'Two', 'Three', 'End']);
  } finally {
    console.log = origLog;
  }
});
