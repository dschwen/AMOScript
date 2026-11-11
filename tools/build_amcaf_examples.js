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
  const item={source:name,file,bytes:bytes.length,sha256:record.sha256,extensions,runtime:name==='Iff2Raw.AMOS'?'Original raw/ByteRun1 IFF conversion with prepared synchronous selections, uploads and byte-checked downloads.':name==='SamBankFixer.AMOS'?'Original sample-bank playback, key prompt, PCM-word fix and saved-file download.':name==='Fonts.AMOS'?'Original Iva/Print banks, declared AROS topaz-compatible host font, bank capture/restore and both key exits covered with WebGL.':name==='Protracker.AMOS'?'Original music interface, recovered 4 spirits playback, voice/volume/tempo controls, pause/resume and mouse exit covered with WebGL. The recovered tune has no drum synchronization cues.':name==='Protracker2.AMOS'?'Original frequency meters, note trail, packed music and mouse exit covered with Canvas/WebGL.':name==='QsinCosArcSqr.AMOS'?'Original input loop, three mouse directions, double-buffer publication and Escape exit covered.':'Not yet verified in browser checks.'};
  const nav=`<nav><a href="${repository?github(index):index}">AMCAF examples</a> · <a href="${index}">Local catalogue</a></nav>`;
  try{
   const module=new Transpiler(bytes,{extensions}).toModule({optimize:true});
   const font= require('../examples/AMCAF/fonts/topaz-16.json');
   const diskFonts=name==='Fonts.AMOS'?[{...font,data:Uint8Array.from(Buffer.from(font.data,'base64'))}]:[];
   let app=buildGamePage(bytes,{diskFonts,extensions,title:'AMCAF — '+name,assets,debug:true,optimize:true});
   if(['Protracker.AMOS','Fonts.AMOS','Iff2Raw.AMOS','SamBankFixer.AMOS'].includes(name))app=app.replace('<option value="typing">','<option value="typing" selected>');
   if(name==='Fonts.AMOS')app=app.replace('<h1>','<p>This page supplies an AROS topaz-compatible 16-pixel font for the original named-font request. The Iva and Print fonts come from the original embedded banks. <a href="https://github.com/dschwen/AMOScript/blob/master/examples/AMCAF/fonts/README.md">Font source and APL 1.1 license</a>.</p><h1>');
   if(['Iff2Raw.AMOS','SamBankFixer.AMOS'].includes(name)){const kind=name==='Iff2Raw.AMOS'?'iff':'sample',fixture=require('../test/helpers/amcafUtilityFixtures')[kind==='iff'?'picture':'sample']();app=app.replace('</body>',`<script>(${require('./amcafUtilityPage').toString()})(${JSON.stringify(kind)},${JSON.stringify({name:kind==='iff'?'sample.iff':'sample.abk',data:fixture.input.toString('base64')})});</script></body>`);}
   outputs.set(file,app.replace('<h1>',nav+`<p>Original AMCAF example. ${escape(item.runtime)} Compilation and runtime compatibility are reported separately. Select Keyboard: Typing for text prompts.</p><h1>`));
   if(modules)outputs.set(slug+'.module.js',module);
   item.compiled=true;
  }catch(error){item.compiled=false;item.runtime='Not executed: compilation blocked.';item.error=error.message;outputs.set(file,document(name,nav+`<h1>${escape(name)}</h1><p>This original example does not compile yet. Its source is retained unchanged and its current first blocker is shown below.</p><pre>${escape(item.error)}</pre><p>See the <a href="${repository?'https://github.com/dschwen/AMOScript/blob/master/docs/amcaf-examples.md':'../../docs/amcaf-examples.md'}">compatibility plan</a> for remaining command families and assets.</p>`));}
  programs.push(item);
 }
 if(repository)outputs.set('amcaf-drums.html',buildGamePage(require('../test/helpers/amcafDrumsProgram')(),{title:'AMCAF drum animation harness',debug:true,optimize:true}).replace('<h1>','<p>Silent animation harness: six original Protracker1 drum strings and its embedded sprite bank, with a synthetic scheduler. The recovered music module has no drum synchronization cues.</p><h1>'));
 if(repository)outputs.set('amcaf-hawkeye.html',buildGamePage(require('../test/helpers/amcafHawkeyeProgram')(),{extensions,title:'AMCAF — Hawkeye music harness',assets,debug:true,optimize:true}));
 const count=programs.filter(p=>p.compiled).length;
 outputs.set(index,`# Original AMCAF examples

${link('Demo gallery',repository?'index.md':github('index.md'))}

${count}/${programs.length} original programs compile. The working pages include fonts, two file utilities, quick maths and both Protracker interfaces. Other programs have explicit compile-blocker pages. Sources, four original data files and the separately recovered 4 spirits module are under examples/AMCAF; builds select AMCAF 1.50beta4 in slot 8.

## Try the working examples

${link('Fonts — original bank-font showcase',repository?preview('amcaf-example-fonts.html'):'fonts.html')}: view the embedded Iva and Print fonts, then press Space twice to complete the font capture/restore demonstration. The page supplies a declared AROS-compatible Topaz font.

${link('IFF to raw converter',repository?preview('amcaf-example-iff2raw.html'):'iff2raw.html')} and ${link('Sample-bank fixer',repository?preview('amcaf-example-sambankfixer.html'):'sambankfixer.html')}: upload an input file or use the synthetic sample, start the original program and download its output. The fixer waits for Space after each sample.

${link('Protracker1 — original music interface',repository?preview('amcaf-example-protracker.html'):'protracker.html')}: play the recovered 4 spirits tune. Typing mode is selected. Use arrows to adjust volume/tempo and keys 1–4 to toggle voices. A mouse button on the canvas exits. The recovered tune has no drum/text synchronization cues.

${link('Protracker2 — original music visualizer',repository?preview('amcaf-example-protracker2.html'):'protracker2.html')}: start the supplied Hawkeye tune, watch the frequency meters and note trail, then press a mouse button on the canvas to exit.

${link('Quick sine, cosine, angle and square root',repository?preview('amcaf-example-qsincosarcsqr.html'):'qsincosarcsqr.html')}: move the pointer to aim the line and resize the circle. Press Escape outside fullscreen or a mouse button to exit.

${link('Quick-maths browser checks and captured frames',preview('amcaf-quick-maths.html'))}

${link('Protracker status and VU support checks',preview('amcaf-status.html'))}.

${link('String, shift and raw Work-file support checks',preview('amcaf-utilities.html'))} — a synthetic compatibility demo for the shared utilities needed by the remaining examples.

${link('Blitter graphics and original Protracker2 browser checks',preview('amcaf-blitter.html'))}.

## Drum animation preview

${link('Play the original drum sequences',preview('amcaf-drums.html'))}: a declared synthetic scheduler cycles the six original Anim strings and embedded sprites without music. ${link('Native field/image and Canvas/WebGL checks',preview('amcaf-anim.html'))}.

## Music support preview

${link('Play Hawkeye with AMCAF voice controls',preview('amcaf-hawkeye.html'))}. A declared compiled harness loads the original packed module into a chip Work bank. Press keys to disable voice 1, re-enable it, then stop. Protracker2 now has its own original visualizer page above; the first version also runs with the recovered 4 spirits module. ${link('Voice DMA and native audio graph checks',preview('amcaf-voice.html'))}.

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
