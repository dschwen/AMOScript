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
    require: (p) => {
      if (p === './amos/driver') return driver;
      return require(p);
    },
  };
  vm.runInNewContext(js, sandbox, { filename: 'out.module.js' });
  return sandbox.module.exports; // factory result is a function create(opts)
}

test('e2e: transpile Test1.AMOS and print Hallo', () => {
  const buf = fs.readFileSync(path.join(__dirname, '..', 'examples', 'Test1.AMOS'));
  const create = compileModuleFromBuffer(buf);

  const logs = [];
  const origLog = console.log;
  console.log = (...args) => { logs.push(args.join(' ')); };

  try {
    const ft = createFakeTimers();
    const prog = create({ setTimeout: ft.setTimeout, vblHz: 50, sleepScale: 1 });
    prog.tick(1000);
    // Flush any scheduled follow-ups
    ft.runAll();

    // Expect the string from the program
    assert.ok(logs.includes('Hallo'), 'expected Hallo in logs');
  } finally {
    console.log = origLog;
  }
});
