/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const { createFakeTimers } = require('./helpers/fakeTimers');
const { example } = require('./helpers/program');
const Transpiler = require('../lib/Transpiler');
const root = path.join(__dirname, '..');
const cli = path.join(root, 'bin/amoscript');

test('integration: CLI output runs in a separate directory without a runtime import', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'amoscript-cli-'));
  try {
    const output = path.join(directory, 'program.js');
    const result = spawnSync(process.execPath, [cli, path.join(root, 'examples/Test21.AMOS'), output], { encoding: 'utf8' });
    assert.strictEqual(result.status, 0, result.stderr);
    assert.strictEqual(result.stdout, '');
    const run = spawnSync(process.execPath, ['-e', "require('./program.js')({setTimeout}).tick(100)"], { cwd: directory, encoding: 'utf8', timeout: 5000 });
    assert.strictEqual(run.status, 0, run.stderr);
    assert.strictEqual(run.stdout, 'Start\nOne\nTwo\nThree\nEnd\n');
    const before = fs.readFileSync(output, 'utf8');
    const overwrite = spawnSync(process.execPath, [cli, path.join(root, 'examples/Test1.AMOS'), output], { encoding: 'utf8' });
    assert.strictEqual(overwrite.status, 1);
    assert.match(overwrite.stderr, /Refusing to overwrite/);
    assert.strictEqual(fs.readFileSync(output, 'utf8'), before);
    fs.writeFileSync(path.join(directory, 'broken.AMOS'), 'bad input');
    const invalid = spawnSync(process.execPath, [cli, path.join(directory, 'broken.AMOS')], { encoding: 'utf8' });
    assert.strictEqual(invalid.status, 1);
    assert.strictEqual(invalid.stdout, '');
    assert.match(invalid.stderr, /broken.AMOS:.*Truncated/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('integration: CLI help, stdout module output and missing-input errors', () => {
  const invoke = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  assert.strictEqual(invoke(['--help']).status, 0);
  const missing = invoke([]);
  assert.strictEqual(missing.status, 1);
  assert.strictEqual(missing.stdout, '');
  assert.match(missing.stderr, /Usage/);
  const result = invoke([path.join(root, 'examples/Test1.AMOS')]);
  assert.strictEqual(result.status, 0, result.stderr);
  const context = { module: { exports: {} } };
  vm.runInNewContext(result.stdout, context);
  let output = '';
  context.module.exports({ setTimeout() {}, write: text => { output += text; } }).tick(10);
  assert.strictEqual(output, 'Hallo\n');
  assert.strictEqual(require('..'), Transpiler);
});

test('integration: generated browser export loads through AMOS and forwards keyboard input', () => {
  const timers = createFakeTimers();
  const context = vm.createContext({ setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout });
  vm.runInContext(fs.readFileSync(path.join(root, 'lib/amos/background.js'), 'utf8'), context);
  vm.runInContext(new Transpiler(example(10)).toModule(), context);
  let output = '';
  context.AMOS.init({ write: text => { output += text; }, now: timers.now });
  context.AMOS.load(context.AMOS_MODULE);
  context.AMOS.run(10);
  assert.strictEqual(output, 'One\n');
  assert.strictEqual(context.AMOS.state.waiting, 'key');
  context.AMOS.sendKey('Enter');
  timers.runAll();
  assert.strictEqual(output, 'One\nTwo\n');
  assert.strictEqual(context.AMOS.state.halted, true);
});

test('integration: checked-in browser demo matches current compiler and page scripts execute', () => {
  const generated = new Transpiler(example(21)).toModule() + '\n';
  assert.strictEqual(fs.readFileSync(path.join(root, 'examples/compiled-demo.js'), 'utf8'), generated, 'Run npm run build:demo after changing codegen/runtime');
  const elements = Object.fromEntries(['run', 'graphics', 'bobs', 'stop', 'output', 'screen'].map(id => [id, { textContent: '', handlers: {}, addEventListener(event, fn) { this.handlers[event] = fn; }, removeEventListener(event) { delete this.handlers[event]; }, focus() {} }]));
  elements.screen.getContext = () => ({ createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} });
  const document = { getElementById: id => elements[id], addEventListener() {} };
  const context = vm.createContext({ document, setTimeout, clearTimeout });
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const match of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g)) {
    vm.runInContext(match[1] ? fs.readFileSync(path.join(root, match[1]), 'utf8') : match[2], context);
  }
  elements.run.handlers.click();
  assert.strictEqual(elements.output.textContent, 'Start\nOne\nTwo\nThree\nEnd\n');
  assert.strictEqual(fs.readFileSync(path.join(root, 'examples/compiled-graphics.js'), 'utf8'), new Transpiler(fs.readFileSync(path.join(root, 'examples/Graphics.AMOS'))).toModule() + '\n');
  assert.strictEqual(fs.readFileSync(path.join(root, 'examples/compiled-bobs.js'), 'utf8'), new Transpiler(fs.readFileSync(path.join(root, 'examples/Bobs.AMOS'))).toModule() + '\n');
  elements.stop.handlers.click();
});

test('integration: browser facade retains support for the original driver demo', () => {
  const timers = createFakeTimers();
  const logs = [];
  const context = vm.createContext({ setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout, console: { log: (...args) => logs.push(args.join(' ')) } });
  vm.runInContext('window = globalThis;', context);
  for (const file of ['lib/display/model/color.js', 'lib/display/reference/sprites.js', 'lib/amos/font.js', 'lib/amos/display.js', 'lib/amos/audio.js', 'lib/amos/operations.js', 'lib/amos/driver.js', 'lib/amos/background.js', 'examples/driver-demo.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  }
  context.driverDemoRun();
  timers.runAll();
  assert.deepStrictEqual(logs, [
    '[demo] start', '[demo] proc enter', '[demo] proc work', '[demo] proc return', '[demo] after call'
  ]);
  assert.strictEqual(context.AMOS.state.halted, true);
  const program = context.AMOS._program;
  program.display.clear(0); program.display.setColour(17, 0xf00);
  program.banks.set(1, { type: 'sprites', images: [{ width: 16, height: 1, depth: 1,
    hotspotX: 0, hotspotY: 0, pixels: Uint8Array.from([1, ...new Array(15).fill(0)]) }] });
  program.hideOn(); program.setSprite(0, 128, 50, 1); program.updateSprites();
  assert.deepStrictEqual(Array.from(program.display.rgba().slice(0, 4)), [255, 0, 0, 255]);
});

test('integration: browser output runs sequential files through the browser memory adapter', () => {
  const context = vm.createContext({ setTimeout() {} });
  vm.runInContext(fs.readFileSync(path.join(root, 'lib/amos/files.js'), 'utf8'), context);
  const data = fs.readFileSync(path.join(root, 'examples/SequentialFile.AMOS'));
  vm.runInContext(new Transpiler(data).toModule(), context);
  const files = context.AMOS_FILES.createMemoryFiles();
  let output = '';
  const program = context.AMOS_MODULE({ setTimeout() {}, files, write: text => { output += text; } });
  program.tick(1000);
  assert.strictEqual(output, 'AMOS 42\n');
  assert.strictEqual(files.read('greetings.txt'), 'AMOS,42\r\n');
});
