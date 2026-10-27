/* jshint esversion: 6 */
'use strict';
// Compile outside measured sections; alternate paths and report medians, not a
// best run. This measures VM execution, excluding compilation and rendering.
const Transpiler = require('../lib/Transpiler');
const assert = require('assert');
const fixture = require('../test/helpers/optimizerProgram');
const currentAssets = require('../test/helpers/roller2CurrentAssets');
const replay = require('../test/helpers/roller2CurrentReplay');
const makeFiles = require('../test/helpers/roller2GameFiles');
const { createFakeTimers } = require('../test/helpers/fakeTimers');
function prepare(bytes) {
  return [false, true].map(optimize => {
    const source = new Transpiler(bytes).toModule({ optimize }), module = { exports: {} };
    new Function('module', source)(module);
    return { create: module.exports, bytes: Buffer.byteLength(source) };
  });
}
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
function measure(name, compiled, run) {
  const times = [[], []]; let details;
  for (let trial = 0; trial < 7; trial++) {
    const outcomes = [];
    for (const mode of trial % 2 ? [1, 0] : [0, 1]) {
      const start = process.hrtime.bigint();
      outcomes[mode] = run(compiled[mode].create);
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      if (trial >= 2) times[mode].push(ms);
    }
    assert.deepStrictEqual(outcomes[1].result, outcomes[0].result);
    details = outcomes[1];
  }
  const [reference, optimized] = times.map(median);
  return { name, referenceMs: +reference.toFixed(2), optimizedMs: +optimized.toFixed(2),
    speedup: +(reference / optimized).toFixed(3), moduleBytes: compiled.map(p => p.bytes),
    compilation: details.compilation, executed: details.executed, totalInstructions: details.totalInstructions, samplesMs: times };
}
const assets = currentAssets();
const results = [measure('scalar loop (2,000,000 original instructions)', prepare(fixture()), create => {
  const p = create({ setTimeout() {}, clearTimeout() {}, now: () => 0 });
  for (let i = 0; i < 2000; i++) p.tick(1000);
  const result = { ticks: p.state.ticks, ip: p.state.ip, variables: { ...p.state.variables } };
  p.stop(); return { result, compilation: p.compilation.optimization, executed: p.optimization, totalInstructions: p.state.ticks };
}), measure('Roller II current input-only milestone replay', prepare(Buffer.from(assets['rii:Roller II.AMOS'], 'latin1')), create => {
  const clock = createFakeTimers(4), files = makeFiles(assets); let p;
  const result = replay(opts => { p = create(opts); return p; }, clock, files,
    p => ({ joy: m => p.setJoystick(1, m), key: () => p.sendKey('a'), dispose() {} }));
  return { result, compilation: p.compilation.optimization, executed: p.optimization, totalInstructions: p.state.ticks };
})];
console.log(JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch,
  cpu: require('os').cpus()[0].model, warmups: 2, measuredRuns: 5, results }, null, 2));
