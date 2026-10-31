'use strict';
// Build the pinned, unmodified Joy Src1 input set. Empty uploads stay explicit.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const Transpiler = require('../lib/Transpiler');
const { buildGamePage, loadAssets } = require('./build_game_page');
function build(outputDirectory) {
  const root = path.resolve(__dirname, '../examples/Joy/Source1'), output = path.resolve(outputDirectory);
  if (root === output || root.startsWith(output + path.sep)) throw Error('Output must not contain the source directory');
  const manifest = require('../examples/Joy/Source1/manifest.json'), assets = loadAssets(path.join(root, 'manifest.json'));
  const report = [], outputs = new Map();
  for (const entry of manifest.sources) {
    const bytes = fs.readFileSync(path.join(root, entry.path));
    if (bytes.length !== entry.byteLength || crypto.createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw Error('Pinned source differs: ' + entry.path);
    const item = { ...entry };
    try {
      if (!bytes.length) throw Error('Empty source file (0 bytes); no program to compile');
      const compiler = new Transpiler(bytes); item.compiled = true; item.instructions = compiler._ops.length;
      item.module = entry.path + '.module.js'; item.page = entry.path + '.html';
      outputs.set(item.module, compiler.toModule());
      outputs.set(item.page, buildGamePage(bytes, { title: 'Joy Src1 — ' + entry.path, assets, debug: true, initialMouse: entry.path.startsWith('LabEdit') ? [133, 50, 0] : null }));
    } catch (error) { item.compiled = false; item.error = error.message; }
    report.push(item);
  }
  const escape = text => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  outputs.set('index.html', `<!doctype html><html lang="en"><meta charset="utf-8"><title>Joy Src1 builds</title><style>body{font:16px system-ui;max-width:65rem;margin:2rem auto;padding:1rem}li{margin:1rem 0}</style><h1>Joy Src1</h1><p>${report.filter(r => r.compiled).length}/${report.length} supplied sources compile. All three nonempty sources compile; four supplied files are empty. Pages embed the declared accompanying assets. Compilation does not establish full execution: Labyrinth.Bak currently reaches a checked bank-memory error at original line 70, which reads a neighbour before checking its bounds at line 71. The editors support keyboard/mouse and session files; Fsel$ requires a prepared selection.</p><ul>${report.map(r => `<li>${r.compiled ? `<a href="${escape(r.page)}">${escape(r.path)}</a> · <a href="${escape(r.module)}">JavaScript</a>` : escape(r.path + ': ' + r.error)}</li>`).join('')}</ul></html>\n`);
  outputs.set('report.json', JSON.stringify(report, null, 2) + '\n');
  fs.mkdirSync(output, { recursive: true });
  for (const [name, content] of outputs) fs.writeFileSync(path.join(output, name), content, { flag: 'wx' });
  for (const item of report) console.log(`${item.compiled ? 'PASS' : 'FAIL'} ${item.path}${item.error ? ': ' + item.error : ''}`);
  console.log(`Catalogue: ${path.join(output, 'index.html')}`);
  return report;
}
if (require.main === module) try {
  if (process.argv.length !== 3) throw Error('Usage: node tools/build_joy_source1.js NEW_OUTPUT_DIRECTORY');
  if (build(process.argv[2]).some(item => !item.compiled)) process.exitCode = 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
module.exports = build;
