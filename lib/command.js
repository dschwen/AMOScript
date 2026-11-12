/* jshint esversion: 6 */
'use strict';

const fs = require('fs');
const Transpiler = require('./Transpiler');
const { parseMappings } = require('./ExtensionProfiles');
const usage = 'Usage: amoscript [--optimize] [--debug] [--minify] [--runtime shared|full|minimal] [--extension SLOT=LIBRARY] <input.AMOS> [output.js]\nTranspile tokenized AMOS to Node/browser JavaScript (full bundled runtime by default).\n';

module.exports.run = (args = process.argv.slice(2)) => {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    process.stdout.write(usage);
    return 0;
  }
  let runtime='full';
  const mappings = [];
  const remaining = [];
  for (let i = 0; i < args.length; i++) {
    if(args[i]==='--runtime'){if(++i===args.length){process.stderr.write('Missing value for --runtime\n');return 1;}runtime=args[i];}
    else if (args[i] === '--extension') {
      if (++i === args.length) { process.stderr.write('Missing value for --extension\n'); return 1; }
      mappings.push(args[i]);
    } else remaining.push(args[i]);
  }
  args = remaining;
  const optimize = args.includes('--optimize');
  const debug=args.includes('--debug'),minify=args.includes('--minify');
  args = args.filter(arg => !['--optimize','--debug','--minify'].includes(arg));
  if (args.length < 1 || args.length > 2 || args.some(arg => arg.startsWith('-'))) {
    process.stderr.write(usage);
    return 1;
  }
  const [input, output] = args;
  try {
    require('./runtimeMode')(runtime);
    const source = new Transpiler(fs.readFileSync(input), { extensions: parseMappings(mappings) }).toModule({ optimize, debug, minify, runtime }) + '\n';
    if(runtime==='shared'&&!output)throw Error('Shared runtime output requires an output filename.');
    if (output) require('./writeArtifacts')(output,source,runtime==='shared'?{'libamoscript.js':require('../tools/build_game_page').buildRuntimeLibrary({minify})}:{});
    else process.stdout.write(source);
    return 0;
  } catch (error) {
    const message = error.code === 'EEXIST' ? `Refusing to overwrite output file ${output}` : error.message;
    process.stderr.write(`${input}: ${message}\n`);
    return 1;
  }
};
