'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto'),{buildAmcafExamples}=require('../tools/build_amcaf_examples');
test('AMCAF example builds: preserve all original sources and assets, explicit profiles, complete catalogue and honest blocker pages',()=>{
 const result=buildAmcafExamples({repository:true});assert.strictEqual(result.programs.length,12);
 assert.deepStrictEqual(result.programs.filter(p=>p.compiled).map(p=>p.source),['BZoomAnimPlayer.AMOS','Fonts.AMOS','GamePorts.AMOS','Iff2Raw.AMOS','Protracker.AMOS','Protracker2.AMOS','QsinCosArcSqr.AMOS','SamBankFixer.AMOS']);
 for(const p of result.programs){assert.strictEqual(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../examples/AMCAF/AMCAF_Examples',p.source))).digest('hex'),p.sha256);assert(result.outputs.has(p.file));const page=result.outputs.get(p.file);assert(page.includes('AMCAF examples'));if(!p.compiled){assert(p.error);assert(!page.includes('id="play-game"'));}assert.deepStrictEqual(p.extensions,{8:'amcaf-1.50beta4'});}
 for(const name of ['AMCAFAdvert.Abk','MyBootLogo.col','MyBootLogo.raw','mod.hawkeye','mod.4spirits']){
  const key='data/'+name.toLowerCase();assert.strictEqual(result.assets[key],fs.readFileSync(path.join(__dirname,'../examples/AMCAF/AMCAF_Examples/Data',name)).toString('base64'));assert.strictEqual(result.assets['amcaf_examples:'+key],result.assets[key]);
 }
 const spirits=Buffer.from(result.assets['data/mod.4spirits'],'base64');assert.strictEqual(crypto.createHash('sha256').update(spirits).digest('hex'),'478c5b8653c54d272237aeb7f372e9e353307041ca11e5fa60993d6a4c705685');const unpacked=require('../lib/amos/amcafImploder')(spirits,{verifyChecksum:true});const module=require('../lib/amos/mod')(unpacked);assert.strictEqual(module.title,'4spirits');assert.strictEqual(module.songLength,52);assert.strictEqual(module.patternCount,43);assert(module.patterns.flat().some(c=>c.effect===9));assert(module.patterns.flat().some(c=>c.effect===14&&(c.parameter>>4)===9));assert.strictEqual(module.patterns.flat().filter(c=>c.effect===8).length,997);
 const index=result.outputs.get('amcaf-examples.md');for(const p of result.programs)assert(index.includes(require('../tools/demoLinks').preview(p.file)));
 assert.match(result.programs.find(p=>p.source==='Protracker.AMOS').runtime,/Original music interface/);
 assert(result.programs.find(p=>p.source==='ShowAGAPic.AMOS').error.includes('line length'));
 assert(!fs.existsSync(path.join(__dirname,'../amcaf_examples')));
});
