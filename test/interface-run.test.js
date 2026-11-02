/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),{binary,token:t,word:w,integer:n,text,identifier:v,execute,compile}=require('./helpers/program');
const {createFakeTimers}=require('./helpers/fakeTimers');
const query=(name,args)=>[t(name),t('('),args.flatMap((arg,i)=>[...(i?[t(',')]:[]),arg]),t(')')];
function program(script,extra=[]){return binary([[t('Dialog Open'),n(1),t(','),text(script)],...extra,[v('R'),t('='),...query('Dialog Run',[n(1)])],[t('Wait Key')]]);}
function idle(script){const c=createFakeTimers(4),p=compile(binary([[t('Dialog Open'),n(1),t(','),text(script)],[t('Wait Key')]])).create({now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout});p.tick(1000);return{p,c};}

test('Dialog Run: real cached arities execute postfix variables and retain native longword add/subtract and signed-word multiply/divide',()=>{
  const {program:p}=execute(program('SV0,5 3+;SV1,$7FFFFFFF 1+;SV2,65537 3*;SV3,65543 2/;SV4,1 2<;SV5,2 1 MI;SV6,9 NE;EX;'));
  try{assert.deepStrictEqual(Array.from({length:7},(_,i)=>p.dialogVariable('number',1,i)),[8,-2147483648,3,3,-1,1,-9]);assert.strictEqual(p.state.variables.int_r,0);}finally{p.stop();}
  const {p:q}=idle('SV0,9;EX;LA2;SV0,17;EX;');try{assert.strictEqual(q.dialogRun(1,2),0);assert.strictEqual(q.dialogVariable('number',1,0),17);q.dialogRun(1);assert.strictEqual(q.dialogVariable('number',1,0),9);assert.throws(()=>q.dialogRun(1,7),/label/);assert.throws(()=>q.dialogRun(1,65536),/Invalid Dialog Run/);}finally{q.stop();}
  const built=execute(binary([[t('Dialog Open'),n(1),t(','),text('LA 2;SV0,BX;SV1,BY;EX;')],[v('R'),t('='),w(0x2788),t('('),n(1),t(','),n(2),t(','),n(7),t(','),n(9),t(')')],[v('S'),t('='),w(0x277e),t('('),n(1),t(','),n(2),t(')')],[t('Wait Key')]]));try{assert.strictEqual(built.program.dialogVariable('number',1,0),7);assert.strictEqual(built.program.dialogVariable('number',1,1),9);}finally{built.program.stop();}
});

test('Dialog Run: SI rounds up and BA rounds down to sixteen; geometry and owned values survive repeated runs while XY resets',()=>{
  const {p}=idle('SI17,13;BA31,9;SV0,SX;SV1,SY;SV2,BX;SV3,BY;XY3,4,5,6;SV4,XB;SV5,SW;SV6,SH;EX;LA1;SV4,XB;SV2,BX;EX;');
  try{p.dialogRun(1);assert.deepStrictEqual(Array.from({length:7},(_,i)=>p.dialogVariable('number',1,i)),[32,13,16,9,5,320,200]);p.dialogRun(1,1,-2147483648,-2147483648);assert.strictEqual(p.dialogVariable('number',1,4),0);assert.strictEqual(p.dialogVariable('number',1,2),16);}finally{p.stop();}
});

test('Dialog Run: typed strings, decimal conversion and checked AR/AS execute through DATA, arrays and procedure results',()=>{
  const array=[v('A',6,2),t('('),n(0),t(')')],slot=query('Vdialog',[n(1),n(0)]),script="SV1,0VA AS;SV2,0VA 0 AR;SV3,'value=' 42 # !;SV4,3VA TL;SV5,3VA TW;SI160,20;SV6,3VA CX;EX;";
  const {program:p}=execute(binary([[t('Data'),w(0),text('from DATA')],[t('Dim'),v('A',6,2),t('('),n(2),t(')')],[t('Read'),array],[t('Dialog Open'),n(1),t(','),text(script)],[slot,t('='),...query('Array',[array])],
    [t('Procedure'),[0,0,0,0],w(0),0,0,v('RUNNER')],[t('End Proc'),t('['),...query('Dialog Run',[n(1)]),t(']')],[v('RUNNER',0x12)],[v('S',6,2),t('='),...query('Vdialog$',[n(1),n(3)])],[t('Wait Key')]]));
  try{assert.strictEqual(p.state.param.integer,0);assert.strictEqual(p.dialogVariable('number',1,1),2);assert.strictEqual(p.dialogVariable('string',1,2),'from DATA');assert.strictEqual(p.state.variables.string_s,'value=42');assert.strictEqual(p.dialogVariable('number',1,4),8);assert.strictEqual(p.dialogVariable('number',1,5),64);assert.strictEqual(p.dialogVariable('number',1,6),48);}finally{p.stop();}
});

test('Dialog Run: graphics use the captured screen, restore selection and bypass Autoback/Bob replay into physical buffers',()=>{
  const {p}=idle('BA31,3;IN2,0,0;GB0,0,4,4;GL0,6,4,6;GS6,0,10,4;PR0,12,\'A\',3;SV0,XB;SV1,YB;EX;');
  try{const d=p.display,s=d.screen();d.clear(0);d.doubleBuffer();d.autoback(2);let hooks=0;d.setDrawingHooks({before(){hooks++;},after(){hooks++;}});d.grLocate(90,91);d.open(1,32,32,4,0);const other=d.screen();p.dialogRun(1);assert.strictEqual(d.screen(),other);assert.strictEqual(hooks,0);assert.ok(s.physicalPixels.every(v=>v===0));assert.strictEqual(s.pixels[3*s.width+16],2);assert.strictEqual(s.pixels[9*s.width+20],2);assert.strictEqual(s.pixels[3*s.width+22],2);assert.strictEqual(s.pixels[4*s.width+23],0);assert.deepStrictEqual([s.gx,s.gy],[90,91]);assert.deepStrictEqual([p.dialogVariable('number',1,0),p.dialogVariable('number',1,1)],[8,20]);}finally{p.stop();}
});

test('Dialog Run: native GP omits base offsets and retains its source XA/YA/XB/YB register quirk',()=>{
  const {program:p}=execute(program('BA32,20;GP4,6,2;SV0,XA;SV1,YA;SV2,XB;SV3,YB;EX;'));try{assert.strictEqual(p.display.point(4,6),2);assert.strictEqual(p.display.point(36,26),1);assert.deepStrictEqual(Array.from({length:4},(_,i)=>p.dialogVariable('number',1,i)),[4,4,7,7]);}finally{p.stop();}
});

test('Dialog Run: failures preserve earlier effects, retain the failing Interface offset and do not assign the AMOS function result',()=>{
  const script='SV0,42;SV1,1 0/;EX;',c=createFakeTimers(),p=compile(program(script)).create({now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout});try{assert.throws(()=>p.tick(1000),/division by zero.*line 2/);assert.strictEqual(p.dialogVariable('number',1,0),42);assert.strictEqual(p.dialogVariable('number',1,1),0);assert.strictEqual(p.dialogErrorPosition(),script.indexOf('/'));assert.strictEqual(p.state.variables.int_r,0);assert.strictEqual(c.pending(),0);}finally{p.stop();}
  for(const source of ['SV0,1 2;EX;','SV0,1+;EX;','SV0,32768 NE 1 NE/;EX;','SV0,0VA 9 AR;EX;']){const{p:q}=idle(source);try{assert.throws(()=>q.dialogRun(1),/Interface|reference/);}finally{q.stop();}}
});

test('Dialog Run: unsupported commands, control blocks, string/buffer bounds and unterminated programs fail explicitly',()=>{
  for(const source of ['BO0,0,1,50,20;EX;','RU1,3;EX;','IF1;[EX;]EX;','UI ZZ,0;[EX;]EX;','SV0,1;','SV0,'+"'"+'a'.repeat(256)+"';EX;",'SW2;EX;','SL255;EX;']){const factory=require('../lib/amos/interface'),controller=factory({run:(c,l,x,y,alive)=>require('../lib/amos/interfaceExecution')(c,l,x,y,{alive,begin(){},writing(){},line(){}})});controller.open(1,source,16,1024,{width:320,height:200},0);assert.throws(()=>controller.run(1),/Interface/);}
  const {p}=idle('SV0,0;EX;');try{p.dialogClose(1);assert.throws(()=>p.dialogRun(1),/not open/);}finally{p.stop();}
});

test('Dialog Run: replaced screens, reentry and channel retirement cannot continue an old execution',()=>{
  const {p}=idle('IN2,0,0;GB0,0,4,4;SV0,99;EX;');try{p.display.open(0,320,200,16,0);assert.throws(()=>p.dialogRun(1),/retired/);assert.strictEqual(p.dialogVariable('number',1,0),0);}finally{p.stop();}
  const {p:q}=idle('GB0,0,4,4;SV0,99;EX;');let remove;try{remove=q.display.subscribe(()=>{remove();q.dialogClose(1);});assert.throws(()=>q.dialogRun(1),/retired/);}finally{if(remove)remove();q.stop();}
});

test('Dialog Run: cached four-operand form accepts the documented omitted label without replaying coordinates',()=>{
  const {program:p}=execute(binary([[t('Dialog Open'),n(1),t(','),text('SV0,BX;SV1,BY;EX;')],[v('R'),t('='),w(0x2788),t('('),n(1),t(','),t(','),n(13),t(','),n(17),t(')')],[t('Wait Key')]]));try{assert.strictEqual(p.dialogVariable('number',1,0),13);assert.strictEqual(p.dialogVariable('number',1,1),17);}finally{p.stop();}
});

test('Dialog Run: original Graphics rectangle strings execute on prepared startup and preserve independent source geometry',()=>{
  const fixture=require('./helpers/interfaceRunFixture'),clock=createFakeTimers(4),p=compile(fixture.shapes()).create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,files:{read:()=>fixture.resource().toString('latin1')}});
  try{p.tick(2000);clock.tick(40);assert.strictEqual(p.state.waiting,'key');assert.strictEqual(p.display.point(340,140),1);assert.strictEqual(p.display.point(444,142),3);assert.strictEqual(p.display.point(595,180),7);assert.strictEqual(p.display.point(596,180),0);p.sendKey('next');clock.tick(40);assert.strictEqual(p.dialogVariable('number',1,0),5);assert.strictEqual(p.state.variables.int_result,0);}finally{p.stop();}assert.strictEqual(clock.pending(),0);
});

test('Dialog Run: bounded stacks, retained string storage and instruction budgets reject without hanging or inventing completion',()=>{
  const createInterface=require('../lib/amos/interface'),executeInterface=require('../lib/amos/interfaceExecution');
  const cases=[['SV0,'+'1 '.repeat(65)+';EX;',/expression buffer/],[("SV0,'"+'a'.repeat(100)+"';").repeat(12)+'EX;',/string buffer/],['SV0,1;'.repeat(4097)+'EX;',/4096-instruction/]];
  for(const [source,pattern]of cases){const controller=createInterface({run:(c,l,x,y,alive)=>executeInterface(c,l,x,y,{alive,begin(){}})});controller.open(1,source,16,1024,{width:320,height:200},0);assert.throws(()=>controller.run(1),pattern);}
});

test('Dialog Run: caught reentry cannot corrupt an outer run, and a host Stop prevents later script effects',()=>{
  const {p}=idle('GB0,0,4,4;SV0,99;EX;');let remove;try{remove=p.display.subscribe(()=>{remove();assert.throws(()=>p.dialogRun(1),/Reentrant/);});p.dialogRun(1);assert.strictEqual(p.dialogVariable('number',1,0),99);}finally{if(remove)remove();p.stop();}
  const {p:q}=idle('GB0,0,4,4;SV0,99;EX;');try{remove=q.display.subscribe(()=>{remove();q.stop();});assert.throws(()=>q.dialogRun(1),/retired/);assert.strictEqual(q.dialogVariable('number',1,0),0);}finally{if(remove)remove();q.stop();}
});

test('Dialog Run: native ClearKey boundaries drain text/scancode but preserve raw holds, joystick and mouse; pre-entry failures retain input',()=>{
  const {p}=idle('GB0,0,4,4;EX;');let remove;try{
    p.state.input.keys.push('queued');p.state.input.scanCode=42;p.setKeyState(17,true);p.setJoystick(0,16);p.setMouse(20,30,1);
    remove=p.display.subscribe(()=>{remove();assert.strictEqual(p.state.input.keys.length,0);assert.strictEqual(p.state.input.scanCode,0);p.state.input.keys.push('during');p.state.input.scanCode=33;});
    p.dialogRun(1);assert.strictEqual(p.state.input.keys.length,0);assert.strictEqual(p.state.input.scanCode,0);assert.strictEqual(p.keyState(17),-1);assert.strictEqual(p.joystickInfo('Joy',0),16);assert.strictEqual(p.state.input.mouse.buttons,1);
    p.state.input.keys.push('retain');p.state.input.scanCode=22;assert.throws(()=>p.dialogRun(1,9),/label/);assert.strictEqual(p.state.input.keys.length,1);assert.strictEqual(p.state.input.scanCode,22);
  }finally{if(remove)remove();p.stop();}
});
