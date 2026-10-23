/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

test('runner: awaits async tests, counts results and exits on rejection', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'amoscript-runner-'));
  try {
    fs.writeFileSync(path.join(directory, 'async.test.js'), [
      "test('async pass', async () => { await new Promise(resolve => setTimeout(resolve, 5)); });",
      "test('async failure', async () => { await new Promise(resolve => setTimeout(resolve, 5)); throw new Error('expected rejection'); });"
    ].join('\n'));
    const result = spawnSync(process.execPath, [path.join(__dirname, 'run.js'), directory], { encoding: 'utf8', timeout: 5000 });
    assert.strictEqual(result.status, 1);
    assert.match(result.stdout, /1 passed, 1 failed/);
    assert.match(result.stderr, /expected rejection/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
