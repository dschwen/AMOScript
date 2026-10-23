/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const programs = require('../tools/build_examples');
const { execute, compile } = require('./helpers/program');
const { createMemoryFiles } = require('../lib/amos/files');

test('examples: new AMOS and ASCII fixtures are reproducible', () => {
  for (const [name, program] of Object.entries(programs)) {
    assert.deepStrictEqual(fs.readFileSync(path.join(__dirname, '../examples', `${name}.AMOS`)), program.data);
    assert.strictEqual(fs.readFileSync(path.join(__dirname, '../examples', `${name}.Asc`), 'utf8'), program.source);
  }
});

test('examples: ArraysData reads multidimensional arrays and restores labeled data', () => {
  assert.deepStrictEqual(execute(programs.ArraysData.data).logs, [[1, 6], ['AMOS', 'cript'], [1]]);
});

test('examples: SequentialFile round-trips through the host filesystem contract', () => {
  const files = createMemoryFiles();
  const logs = [];
  const program = compile(programs.SequentialFile.data).create({ setTimeout() {}, files, print: (...args) => logs.push(args) });
  program.tick(1000);
  assert.deepStrictEqual(logs, [['AMOS', ' ', 42]]);
  assert.strictEqual(files.read('greetings.txt'), 'AMOS,42\r\n');
});

test('examples: Graphics embeds image banks and pastes Bob/Icon transparency through standalone output', () => {
  const { program } = execute(programs.Graphics.data);
  assert.strictEqual(program.state.waiting, 'key');
  assert.strictEqual(program.banks.size, 2);
  assert.strictEqual(program.display.point(200, 104), 4);
  assert.strictEqual(program.display.point(256, 104), 0);
  assert.strictEqual(program.display.point(205, 109), 2);
  assert.strictEqual(program.display.point(204, 108), 5);
  assert.strictEqual(program.display.point(203, 106), 3);
  program.stop();
});

test('examples: moving Bobs animate with deterministic waits and restore the original background', () => {
  const { program, timers } = execute(programs.Bobs.data);
  const physical = (x, y) => program.display.screen().physicalPixels[y * 320 + x];
  assert.strictEqual(program.state.waiting, 'key');
  assert.strictEqual(program.display.point(40, 112), 5);
  assert.strictEqual(program.state.variables.int_hitstart, -1);
  assert.strictEqual(program.state.variables.int_otherstart, 1);
  assert.strictEqual(physical(40, 112), 4);
  program.sendKey('x'); timers.runAll();
  assert.strictEqual(program.state.waiting, 'key');
  assert.strictEqual(program.display.point(40, 112), 4);
  assert.strictEqual(physical(40, 112), 5);
  program.sendKey('x'); timers.runAll();
  assert.strictEqual(program.state.waiting, 'key');
  assert.strictEqual(program.bobInfo('X Bob', 0), 124);
  assert.strictEqual(program.bobInfo('X Bob', 1), 144);
  assert.strictEqual(program.state.variables.int_hitend, 0);
  assert.strictEqual(program.state.variables.int_otherend, 0);
  assert.strictEqual(physical(40, 112), 4);
  assert.strictEqual(physical(124, 112), 5);
  assert.strictEqual(physical(128, 112), 4); // Limit Bob clips the right border.
  program.sendKey('x'); timers.runAll();
  assert.strictEqual(program.state.halted, true);
  assert.strictEqual(program.bobs.size, 0);
  assert.strictEqual(program.display.point(124, 112), 4);
  assert.strictEqual(physical(124, 112), 4);
});
