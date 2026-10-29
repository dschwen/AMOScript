/* jshint esversion: 6 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const Transpiler = require('../lib/Transpiler');
const { buildGamePage } = require('./build_game_page');
const root = path.join(__dirname, '..');
const escape = text => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const preview = file => `https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/${file}`;
function buildCompilerExamples({ source = path.join(root, 'examples/CompilerExamples'), modules = false, repository = false } = {}) {
  const outputs = new Map(), programs = [], assets = {};
  function walk(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const filename = path.join(directory, entry.name);
      return entry.isDirectory() && entry.name !== 'build' ? walk(filename) : entry.isFile() ? [filename] : [];
    });
  }
  const inputs = walk(source);
  // Original distributions keep Graphics beside AMOS_versions. Pinned
  // repository fixtures keep both under one root. Ignore .uaem metadata.
  const assetInputs = inputs.map(filename => ({filename, relative:path.relative(source, filename)}));
  const graphics = path.join(path.dirname(source), 'Graphics');
  if (path.basename(source).toLowerCase() === 'amos_versions' && fs.existsSync(graphics)) {
    for (const filename of walk(graphics)) assetInputs.push({filename, relative:path.join('Graphics',path.relative(graphics,filename))});
  }
  for (const {filename, relative: name} of assetInputs.filter(entry => /\.(abk|iff|anim)$/i.test(entry.filename))) {
    const relative = name.replace(/\\/g, '/').toLowerCase();
    const bytes = fs.readFileSync(filename).toString('base64');
    assets[relative] = bytes;
    assets[`amospro_extras:compiler_examples/${relative}`] = bytes;
    assets[`amospro_extras:compiler_examples/amos_versions/${relative}`] = bytes;
  }
  for (const filename of inputs.filter(name => /\.amos$/i.test(name)).sort()) {
    const relative = path.relative(source, filename).replace(/\\/g, '/');
    const name = relative.replace(/\.amos$/i, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const file = `${repository ? 'compiler-example-' : ''}${name}.html`, bytes = fs.readFileSync(filename);
    const item = { source: relative, file, byteLength: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
    try {
      const module = new Transpiler(bytes).toModule({ optimize: true });
      const page = buildGamePage(bytes, {title: relative, assets, debug: true, optimize: true});
      outputs.set(file, page.replace('<h1>', `<p><a href="${repository ? preview('compiler-examples.html') : 'index.html'}">Compiler examples catalogue</a></p><p>Compiled original source. Some examples still require display modes or runtime behavior beyond the current implementation. Use Keyboard: Typing for Input prompts; click the canvas to focus it.</p><h1>`));
      if (modules) outputs.set(name + '.module.js', module);
      item.compiled = true;
    } catch (error) { item.compiled = false; item.error = error.message; }
    programs.push(item);
  }
  const index = repository ? 'compiler-examples.html' : 'index.html';
  outputs.set(index, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AMOS Compiler Examples</title><style>body{font:16px system-ui;max-width:60rem;margin:2rem auto;padding:1rem;background:#101721;color:#eef2f6}a{color:#9bc9ff}li{margin:1rem 0}</style><h1>AMOS Compiler Examples</h1><p>${programs.filter(p=>p.compiled).length}/${programs.length} original AMOS programs compile. These are development builds, with sound, fullscreen, typing controls and debug errors. Compilation does not imply completed execution. Unsupported display geometry and other runtime limits still affect some programs. Supplied graphics, animation files and Galax banks are embedded.</p><ul>${programs.map(p=>`<li>${p.compiled ? `<a href="${p.file}">${escape(p.source)}</a>${repository ? ` · <a href="${preview(p.file)}">HTML Preview</a>` : ''}` : `${escape(p.source)}: ${escape(p.error)}`}</li>`).join('')}</ul></html>\n`);
  outputs.set(repository ? 'compiler-examples-manifest.json' : 'manifest.json', JSON.stringify({programs}, null, 2) + '\n');
  return {outputs, programs, assets};
}
if (require.main === module) {
  const args = process.argv.slice(2);
  const source = path.resolve(args[0] || path.join(root, 'compiler_examples/AMOS_versions'));
  const directory = path.resolve(args[1] || path.join(root, 'compiler_examples/build'));
  if (directory === source || source.startsWith(directory + path.sep)) throw Error('Output must not contain the input directory');
  const {outputs, programs} = buildCompilerExamples({source, modules:true});
  fs.mkdirSync(directory, {recursive:true});
  for (const [name, content] of outputs) fs.writeFileSync(path.join(directory,name), content);
  for (const item of programs) console.log(`${item.compiled ? 'Built' : 'FAILED'} ${item.source}${item.error ? ': '+item.error : ''}`);
  console.log(`Catalogue: ${path.join(directory,'index.html')}`);
  if (!programs.length || programs.some(p=>!p.compiled)) process.exitCode=1;
}
module.exports = {buildCompilerExamples};
