/* jshint esversion: 6 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const Transpiler = require('../lib/Transpiler');
const { buildGamePage } = require('./build_game_page');
const root = path.join(__dirname, '..');
const escape = text => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const preview = file => `https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/${file}`;
function buildTutorial({ source = path.join(root, 'examples/Tutorial'), modules = false, repository = false } = {}) {
  const outputs = new Map(), programs = [], assets = {};
  function walk(directory) {
    return fs.readdirSync(directory, {withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(entry => {
      const file = path.join(directory,entry.name);
      return entry.isDirectory() ? walk(file) : entry.isFile() ? [file] : [];
    });
  }
  const inputs = walk(source);
  for (const filename of inputs) {
    const relative = path.relative(source,filename).replace(/\\/g,'/');
    const bytes = fs.readFileSync(filename);
    // Detect programs by their native header, including versioned backups.
    if (!/^AMOS (?:Basic|Pro)/.test(bytes.subarray(0,16).toString('latin1'))) {
      const key = relative.toLowerCase(), value = bytes.toString('base64');
      assets[key] = value; assets['amospro_tutorial:'+key] = value;
    }
  }
  for (const filename of inputs) {
    const bytes = fs.readFileSync(filename);
    if (!/^AMOS (?:Basic|Pro)/.test(bytes.subarray(0,16).toString('latin1'))) continue;
    const relative = path.relative(source,filename).replace(/\\/g,'/');
    const name = relative.replace(/[^a-z0-9]+/gi,'-').toLowerCase();
    const file = `${repository ? 'tutorial-' : ''}${name}.html`;
    const item = {source:relative,file,byteLength:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
    if(relative==='Tutorials/Menus/Menus_6.AMOS'&&item.sha256==='455be1772dc073fd67708235d821e50bcef49eb17b851a5ec8be87e4cce1ebf6')item.sourceCorrection='Line 179: six demo items branch to labels 1–6; the supplied unused seventh target had no label. Native source offsets are preserved. The original is retained in test/fixtures/tutorial/menus6-original.amos.';
    const nav = `<nav><a href="${repository ? preview('tutorial.html') : 'index.html'}">Tutorial catalogue</a> · <a href="${repository ? 'tutorial.html' : 'index.html'}">Local catalogue</a></nav>`;
    try {
      const module = new Transpiler(bytes).toModule({optimize:true});
      const page = buildGamePage(bytes,{title:relative,assets,debug:true,optimize:true});
      outputs.set(file,page.replace('<h1>',nav+'<p>AMOS tutorial. Compilation does not guarantee completed execution; the Debug menu reports runtime limits. Select Keyboard: Typing for text prompts. Hold the right mouse button to open AMOS menus, point to an item, then release to select.</p>'+(item.sourceCorrection?'<p><strong>Source correction:</strong> '+escape(item.sourceCorrection)+'</p>':'')+'<h1>'));
      if (modules) outputs.set(name+'.module.js',module);
      item.compiled = true;
    } catch (error) {
      item.compiled = false; item.error = error.message;
      outputs.set(file,document(relative,nav+`<h1>${escape(relative)}</h1><p>This source does not compile yet. It is listed here so the collection includes every supplied program and its current blocker.</p><pre>${escape(item.error)}</pre>`));
    }
    programs.push(item);
  }
  const compiled = programs.filter(p=>p.compiled).length;
  const groups = new Map();
  for (const p of programs) {
    const parts = p.source.split('/');
    const group = parts[0] !== 'Tutorials' ? 'Editor accessory' : parts.length > 2 ? parts[1] : 'Core tutorials';
    if (!groups.has(group)) groups.set(group,[]);
    groups.get(group).push(p);
  }
  outputs.set(repository ? 'tutorial.html' : 'index.html',document('AMOS Tutorial',`<nav><a href="${repository ? preview('index.html') : '../index.html'}">Demo index</a></nav><h1>AMOS Tutorial</h1><p>${compiled}/${programs.length} original program files compile. Every program, including versioned backups and the editor accessory, has a page below. Built pages embed the supplied assets, sound/fullscreen controls and debug tools. Build status is separate from runtime compatibility; these are development demos.</p>${[...groups].map(([group,items])=>`<h2>${escape(group)}</h2><ul>${items.map(p=>`<li><a href="${p.file}">${escape(p.source)}</a>${repository ? ` · <a href="${preview(p.file)}">HTML Preview</a>` : ''} — ${p.compiled?'builds':`blocked: <code>${escape(p.error)}</code>`}</li>`).join('')}</ul>`).join('')}`));
  outputs.set(repository ? 'tutorial-manifest.json' : 'manifest.json',JSON.stringify({programs},null,2)+'\n');
  return {outputs,programs,assets};
}
function document(title,body) { return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>body{font:16px system-ui;max-width:65rem;margin:2rem auto;padding:1rem;background:#101721;color:#eef2f6}a{color:#9bc9ff}li{margin:1rem 0}pre,code{white-space:pre-wrap;overflow-wrap:anywhere}</style>${body}</html>\n`; }
if (require.main===module) {
  const args=process.argv.slice(2), source=path.resolve(args[0]||path.join(root,'examples/Tutorial')), directory=path.resolve(args[1]||path.join(root,'Tutorial/build'));
  if(directory===source||source.startsWith(directory+path.sep)||directory.startsWith(source+path.sep))throw Error('Input and output directories must be separate');
  const {outputs,programs}=buildTutorial({source,modules:true});
  fs.mkdirSync(directory,{recursive:true});
  for(const [name,contents] of outputs)fs.writeFileSync(path.join(directory,name),contents);
  for(const p of programs)console.log(`${p.compiled?'Built':'FAILED'} ${p.source}${p.error?': '+p.error:''}`);
  console.log(`${programs.filter(p=>p.compiled).length}/${programs.length} compiled. Catalogue: ${path.join(directory,'index.html')}`);
  if(programs.some(p=>!p.compiled)||!programs.length)process.exitCode=1;
}
module.exports={buildTutorial};
