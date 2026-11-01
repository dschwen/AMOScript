'use strict';
const assert=require('assert'),createInterface=require('../lib/amos/interface');
const {binary,token:t,word:w,integer:n,text,identifier:v,compile,execute}=require('./helpers/program');
const {createFakeTimers}=require('./helpers/fakeTimers'),startup=require('./helpers/interfaceStartup');
const plain=value=>JSON.parse(JSON.stringify(value));

test('Interface: opening verifier retains postfix expressions, quoted bytes, expanded commands and nested button blocks without executing them',()=>{
  const i=createInterface(),source="SIze 320,200:BAse SW SX-2/,SH SY-2/;SetVar 0,'lower ;: [] ä';BUtton 1,0,0,50,10,0,0,1;[PR 0,0,0VA,2;][BQ;]EXit;",p=i.parse(source);
  assert.strictEqual(p.source,source);assert.deepStrictEqual(p.nodes.filter(n=>n.kind==='instruction').map(n=>n.name),['SI','BA','SV','BU','PR','BQ','EX']);
  assert.deepStrictEqual(p.nodes[1].args[0].map(t=>t.value),['SW','SX','-',2,'/']);assert.strictEqual(p.nodes[2].args[1][0].value,'lower ;: [] ä');assert.ok(Object.isFrozen(p.nodes[0].args[0]));
});

test('Interface: label and user instruction tables keep unique entries, forward calls and native buffer accounting',()=>{
  const i=createInterface(),p=i.parse('LA 1;ZZ 3;EX;UI ZZ,1;[PR 0,0,P1,2;RT;]');assert.deepStrictEqual({...p.labels},{1:0});assert.deepStrictEqual({...p.definitions},{ZZ:1});
  assert.throws(()=>i.parse('LA 1;LA 1;EX;'),/duplicate label/);assert.throws(()=>i.parse('UI PR,0;[EX;]'),/invalid or duplicate/);assert.throws(()=>i.parse('ZZ 3;EX;'),/undefined user instruction/);assert.throws(()=>i.parse('UI ZZ,2;[RT;]ZZ 1;'),/wrong arity|expected comma/);
  assert.throws(()=>i.parse('LA 0;LA 1;EX;',16),/label table/);assert.throws(()=>i.parse('LA 65536;EX;'),/invalid label/);
});

test('Interface: malformed source fails boundedly at a source position, without publishing a channel',()=>{
  const i=createInterface();for(const source of ['','EX','PR 0,0,\'oops,2;','SI 320;','SI 320,,200;','EX;]','[EX;','LA 1VA;EX;','PR 0,0,☃,2;','PR 0,0,QQ,2;','['.repeat(65)+'EX;'+']'.repeat(65)]){assert.throws(()=>i.open(1,source,16,1024,{},0),/Interface/);assert.deepStrictEqual(i.inspect(),[]);}
  assert.throws(()=>i.open(1,'BO 0;',16,1024,{},0),/expected comma/);assert.ok(i.errorPosition()>0);i.open(1,'EX;',16,1024,{},0);assert.strictEqual(i.errorPosition(),0);
});

test('Dialog Open/Close: all cached arities compile standalone and default to 17 values and an even 1 KiB buffer',()=>{
  const {program:p}=execute(binary([[w(0x2720),n(1),t(','),text('EX;')],[w(0x2736),n(2),t(','),text('EX;'),t(','),n(25)],[w(0x2742),n(3),t(','),text('EX;'),t(','),n(0),t(','),n(513)],[t('Wait Key')]]));
  try{assert.deepStrictEqual(plain(p.dialogChannels()).map(c=>[c.id,c.variables,c.bufferBytes,c.screen]),[[1,17,1024,0],[2,26,1024,0],[3,1,512,0]]);p.dialogClose(2);assert.deepStrictEqual(plain(p.dialogChannels()).map(c=>c.id),[1,3]);p.dialogClose();assert.deepStrictEqual(plain(p.dialogChannels()),[]);}finally{p.stop();}
  const result=execute(binary([[t('Dialog Open'),n(1),t(','),text('EX;')],[w(0x2764),n(1)],[w(0x2750)],[t('Wait Key')]]));try{assert.strictEqual(result.program.dialogChannels().length,0);}finally{result.program.stop();}
  assert.throws(()=>compile(binary([[t('Dialog Open'),text('1'),t(','),text('EX;')]])),/Expected numeric/);assert.throws(()=>compile(binary([[t('Dialog Open'),n(1),t(','),n(1)]])),/requires a string/);
});

test('Dialog Open: failed replacement, invalid limits, resource lookup and missing screens preserve channels and display state',()=>{
  const {program:p}=execute(binary([[t('Wait Key')]]));try{
    const s=p.display.screen(),pixels=s.pixels.slice(),palette=s.palette.slice();p.dialogOpen(1,'SV 0,99;EX;');const before=plain(p.dialogChannels());
    assert.throws(()=>p.dialogOpen(1,'EX;'),/already open/);
    for(const args of [[0,'EX;'],[-1,'EX;'],[2,'EX;',-1],[2,'EX;',65536],[2,'EX;',16,256],[2,'EX;',16,1048577]])assert.throws(()=>p.dialogOpen(...args),/Dialog Open/);
    assert.throws(()=>p.dialogOpen(2,'PR 0;'),/Interface/);assert.deepStrictEqual(plain(p.dialogChannels()),before);
    p.setResourceBank(16);assert.throws(()=>p.dialogOpen(2,'EX;'),/reserved Resource/);p.reserveData(16,4);assert.throws(()=>p.dialogOpen(2,'EX;'),/reserved Resource/);p.banks.get(16).name='Resource';p.dialogOpen(2,'EX;');assert.strictEqual(p.dialogChannels()[1].resourceBank,16);p.eraseBank(16);p.dialogClose(2);p.setResourceBank(0);
    assert.strictEqual(p.display.screen(),s);assert.deepStrictEqual(s.pixels,pixels);assert.deepStrictEqual(s.palette,palette);assert.throws(()=>p.dialogClose(9),/not open/);assert.throws(()=>p.dialogClose(0),/positive/);
    p.display.close(0);assert.throws(()=>p.dialogOpen(2,'EX;'),/open screen/);assert.strictEqual(p.dialogChannels().length,1);
  }finally{p.stop();}
});

test('Dialog channels: snapshots, separate factories and Stop/Resume retain owned state; Default retires channels',()=>{
  const {create}=compile(binary([[t('Dialog Open'),n(1),t(','),text('EX;')],[t('Wait Key')]])),a=createFakeTimers(),b=createFakeTimers(),p=create({now:a.now,setTimeout:a.setTimeout,clearTimeout:a.clearTimeout}),q=create({now:b.now,setTimeout:b.setTimeout,clearTimeout:b.clearTimeout});
  try{p.tick(100);q.tick(100);const snapshot=p.dialogChannels();assert.ok(Object.isFrozen(snapshot)&&Object.isFrozen(snapshot[0]));p.dialogClose(1);assert.strictEqual(snapshot.length,1);assert.strictEqual(q.dialogChannels().length,1);q.stop();b.tick(100);q.resume();assert.strictEqual(q.dialogChannels().length,1);q.resetDefault();assert.strictEqual(q.dialogChannels().length,0);}finally{p.stop();q.stop();}
});

test('Edialog: syntax failures retain Interface offsets separately from AMOS source errors, and a new valid open resets them',()=>{
  const {program:p}=execute(binary([[t('Wait Key')]]));try{assert.throws(()=>p.dialogOpen(1,'BO 1;'),/Interface/);assert.ok(p.dialogErrorPosition()>0);p.dialogOpen(1,'EX;');assert.strictEqual(p.dialogErrorPosition(),0);}finally{p.stop();}
  const out=execute(binary([[v('E'),t('='),t('Edialog')],[t('Wait Key')]]));try{assert.strictEqual(out.program.state.variables.int_e,0);}finally{out.program.stop();}
  const trapped=execute(binary([[t('Trap'),t('Dialog Open'),n(1),t(','),text('BO 1;')],[v('E'),t('='),t('Edialog')],[t('Wait Key')]]));try{assert.ok(trapped.program.state.variables.int_e>0);assert.strictEqual(trapped.program.dialogChannels().length,0);assert.strictEqual(trapped.program.state.waiting,'key');}finally{trapped.program.stop();}
});

test('Dialog Open: original Communication, Editing Zones and Sliders scripts construct their first channels without drawing',()=>{
  const expected=[['Communication.AMOS',379,40],['Editing_Zones.AMOS',586,29],['Sliders.AMOS',883,52]];
  for(const [name,length,instructions]of expected){const clock=createFakeTimers(4),p=compile(startup.channelPrefix(name)).create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print(){},files:{read:()=>startup.resource().toString('latin1')}});try{p.tick(1000);clock.tick(40);const c=plain(p.dialogChannels());assert.strictEqual(p.state.waiting,'key',name);assert.strictEqual(c.length,1,name);assert.deepStrictEqual([c[0].id,c[0].source.length,c[0].instructions,c[0].variables,c[0].screen,c[0].resourceBank],[1,length,instructions,17,0,16],name);assert.ok(p.display.screen().pixels.every(v=>v===0),name);assert.ok(p.display.renderDisplay().length,name);}finally{p.stop();}assert.strictEqual(clock.pending(),0,name);}
});

test('Vdialog/Vdialog$: generated reads and assignments own numeric/string values with inclusive indices and checked types',()=>{
  const access=(name,index)=>[t(name),t('('),n(1),t(','),n(index),t(')')];
  const {program:p}=execute(binary([[t('Dialog Open3'),n(1),t(','),text('EX;'),t(','),n(2)],[...access('Vdialog',2),t('='),n(-42)],[...access('Vdialog$',1),t('='),text('Grüße')],[v('N'),t('='),...access('Vdialog',2)],[v('S',6,2),t('='),...access('Vdialog$',1)],[t('Wait Key')]]));
  try{assert.strictEqual(p.state.variables.int_n,-42);assert.strictEqual(p.state.variables.string_s,'Grüße');assert.strictEqual(p.dialogVariable('number',1,0),0);assert.throws(()=>p.dialogVariable('number',1,1),/reinterpret/);assert.throws(()=>p.dialogVariable('string',1,2),/reinterpret/);assert.throws(()=>p.dialogVariable('number',1,-1),/bounds/);assert.throws(()=>p.setDialogVariable(1,3,1),/bounds/);assert.strictEqual(p.dialogVariable('number',1,2),-42);assert.throws(()=>p.setDialogVariable(1,2,'☃'),/Latin-1/);assert.strictEqual(p.dialogVariable('number',1,2),-42);p.setDialogVariable(1,1,7);assert.strictEqual(p.dialogVariable('number',1,1),7);p.dialogClose(1);assert.throws(()=>p.dialogVariable('number',1,0),/not open/);}finally{p.stop();}
  assert.throws(()=>compile(binary([[...access('Vdialog',0),t('='),text('bad')]])),/Expected numeric/);assert.throws(()=>compile(binary([[...access('Vdialog$',0),t('='),n(1)]])),/requires a string/);
});

test('Vdialog: DATA, arrays, local variables and procedure results use the ordinary typed storage boundaries',()=>{
  const access=(name,index)=>[t(name),t('('),n(1),t(','),n(index),t(')')],element=(name,flags=0)=>[v(name,6,flags),t('('),n(0),t(')')];
  const {program:p}=execute(binary([
    [t('Dialog Open'),n(1),t(','),text('EX;')],
    [t('Data'),w(0),n(29),t(','),text('original')],[t('Dim'),...element('A')],[t('Dim'),...element('B',2)],
    [t('Read'),...element('A'),t(','),...element('B',2)],
    [...access('Vdialog',0),t('='),...element('A')],[...access('Vdialog$',1),t('='),...element('B',2)],
    [...element('B',2),t('='),text('changed')],
    [t('Procedure'),[0,0,0,0],w(0),0,0,v('channelvalue')],
    [v('LOCAL'),t('='),...access('Vdialog',0)],[t('End Proc'),t('['),v('LOCAL'),t(']')],
    [v('channelvalue',0x12)],[...element('A'),t('='),t('Param')],
    [v('S',6,2),t('='),...access('Vdialog$',1)],[t('Wait Key')]
  ]));try{assert.strictEqual(p.arrayGet(p.state.variables.array_int_a,[0]),29);assert.strictEqual(p.arrayGet(p.state.variables.array_string_b,[0]),'changed');assert.strictEqual(p.state.variables.string_s,'original');assert.strictEqual(p.state.param.integer,29);assert.strictEqual(p.state.frames.length,0);}finally{p.stop();}
});
