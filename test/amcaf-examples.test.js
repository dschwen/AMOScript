'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto'),{buildAmcafExamples}=require('../tools/build_amcaf_examples');
test('AMCAF example builds: preserve all original sources and assets, explicit profiles, complete catalogue and honest blocker pages',()=>{
 const result=buildAmcafExamples({repository:true});assert.strictEqual(result.programs.length,12);
 assert.deepStrictEqual(result.programs.filter(p=>p.compiled).map(p=>p.source),['Protracker2.AMOS','QsinCosArcSqr.AMOS']);
 for(const p of result.programs){assert.strictEqual(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../examples/AMCAF/AMCAF_Examples',p.source))).digest('hex'),p.sha256);assert(result.outputs.has(p.file));const page=result.outputs.get(p.file);assert(page.includes('AMCAF examples'));if(!p.compiled){assert(p.error);assert(!page.includes('id="play-game"'));}assert.deepStrictEqual(p.extensions,{8:'amcaf-1.50beta4'});}
 for(const name of ['AMCAFAdvert.Abk','MyBootLogo.col','MyBootLogo.raw','mod.hawkeye']){
  const key='data/'+name.toLowerCase();assert.strictEqual(result.assets[key],fs.readFileSync(path.join(__dirname,'../examples/AMCAF/AMCAF_Examples/Data',name)).toString('base64'));assert.strictEqual(result.assets['amcaf_examples:'+key],result.assets[key]);
 }
 const index=result.outputs.get('amcaf-examples.md');for(const p of result.programs)assert(index.includes(require('../tools/demoLinks').preview(p.file)));
 assert(result.programs.find(p=>p.source==='ShowAGAPic.AMOS').error.includes('line length'));
 assert(!fs.existsSync(path.join(__dirname,'../amcaf_examples')));
});
