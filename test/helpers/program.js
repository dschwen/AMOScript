/* jshint esversion: 6 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Transpiler = require('../../lib/Transpiler');
const tokens = require('./tokens');
const { createFakeTimers } = require('./fakeTimers');

function example(number) {
  return fs.readFileSync(path.join(__dirname, '../../examples', `Test${number}.AMOS`));
}

function compile(data) {
  const transpiler = new Transpiler(data);
  const sandbox = { module: { exports: {} }, console };
  // Deliberately omit require: generated output must be self-contained.
  vm.runInNewContext(transpiler.toModule(), sandbox, { filename: 'generated.js' });
  return { transpiler, create: sandbox.module.exports };
}

function execute(data, maxSteps = 1000, options = {}) {
  const { create, transpiler } = compile(data);
  const timers = createFakeTimers();
  const logs = [];
  const program = create({ ...options, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout, now: timers.now, print: (...args) => logs.push(args) });
  program.tick(maxSteps);
  return { program, timers, logs, transpiler };
}

module.exports = { ...tokens, example, compile, execute };
