/* jshint esversion: 6 */
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const Transpiler=require('../lib/Transpiler'),{buildGamePage}=require('./build_game_page');
const root=path.join(__dirname,'..'),extensions={8:'amcaf-1.50beta4'};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const {preview,github,link,text:md}=require('./demoLinks');
function document(title,body){return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>body{font:16px system-ui;max-width:65rem;margin:2rem auto;padding:1rem;background:#101721;color:#eef2f6}a{color:#9bc9ff}li{margin:1rem 0}pre,code{white-space:pre-wrap;overflow-wrap:anywhere}table{border-collapse:collapse}td,th{text-align:left;vertical-align:top;padding:.7rem;border-bottom:1px solid #456}</style>${body}</html>\n`;}
function buildAmcafExamples({source=path.join(root,'examples/AMCAF/AMCAF_Examples'),modules=false,repository=false}={}){
 const outputs=new Map(),programs=[],assets={},inventory=JSON.parse(fs.readFileSync(path.join(source,'../inventory.json'),'utf8'));
 for(const name of fs.readdirSync(path.join(source,'Data')).sort()){
  const bytes=fs.readFileSync(path.join(source,'Data',name)),key='data/'+name.toLowerCase();
  assets[key]=bytes.toString('base64');assets['amcaf_examples:'+key]=assets[key];
 }
 const index=repository?'amcaf-examples.md':'index.md';
 for(const name of fs.readdirSync(source).filter(name=>/\.amos$/i.test(name)).sort()){
  const slug=name.replace(/\.amos$/i,'').toLowerCase(),file=(repository?'amcaf-example-':'')+slug+'.html',bytes=fs.readFileSync(path.join(source,name));
  const record=inventory.find(p=>p.source===name);if(!record||record.sha256!==crypto.createHash('sha256').update(bytes).digest('hex'))throw Error('AMCAF source inventory differs: '+name);
  const item={source:name,file,bytes:bytes.length,sha256:record.sha256,extensions,runtime:name==='Protracker2.AMOS'?'Original frequency meters, note trail, packed music and mouse exit covered with Canvas/WebGL.':name==='QsinCosArcSqr.AMOS'?'Original input loop, three mouse directions, double-buffer publication and Escape exit covered.':'Not yet verified in browser checks.'};
  const nav=`<nav><a href="${repository?github(index):index}">AMCAF examples</a> · <a href="${index}">Local catalogue</a></nav>`;
  try{
   const module=new Transpiler(bytes,{extensions}).toModule({optimize:true});
   const app=buildGamePage(bytes,{extensions,title:'AMCAF — '+name,assets,debug:true,optimize:true});
   outputs.set(file,app.replace('<h1>',nav+`<p>Original AMCAF example. ${escape(item.runtime)} Compilation and runtime compatibility are reported separately. Select Keyboard: Typing for text prompts.</p><h1>`));
   if(modules)outputs.set(slug+'.module.js',module);
   item.compiled=true;
  }catch(error){item.compiled=false;item.runtime='Not executed: compilation blocked.';item.error=error.message;outputs.set(file,document(name,nav+`<h1>${escape(name)}</h1><p>This original example does not compile yet. Its source is retained unchanged and its current first blocker is shown below.</p><pre>${escape(item.error)}</pre><p>See the <a href="${repository?'https://github.com/dschwen/AMOScript/blob/master/docs/amcaf-examples.md':'../../docs/amcaf-examples.md'}">compatibility plan</a> for remaining command families and assets.</p>`));}
  programs.push(item);
 }
 if(repository)outputs.set('amcaf-hawkeye.html',buildGamePage(require('../test/helpers/amcafHawkeyeProgram')(),{extensions,title:'AMCAF — Hawkeye music harness',assets,debug:true,optimize:true}));
 const count=programs.filter(p=>p.compiled).length;
 outputs.set(index,`# Original AMCAF examples

${link('Demo gallery',repository?'index.md':github('index.md'))}

${count}/${programs.length} original programs compile. The original quick-maths example and Protracker2 music visualizer run with Canvas/WebGL. The remaining programs have explicit blocker pages. Sources, four original data files and the separately recovered 4 spirits module are under examples/AMCAF; builds select AMCAF 1.50beta4 in slot 8.

## Try the working examples

${link('Protracker2 — original music visualizer',repository?preview('amcaf-example-protracker2.html'):'protracker2.html')}: start the supplied Hawkeye tune, watch the frequency meters and note trail, then press a mouse button on the canvas to exit.

${link('Quick sine, cosine, angle and square root',repository?preview('amcaf-example-qsincosarcsqr.html'):'qsincosarcsqr.html')}: move the pointer to aim the line and resize the circle. Press Escape outside fullscreen or a mouse button to exit.

${link('Quick-maths browser checks and captured frames',preview('amcaf-quick-maths.html'))}

${link('Protracker status and VU support checks',preview('amcaf-status.html'))}.

${link('String, shift and raw Work-file support checks',preview('amcaf-utilities.html'))} — a synthetic compatibility demo for the shared utilities needed by the remaining examples.

${link('Blitter graphics and original Protracker2 browser checks',preview('amcaf-blitter.html'))}.

## Music support preview

${link('Play Hawkeye with AMCAF voice controls',preview('amcaf-hawkeye.html'))}. A declared compiled harness loads the original packed module into a chip Work bank. Press keys to disable voice 1, re-enable it, then stop. Protracker2 now has its own original visualizer page above; the first Protracker version remains blocked. ${link('Voice DMA and native audio graph checks',preview('amcaf-voice.html'))}.

## Complete collection

| Program | Build | Runtime evidence / first blocker |
| --- | --- | --- |
${programs.map(p=>`| ${link(p.source,repository?preview(p.file):p.file)} | ${p.compiled?'Compiles':'Blocked'} | ${md(p.compiled?p.runtime:p.error)} |`).join('\n')}

${link('Rebuild instructions, scope and implementation plan',repository?'../docs/amcaf-examples.md':'https://github.com/dschwen/AMOScript/blob/master/docs/amcaf-examples.md')}
`);
 outputs.set(repository?'amcaf-examples-manifest.json':'manifest.json',JSON.stringify({profile:extensions,programs},null,2)+'\n');
 return{outputs,programs,assets};
}
if(require.main===module){
 const args=process.argv.slice(2),source=path.resolve(args[0]||path.join(root,'examples/AMCAF/AMCAF_Examples')),directory=path.resolve(args[1]||path.join(root,'build/amcaf-examples'));
 if(directory===source||source.startsWith(directory+path.sep)||directory.startsWith(source+path.sep))throw Error('Input and output directories must be separate');
 const result=buildAmcafExamples({source,modules:true});fs.mkdirSync(directory,{recursive:true});for(const[name,bytes]of result.outputs)fs.writeFileSync(path.join(directory,name),bytes);
 for(const p of result.programs)console.log(`${p.compiled?'Built':'BLOCKED'} ${p.source}${p.error?': '+p.error:''}`);
 console.log(`${result.programs.filter(p=>p.compiled).length}/${result.programs.length} compile. Catalogue: ${path.join(directory,'index.md')}`);
 if(result.programs.some(p=>!p.compiled))process.exitCode=1;
}
module.exports={buildAmcafExamples};
