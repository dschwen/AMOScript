/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),{binary,token:t,word:w,integer:n,text,identifier:v,execute,compile}=require('./helpers/program'),{createFakeTimers}=require('./helpers/fakeTimers');
const element=(name,index=n(0),flags=0)=>[v(name,6,flags),t('('),index,t(')')],ref=target=>[w(0x25c0),t('('),target,t(')')],select=name=>[t('Val'),t('('),t('Fsel$'),t('('),text(name),t(')'),t(')')];
const plain=value=>JSON.parse(JSON.stringify(value));

test('Array: original token returns a stable whole-array reference while evaluating unused subscripts once, even outside element bounds',()=>{
  const {program:p}=execute(binary([[t('Dim'),...element('A',n(2),2)],[...element('A',n(0),2),t('='),text('zero')],[...element('A',n(2),2),t('='),text('two')],[v('P'),t('='),...ref(element('A',n(-17),2))],[v('Q'),t('='),...ref(element('A',n(999),2))],[t('Wait Key')]]));
  try{const pointer=p.state.variables.int_p;assert.ok(pointer>=0x1000&&pointer<0x10000);assert.strictEqual(pointer,p.state.variables.int_q);assert.deepStrictEqual(plain(p.arrayReferenceInfo(pointer)),{handle:pointer,type:'string',dimensions:[3]});assert.strictEqual(p.interfaceArraySize(pointer),2);assert.strictEqual(p.interfaceArrayRead(pointer,0),'zero');assert.strictEqual(p.interfaceArrayRead(pointer,1),'');assert.strictEqual(p.arrayReferenceValue(pointer,2),'two');assert.throws(()=>p.interfaceArrayRead(pointer,2),/bounds/);assert.throws(()=>p.interfaceArrayRead(pointer,3),/bounds/);assert.throws(()=>p.interfaceArrayRead(pointer,-1),/bounds/);assert.throws(()=>p.peek(pointer),/out of bounds/);}finally{p.stop();}
});

test('Array: multidimensional subscript effects run left-to-right; neither values nor bounds select a payload element',()=>{
  const calls=[],{program:p}=execute(binary([[t('Dim'),v('M'),t('('),n(1),t(','),n(2),t(')')],[v('P'),t('='),...ref([v('M'),t('('),select('first'),t(','),select('second'),t(')')])],[t('Wait Key')]]),1000,{files:{select({path}){calls.push(path);return path==='first'?'-1':'40000';}}});
  try{assert.deepStrictEqual(calls,['first','second']);assert.deepStrictEqual(plain(p.arrayReferenceInfo(p.state.variables.int_p).dimensions),[2,3]);assert.throws(()=>p.interfaceArraySize(p.state.variables.int_p),/one-dimensional/);}finally{p.stop();}
});

test('Array: unallocated arrays and rank mismatches reject before callbacks; failed or replaced-owner subscripts publish no pointer',()=>{
  for(const dimensions of [null,[n(1)]]){const calls=[],lines=dimensions?[[t('Dim'),...element('A',n(1))]]:[];lines.push([v('P'),t('='),...ref([v('A'),t('('),select('first'),t(','),select('second'),t(')')])]);const clock=createFakeTimers(),p=compile(binary(lines)).create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,files:{select({path}){calls.push(path);return'0';}}});try{assert.throws(()=>p.tick(100),dimensions?/number of Array indices/:/not dimensioned/);assert.deepStrictEqual(calls,[]);assert.strictEqual(p.state.variables.int_p,0);}finally{p.stop();}}
  const calls=[];let p;const c=createFakeTimers(),source=binary([[t('Dim'),v('A'),t('('),n(1),t(','),n(1),t(')')],[v('P'),t('='),...ref([v('A'),t('('),select('replace'),t(','),select('never'),t(')')])]]);p=compile(source).create({now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,files:{select({path}){calls.push(path);p.state.variables.array_int_a.dimensions=[3,3];return'0';}}});try{assert.throws(()=>p.tick(100),/owner changed.*line 2/);assert.deepStrictEqual(calls,['replace']);assert.strictEqual(p.state.variables.int_p,0);}finally{p.stop();}
});

test('Array: scalar, arithmetic and string-subscript forms fail at compile time; float headers are retained but Interface raw-float reads reject',()=>{
  for(const target of [v('A'),text('A'),[element('A'),t('+'),n(1)],element('A',text('bad'))])assert.throws(()=>compile(binary([[v('P'),t('='),...ref(target)]])),/array element reference|numeric expression/);
  const {program:p}=execute(binary([[t('Dim'),...element('F',n(1),1)],[v('P'),t('='),...ref(element('F',n(0),1))],[t('Wait Key')]]));try{assert.strictEqual(p.arrayReferenceInfo(p.state.variables.int_p).type,'float');assert.throws(()=>p.interfaceArrayRead(p.state.variables.int_p,0),/integer or string/);assert.strictEqual(p.interfaceArraySize(0),0);assert.throws(()=>p.interfaceArraySize(7),/invalid or retired/);}finally{p.stop();}
});

test('Array: live element edits are visible through dialogue slots; close/default do not retire surviving AMOS arrays and metadata is frozen',()=>{
  const slot=[t('Vdialog'),t('('),n(1),t(','),n(0),t(')')],{program:p}=execute(binary([[t('Dim'),...element('A',n(1),2)],[...element('A',n(0),2),t('='),text('before')],[t('Dialog Open'),n(1),t(','),text('EX;')],[slot,t('='),...ref(element('A',n(0),2))],[...element('A',n(0),2),t('='),text('after')],[t('Wait Key')]]));
  try{const pointer=p.dialogVariable('number',1,0),info=p.arrayReferenceInfo(pointer);assert.ok(Object.isFrozen(info)&&Object.isFrozen(info.dimensions));assert.strictEqual(p.interfaceArrayRead(pointer,0),'after');p.dialogClose(1);assert.strictEqual(p.interfaceArrayRead(pointer,0),'after');p.resetDefault();assert.strictEqual(p.interfaceArrayRead(pointer,0),'after');p.stop();p.resume();assert.strictEqual(p.interfaceArrayRead(pointer,0),'after');}finally{p.stop();}
});

test('Array: procedure/global lifetimes, DATA, returned references and factory isolation preserve checked ownership',()=>{
  const header=name=>[t('Procedure'),[0,0,0,0],w(0),0,0,v(name)],result=value=>[t('End Proc'),t('['),value,t(']')];
  const source=binary([[t('Data'),w(0),n(81)],[t('Dim'),...element('G')],[t('Read'),...element('G')],[t('Global'),v('G'),t('('),t(')')],
    header('globalref'),result(ref(element('G'))),[v('globalref',0x12)],[v('P'),t('='),t('Param')],
    header('localref'),[t('Dim'),...element('L')],result(ref(element('L'))),[v('localref',0x12)],[v('L'),t('='),t('Param')],[t('Wait Key')]]),{create}=compile(source),a=createFakeTimers(),b=createFakeTimers(),p=create({now:a.now,setTimeout:a.setTimeout,clearTimeout:a.clearTimeout}),q=create({now:b.now,setTimeout:b.setTimeout,clearTimeout:b.clearTimeout});
  try{p.tick(1000);q.tick(1000);const pointer=p.state.variables.int_p;assert.strictEqual(p.arrayReferenceValue(pointer,0),81);assert.throws(()=>p.interfaceArrayRead(p.state.variables.int_l,0),/retired/);p.arraySet(p.state.variables.array_int_g,[0],17);assert.strictEqual(p.arrayReferenceValue(pointer,0),17);assert.strictEqual(q.arrayReferenceValue(q.state.variables.int_p,0),81);}finally{p.stop();q.stop();}
});

test('Array: a fresh procedure entry retires the prior header without reusing it or invalidating inspection snapshots',()=>{
  const {program:p,timers:c}=execute(binary([[t('Procedure'),[0,0,0,0],w(0),0,0,v('enter')],[t('Dim'),...element('A',n(1))],[v('P'),t('='),...ref(element('A'))],[t('Wait Key')],[t('End Proc')],[v('enter',0x12)],[v('enter',0x12)],[t('Wait Key')]]));try{const old=p.state.locals.int_p,info=p.arrayReferenceInfo(old);p.sendKey('continue');c.tick(0);const fresh=p.state.locals.int_p;assert.notStrictEqual(fresh,old);assert.deepStrictEqual(plain(info.dimensions),[2]);assert.deepStrictEqual(plain(p.arrayReferenceInfo(fresh).dimensions),[2]);assert.throws(()=>p.interfaceArrayRead(old,0),/retired/);}finally{p.stop();}
});

test('Array: original Sliders lines 1–51 populate all 101 list entries and load their header into Vdialog without executing the Interface',()=>{
  const startup=require('./helpers/interfaceStartup'),clock=createFakeTimers(4),p=compile(startup.arrayPrefix()).create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print(){},files:{read:()=>startup.resource().toString('latin1')}});try{p.tick(1000);clock.tick(40);assert.strictEqual(p.state.waiting,'key');const pointer=p.dialogVariable('number',1,0);assert.strictEqual(p.interfaceArraySize(pointer),100);for(let i=0;i<=100;i++)assert.strictEqual(p.arrayReferenceValue(pointer,i),'Select number '+i);assert.throws(()=>p.interfaceArrayRead(pointer,100),/bounds/);assert.strictEqual(p.interfaceArrayRead(pointer,99),'Select number 99');assert.ok(p.display.screen().pixels.every(v=>v===0));}finally{p.stop();}assert.strictEqual(clock.pending(),0);
});
