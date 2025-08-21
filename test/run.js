/* Minimal test runner: discovers test files and runs `test(name, fn)` blocks */
const fs = require('fs');
const path = require('path');

const tests = [];
global.test = (name, fn) => tests.push({ name, fn });

function isTestFile(filePath) {
  const base = path.basename(filePath);
  if (base === 'run.js') return false;
  return base.endsWith('.test.js') || base.startsWith('test-') || base === 'test-buffer.js';
}

function collect(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'helpers') continue;
      collect(full);
    } else if (isTestFile(full)) {
      require(full);
    }
  }
}

function run() {
  const start = Date.now();
  let passed = 0, failed = 0;
  for (const { name, fn } of tests) {
    try {
      const res = fn();
      if (res && typeof res.then === 'function') {
        // Simple async support
        res.then(() => {
          console.log('✓', name);
        }).catch((err) => {
          failed++;
          console.error('✗', name);
          console.error(err && err.stack || err);
        });
      } else {
        passed++;
        console.log('✓', name);
      }
    } catch (err) {
      failed++;
      console.error('✗', name);
      console.error(err && err.stack || err);
    }
  }
  const dur = Date.now() - start;
  console.log(`\n${passed} passed, ${failed} failed in ${dur}ms`);
  if (failed > 0) process.exitCode = 1;
}

collect(path.join(__dirname));
run();

