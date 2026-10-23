/* jshint esversion: 6 */
'use strict';

const fs = require('fs');
const path = require('path');
const Transpiler = require('../lib/Transpiler');

const demos = [
  ['Test21.AMOS', 'compiled-demo.js'],
  ['Graphics.AMOS', 'compiled-graphics.js'],
  ['Bobs.AMOS', 'compiled-bobs.js']
];

function buildDemos({ check = false, directory = path.join(__dirname, '..') } = {}) {
  const stale = [];
  for (const [input, output] of demos) {
    const filename = path.join(directory, 'examples', output);
    const source = new Transpiler(fs.readFileSync(path.join(directory, 'examples', input))).toModule() + '\n';
    if (!check) fs.writeFileSync(filename, source);
    else {
      let existing;
      try { existing = fs.readFileSync(filename, 'utf8'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (existing !== source) stale.push(`examples/${output}`);
    }
  }
  return stale;
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 1 || args[0] !== '--check')) throw new Error('Usage: node tools/build_demo.js [--check]');
    const stale = buildDemos({ check: args[0] === '--check' });
    if (stale.length) {
      console.error(`Generated demos are missing or stale:\n${stale.join('\n')}\nRun npm run build:demo and include the regenerated files.`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { buildDemos };
