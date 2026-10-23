/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execute } = require('./helpers/program');
const { createMemoryFiles } = require('../lib/amos/files');
const directory = path.join(__dirname, 'fixtures/conformance');

for (const filename of fs.readdirSync(directory).filter(name => name.endsWith('.json')).sort()) {
  const fixture = JSON.parse(fs.readFileSync(path.join(directory, filename), 'utf8'));
  test(`conformance (${fixture.evidence.kind}): ${fixture.name}`, () => {
    assert.ok(['source-analysis', 'reference-execution'].includes(fixture.evidence.kind));
    assert.ok(fixture.source && fixture.evidence.url && fixture.evidence.notes);
    if (fixture.evidence.kind === 'reference-execution') {
      for (const field of ['implementation', 'version', 'environment', 'command', 'recordedDate']) {
        assert.ok(fixture.evidence[field], `Missing reference execution ${field}`);
      }
    }
    assert.match(fixture.programHex, /^(?:[0-9a-f]{2})+$/i);
    const files = fixture.files && createMemoryFiles(Object.fromEntries(Object.entries(fixture.files).map(([name, hex]) => {
      assert.match(hex, /^(?:[0-9a-f]{2})*$/i);
      return [name, Buffer.from(hex, 'hex').toString('latin1')];
    })));
    const { logs, program, timers } = execute(Buffer.from(fixture.programHex, 'hex'), 1000, { files });
    assert.deepStrictEqual(logs, fixture.expected.values);
    assert.strictEqual(program.state.halted, fixture.expected.halted);
    assert.strictEqual(timers.pending(), 0);
  });
}
