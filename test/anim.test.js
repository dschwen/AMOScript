'use strict';
const assert=require('assert'),make=require('../lib/amos/amal'),oracle=require('./fixtures/amcaf/anim.json');
const{binary,token:t,integer:n,text,compile,execute}=require('./helpers/program');
const binding={type:'sprite',number:0};
function idle(manual=true){return execute(binary([...(manual?[[t('Synchro Off')]]:[]),[t('Anim'),n(0),t(','),text('(2,2)(3,3)')],[t('Anim On Number'),n(0)],[t('Wait Key')]]));}
test('Anim: native frame words, first VBL, finite completion, looping and zero-duration terminal image',()=>{
 for(const testCase of oracle.cases){const target={image:testCase.initial},a=make({resolve:()=>({alive:()=>true,write:(axis,value)=>{assert.strictEqual(axis,'A');target.image=value;}})});a.installAnim(testCase.channel,testCase.source,binding);a.controlAnim(null,'on');
  for(let field=0;field<testCase.images.length;field++){if(field)a.step();assert.strictEqual(target.image,testCase.images[field],testCase.name+' field '+field);assert.strictEqual(a.animSnapshot()[0].ended,field>=testCase.endField);}
  a.controlAnim(null,'on');a.step();assert.strictEqual(target.image,testCase.images.at(-1));assert.strictEqual(a.running(),false);
 }
 const {program:p}=idle();p.installAnim(0,'($2,2)(3,1) Loop');p.animOn();const images=[];for(let i=0;i<7;i++){p.synchro();images.push(p.spriteInfo('I Sprite',0));}assert.deepStrictEqual(images,[2,2,3,2,2,3,2]);
 p.installAnim(0,'(7,0)(9,1)L');p.animOn();p.synchro();assert.strictEqual(p.spriteInfo('I Sprite',0),7);assert.strictEqual(p.animSnapshot()[0].ended,true);p.synchro();assert.strictEqual(p.spriteInfo('I Sprite',0),7);p.stop();
});
test('Anim: parser preflight retains old record, bounded literal forms reject and valid replacement resolves only its lane',()=>{
 let resolves=0;const a=make({resolve:()=>{resolves++;return{alive:()=>true,write(){}};}});a.installAnim(0,'(1,2)',binding);const before=a.animSnapshot();
 for(const source of ['', '(1)', '(1,-1)','(32768,1)','(1,32768)','(1,1) garbage','(1,1)\t','(1,1)\0','(RA,1)','(1,1)'.repeat(257),'x'.repeat(32767),'(1,1)😀']){assert.throws(()=>a.installAnim(0,source,binding),/Anim/);assert.deepStrictEqual(a.animSnapshot(),before);}assert.strictEqual(resolves,1);
 assert(Object.isFrozen(a.compileAnim('(1,2)').frames[0]));assert.throws(()=>compile(binary([[t('Anim'),n(0),t(','),n(4)]])),/requires a string/);
 const {program:p}=idle();assert.throws(()=>p.installAnim(64,'(1,1)'),/channel/);p.installAmal(0,'Pause');const code=p.amalSnapshot()[0].source;p.setChannel(0,'bob',()=>1);assert.throws(()=>p.installAnim(0,'(2,1)'),/Bob target/);assert.strictEqual(p.animSnapshot().length,0);assert.strictEqual(p.amalSnapshot()[0].source,code);p.stop();
});
test('Anim: same-number AMAL and Anim records step in native type order and their controls stay independent',()=>{
 const writes=[],target={alive:()=>true,read:()=>0,write:(axis,value)=>writes.push(value)},a=make({globals:new Int16Array(26),resolve:()=>target});
 a.install(1,'Let A=30;End',binding);a.installAnim(0,'(10,1)',binding);a.install(0,'Let A=20;End',binding);a.installAnim(1,'(40,1)',binding);a.control(null,true);a.controlAnim(null,'on');a.step();assert.deepStrictEqual(writes,[20,10,30,40]);
 a.control(null,false);assert.strictEqual(a.snapshot().length,0);assert.strictEqual(a.animSnapshot().length,2);a.controlAnim(0,'off');assert.strictEqual(a.animSnapshot().length,1);a.controlAnim(null,'off');assert.strictEqual(a.running(),false);
 const {program:p}=idle();p.installAmal(0,'L:Let X=X+1;Pause;Jump L');p.amalOn();p.animFreeze();p.synchro();assert.strictEqual(p.spriteInfo('X Sprite',0),1);assert.strictEqual(p.spriteInfo('I Sprite',0),0);p.animOn();p.amalFreeze();p.synchro();assert.strictEqual(p.spriteInfo('I Sprite',0),2);assert.strictEqual(p.spriteInfo('X Sprite',0),1);p.amalOff();assert.strictEqual(p.animSnapshot().length,1);p.animOff();assert.strictEqual(p.animSnapshot().length,0);p.stop();
});
test('Anim: PAL/NTSC scheduler, pause/rebase, manual synchronization, replacement and target retirement own their wakes',()=>{
 for(const hz of [50,60]){const timers=require('./helpers/fakeTimers').createFakeTimers(),{create}=compile(binary([[t('Anim'),n(0),t(','),text('(2,2)(3,3)')],[t('Anim On Number'),n(0)],[t('Wait Key')]])),p=create({...timers,vblHz:hz});p.tick(100);assert.strictEqual(p.spriteInfo('I Sprite',0),0);timers.tick(1000/hz+0.001);assert.strictEqual(p.spriteInfo('I Sprite',0),2);p.stop();const saved=p.animSnapshot();timers.tick(500);assert.deepStrictEqual(p.animSnapshot(),saved);assert.strictEqual(timers.pending(),0);p.resume();timers.tick(1000/hz+0.001);assert.strictEqual(p.spriteInfo('I Sprite',0),2);timers.tick(1000/hz+0.001);assert.strictEqual(p.spriteInfo('I Sprite',0),3);p.spriteOff();assert.strictEqual(p.animSnapshot().length,0);assert.strictEqual(timers.pending(),0);p.stop();}
 const {program:p,timers:c}=idle();p.synchro();p.animFreeze();const snap=p.animSnapshot();p.synchro();assert.deepStrictEqual(p.animSnapshot(),snap);p.animOn();p.synchro();assert.strictEqual(p.spriteInfo('I Sprite',0),2);p.installAnim(0,'(8,1)');p.synchro();assert.strictEqual(p.spriteInfo('I Sprite',0),2);p.animOn();p.synchro();assert.strictEqual(p.spriteInfo('I Sprite',0),8);assert.strictEqual(c.pending(),0);p.resetDefault();assert.strictEqual(p.animSnapshot().length,0);p.stop();
 const q=idle().program;q.installAnim(63,'(1,1)');assert.throws(()=>q.synchroOn(),/0 to 15/);q.stop();
});
test('Anim: all cached On/Off/Freeze signatures execute through ordinary compiled controls',()=>{
 const {program:p}=execute(binary([[t('Synchro Off')],[t('Anim'),n(0),t(','),text('(2,1)(3,1)')],[t('Anim'),n(1),t(','),text('(4,1)(5,1)')],
 [t('Anim On')],[t('Anim Freeze Number'),n(1)],[t('Synchro')],[t('Anim On Number'),n(1)],[t('Anim Freeze')],[t('Synchro')],[t('Anim On')],[t('Synchro')],[t('Anim Off Number'),n(0)],[t('Anim Off')],[t('Wait Key')]]));
 assert.deepStrictEqual([p.spriteInfo('I Sprite',0),p.spriteInfo('I Sprite',1)],[3,4]);assert.strictEqual(p.animSnapshot().length,0);p.stop();
});
test('AMCAF Protracker1: unchanged source now compiles and reaches the explicit recovered-module effect-9 runtime blocker',()=>{
 const fs=require('fs'),path=require('path'),crypto=require('crypto'),T=require('../lib/Transpiler'),raw=fs.readFileSync(path.join(__dirname,'../examples/AMCAF/AMCAF_Examples/Protracker.AMOS'));
 assert.strictEqual(crypto.createHash('sha256').update(raw).digest('hex'),oracle.sourceSha256);
 const m={exports:{}};new Function('module',new T(raw,{extensions:{8:'amcaf-1.50beta4'}}).toModule())(m);const clock=require('./helpers/fakeTimers').createFakeTimers(),p=m.exports({...clock,print(){},files:require('../lib/amos/files').createMemoryFiles({'Data/mod.4spirits':fs.readFileSync(path.join(__dirname,'../examples/AMCAF/AMCAF_Examples/Data/mod.4spirits'),'latin1')})});
 try{assert.throws(()=>p.tick(100000),/unsupported effect 9:d.*line 82/);assert.strictEqual(clock.pending(),0);assert.strictEqual(p.animSnapshot().length,0);}finally{p.stop();}
});
