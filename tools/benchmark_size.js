'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib'),{performance}=require('perf_hooks');
const Transpiler=require('../lib/Transpiler'),{buildGamePage,loadAssets}=require('./build_game_page');
function benchmark(){
 const root=path.resolve(__dirname,'..'),samples=[
  {name:'Test21',source:'examples/Test21.AMOS'},
  {name:'Graphics',source:'examples/Graphics.AMOS'},
  {name:'Wonderland',source:'examples/Wonderland/Wonderland.AMOS',assets:'examples/Wonderland/manifest.json'},
  {name:'Roller II',source:'examples/Roller2/current/Roller II.AMOS',assets:'examples/Roller2/current/manifest.json',prefix:'RII:'}
 ];
 const size=value=>({bytes:Buffer.byteLength(value),gzipBytes:zlib.gzipSync(value,{level:9}).length});
 const results=samples.map(sample=>{
  const source=fs.readFileSync(path.join(root,sample.source)),assets=sample.name==='Wonderland'?Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(path.join(root,sample.assets))).files).filter(([name])=>!name.toLowerCase().endsWith('.amos')).map(([name,entry])=>{const bytes=fs.readFileSync(path.join(root,path.dirname(sample.assets),name));if(bytes.length!==entry.byteLength||crypto.createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('Benchmark asset mismatch: '+name);return[name.toLowerCase(),bytes.toString('base64')];})):sample.assets?loadAssets(path.join(root,sample.assets),sample.prefix||''):{},transpiler=new Transpiler(source),variants=[];
  for(const [name,debug,minify]of [['debug',true,false],['regular',false,false],['debug-minified',true,true],['regular-minified',false,true]]){
   const start=performance.now(),module=transpiler.toModule({debug,minify}),moduleMs=performance.now()-start;
   const pageStart=performance.now(),html=buildGamePage(source,{assets,debug,minify,title:sample.name}),htmlMs=performance.now()-pageStart;
   variants.push({name,module:{...size(module),buildMs:Math.round(moduleMs)},html:{...size(html),buildMs:Math.round(htmlMs)}});
  }
  return{name:sample.name,source:sample.source,sha256:crypto.createHash('sha256').update(source).digest('hex'),assetFiles:Object.keys(assets).length,assetBytes:Object.values(assets).reduce((sum,b64)=>sum+Buffer.from(b64,'base64').length,0),variants};
 });
 return{node:process.version,terser:require('terser/package.json').version,optimize:false,gzipLevel:9,note:'Same source and full declared assets for every variant. Module excludes browser harness/assets. HTML includes both. Timings are single-run observations, not execution-speed benchmarks.',results};
}
if(require.main===module){const args=process.argv.slice(2);if(args.length&&!(args.length===2&&args[0]==='--output'))throw Error('Usage: node tools/benchmark_size.js [--output report.json]');const report=JSON.stringify(benchmark(),null,2)+'\n';if(args.length)fs.writeFileSync(args[1],report);else process.stdout.write(report);}
module.exports={benchmark};
