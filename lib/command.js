/* jshint esversion: 6 */
'use strict';

const fs = require('fs');
const Transpiler = require('./Transpiler');
const { parseMappings } = require('./ExtensionProfiles');
const usage = 'Usage: amoscript [--optimize] [--extension SLOT=LIBRARY] <input.AMOS> [output.js]\nTranspile tokenized AMOS to a self-contained Node/browser JavaScript module.\n';

module.exports.run = (args = process.argv.slice(2)) => {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    process.stdout.write(usage);
    return 0;
  }
  const mappings = [];
  const remaining = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--extension') {
      if (++i === args.length) { process.stderr.write('Missing value for --extension\n'); return 1; }
      mappings.push(args[i]);
    } else remaining.push(args[i]);
  }
  args = remaining;
  const optimize = args.includes('--optimize');
  args = args.filter(arg => arg !== '--optimize');
  if (args.length < 1 || args.length > 2 || args.some(arg => arg.startsWith('-'))) {
    process.stderr.write(usage);
    return 1;
  }
  const [input, output] = args;
  try {
    const source = new Transpiler(fs.readFileSync(input), { extensions: parseMappings(mappings) }).toModule({ optimize }) + '\n';
    if (output) fs.writeFileSync(output, source, { flag: 'wx' });
    else process.stdout.write(source);
    return 0;
  } catch (error) {
    const message = error.code === 'EEXIST' ? `Refusing to overwrite output file ${output}` : error.message;
    process.stderr.write(`${input}: ${message}\n`);
    return 1;
  }
};
