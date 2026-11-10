'use strict';
const assert=require('assert'),fs=require('fs'),crypto=require('crypto'),oracle=require('./fixtures/amcaf/hawkeye.json');
test('AMCAF Hawkeye: original packed module first wrap agrees with independent Python order/cell timing audit',()=>{
 const bytes=require('../lib/amos/amcafImploder')(fs.readFileSync(__dirname+'/../examples/AMCAF/AMCAF_Examples/Data/mod.hawkeye'),{verifyChecksum:true});
 assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'),oracle.decodedSha256);
 const module=require('../lib/amos/mod')(bytes),p=require('../lib/amos/amcafSequencer')(module,require('../lib/amos/amcafPitch'));
 let triggers=0,filters=0;while(!p.state.ends&&p.state.ticks<30000){const f=p.tick();triggers+=f.triggers.length;filters+=(f.filters||[]).length;}
 assert.strictEqual(p.state.ends,1);assert.strictEqual(p.state.ticks,oracle.ticks);assert.strictEqual(triggers,oracle.triggers);assert.strictEqual(filters,oracle.filterWrites);
});
