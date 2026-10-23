/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildDemos } = require('../tools/build_demo');

test('generated artifacts: check reports stale and missing demos without rewriting files', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'amoscript-generated-'));
  try {
    const examples = path.join(directory, 'examples');
    fs.mkdirSync(examples);
    for (const name of ['Test21.AMOS', 'Graphics.AMOS', 'Bobs.AMOS']) {
      fs.copyFileSync(path.join(__dirname, '../examples', name), path.join(examples, name));
    }
    buildDemos({ directory });
    assert.deepStrictEqual(buildDemos({ check: true, directory }), []);
    const current = fs.readFileSync(path.join(examples, 'compiled-demo.js'), 'utf8');
    fs.writeFileSync(path.join(examples, 'compiled-graphics.js'), 'stale artifact\n');
    fs.unlinkSync(path.join(examples, 'compiled-bobs.js'));
    assert.deepStrictEqual(buildDemos({ check: true, directory }),
      ['examples/compiled-graphics.js', 'examples/compiled-bobs.js']);
    assert.strictEqual(fs.readFileSync(path.join(examples, 'compiled-demo.js'), 'utf8'), current);
    assert.strictEqual(fs.readFileSync(path.join(examples, 'compiled-graphics.js'), 'utf8'), 'stale artifact\n');
    assert.strictEqual(fs.existsSync(path.join(examples, 'compiled-bobs.js')), false);
    buildDemos({ directory });
    assert.deepStrictEqual(buildDemos({ check: true, directory }), []);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('generated artifacts: command checks current demos and rejects unknown arguments', () => {
  const command = args => spawnSync(process.execPath, [path.join(__dirname, '../tools/build_demo.js'), ...args], { encoding: 'utf8' });
  const current = command(['--check']);
  assert.strictEqual(current.status, 0, current.stderr);
  assert.strictEqual(current.stdout, '');
  const invalid = command(['--unknown']);
  assert.strictEqual(invalid.status, 1);
  assert.match(invalid.stderr, /Usage/);
});
