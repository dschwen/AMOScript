/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const createDisplay=require('../lib/amos/display');
const {binary,token:t,word:w,dword,integer:n,identifier:id,text,compile,execute}=require('./helpers/program');
const {createFakeTimers}=require('./helpers/fakeTimers');
const fn=(name,arg)=>[t(name),t('('),arg,t(')')];
const copy=(from,to)=>[w(0x986),from,t('To'),to];
const options=c=>({now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout});
const asset=fs.readFileSync(path.join(__dirname,'fixtures/image-banks.hex'),'utf8').replace(/\s/g,'');
const withBanks=lines=>Buffer.concat([binary(lines),Buffer.from(asset,'hex').subarray(20)]);

test('Screen Copy: source query words produce exact tagged integers through DATA, arrays and procedure results',()=>{
  const lines=[[t('Data'),w(0),w(0x1c8)],[t('Read'),id('selector')],[t('Dim'),id('a'),t('('),n(0),t(')')],
    [id('a'),t('('),n(0),t(')'),t('='),w(0xe24),t('('),n(2),t(')')],
    [t('Procedure'),dword(0),w(0),0,0,id('p')],[t('End Proc'),t('['),w(0x1d4),t('('),n(2),t(')'),t(']')],[id('p',0x12)],
    [t('Print'),id('selector'),t(','),w(0xe16),t(','),id('a'),t('('),n(0),t(')'),t(','),t('Param')]];
  assert.deepStrictEqual(execute(binary(lines)).logs,[[-1073741825,-1,-1073741822,-2147483646]]);
  const d=createDisplay();d.close(0);assert.strictEqual(d.bufferSelector('Logic'),-1073741825);assert.strictEqual(d.bufferSelector('Physic'),-1);
});

test('Screen Copy: raw copy preserves buffer identities, selection and state while bypassing all Autoback modes',()=>{
  for(const mode of [0,1,2]){
    const d=createDisplay();d.clear(1);d.doubleBuffer();d.autoback(mode);const s=d.screen(),logical=s.pixels,physical=s.physicalPixels;
    logical.fill(2);physical.fill(3);d.locate(4,2);d.grLocate(3,5);const palette=s.palette.slice();
    d.copyScreen(d.bufferSelector('Logic'),d.bufferSelector('Physic'));
    assert.strictEqual(s.pixels,logical);assert.strictEqual(s.physicalPixels,physical);assert.ok(physical.every(v=>v===2));
    physical[0]=3;d.copyScreen(d.bufferSelector('Physic'),0);assert.strictEqual(logical[0],3);
    assert.deepStrictEqual(s.palette,palette);assert.deepStrictEqual([s.x,s.y,s.gx,s.gy,s.autoback,d.current],[4,2,3,5,mode,0]);
    d.copyScreen(0,0);assert.strictEqual(s.pixels,logical);
  }
  const result=execute(binary([[t('Double Buffer')],[t('Autoback'),n(0)],[t('Cls Colour'),n(2)],copy(t('Logic'),t('Physic'))]));
  assert.strictEqual(result.program.display.screen().physicalPixels[0],2);
});

test('Screen Copy: whole copies clip both dimensions and preserve destination planes beyond source depth',()=>{
  const d=createDisplay();d.open(0,32,2,4,0);for(let i=0;i<64;i++)d.screen().pixels[i]=i%4;
  const source=d.screen().pixels.slice();d.open(1,64,4,16,0x8000);d.clear(12);const palette=d.screen().palette.slice();
  d.copyScreen(0,1);
  for(let y=0;y<4;y++)for(let x=0;x<64;x++)assert.strictEqual(d.screen().pixels[y*64+x],y<2&&x<32?12|source[y*32+x]:12);
  assert.deepStrictEqual(d.screen().palette,palette);assert.strictEqual(d.current,1);
  d.open(2,16,1,2,0);d.copyScreen(1,2);assert.deepStrictEqual(Array.from(d.screen().pixels),Array.from(source.slice(0,16),v=>v&1));
  d.open(3,32,2,4096,0);d.clear(0x2f);d.copyScreen(3,1);assert.strictEqual(d.screen(1).pixels[0],15); // raw HAM codes, no colour conversion
});

test('Screen Copy: raw overwrites retain saved Bob backgrounds rather than transferring or synchronizing them',()=>{
  const {program:p}=execute(withBanks([[t('Bob Update Off')],[t('Cls Colour'),n(3)],[t('Hot Spot'),n(1),t(','),n(0),t(','),n(0)],
    [t('Double Buffer')],[t('Autoback'),n(0)]]));const d=p.display;
  p.setBob(0,0,0,1);p.bobDraw();assert.strictEqual(d.point(0,0),1);d.swap(0);
  d.screen().pixels.fill(2);d.copyScreen(d.bufferSelector('Logic'),d.bufferSelector('Physic'));
  assert.strictEqual(d.screen().physicalPixels[0],2);d.swap(0);p.bobClear();assert.strictEqual(d.point(0,0),3);
  assert.strictEqual(d.screen().physicalPixels[0],2);p.stop();
});

test('Screen Copy: selectors resolve current buffers at use time across swaps, reopenings and independent factories',()=>{
  const d=createDisplay(),logic=d.bufferSelector('Logic',0),physic=d.bufferSelector('Physic',0);
  d.doubleBuffer();d.autoback(0);d.clear(2);d.swap(0);d.copyScreen(physic,logic);assert.strictEqual(d.point(0,0),2);
  d.open(0,320,200,16,0);d.doubleBuffer();d.autoback(0);d.clear(3);d.copyScreen(logic,physic);assert.strictEqual(d.screen().physicalPixels[0],3);
  d.open(1,320,200,16,0);d.clear(1);d.copyScreen(physic,1);
  assert.strictEqual(d.point(0,0),3);assert.strictEqual(d.current,1); // numbered tag still resolves screen 0
  const {create}=compile(binary([[t('Wait Key')]])),c=createFakeTimers(),a=create(options(c)),b=create(options(c));
  a.display.doubleBuffer();a.display.autoback(0);a.display.clear(2);a.display.copyScreen(logic,physic);
  assert.strictEqual(b.display.screen().physicalPixels[0],1);a.stop();b.stop();
});

test('Screen Copy: physical snapshots change only for the chosen destination and leave old snapshots immutable',()=>{
  const {program:p}=execute(binary([[t('Bob Update Off')],[t('Double Buffer')],[t('Autoback'),n(2)]]));const d=p.display,s=d.screen();
  s.physicalPixels.fill(0);s.pixels.fill(2);const before=d.snapshotDisplay(),old=Buffer.from(d.renderDisplay());
  d.copyScreen(0,d.bufferSelector('Logic'));assert.deepStrictEqual(Buffer.from(d.renderDisplay()),old);
  d.copyScreen(0,d.bufferSelector('Physic'));assert.notDeepStrictEqual(Buffer.from(d.renderDisplay()),old);
  const after=d.snapshotDisplay();assert.deepStrictEqual(before.frame.linePal,after.frame.linePal);
  const reference=require('../lib/display/reference/render');assert.deepStrictEqual(Buffer.from(reference.render(before.chip,before.frame)),old);
  p.stop();
});

test('Screen Copy: invalid tags, missing screens, string operands and unsupported forms fail explicitly',()=>{
  assert.throws(()=>execute(binary([copy(n(8),n(0))])),/Invalid screen selector.*line 1/);
  const d=createDisplay();d.close(0);assert.throws(()=>d.copyScreen(0,8),/Invalid screen selector/);assert.throws(()=>d.copyScreen(-1,-1073741825),/not open/);
  assert.throws(()=>d.copyScreen(0x100000000,0),/not open/); // destination resolves first
  assert.throws(()=>execute(binary([copy(text('0'),n(0))])),/numeric.*line 1/);
  assert.throws(()=>compile(binary([[t('Print'),fn('Logic Of',text('0'))]])),/Wrong argument type/);
  assert.throws(()=>compile(binary([[w(0x99c),n(0),t('To'),n(0),t(','),n(0xcc)]])),/Unsupported token/);
  assert.throws(()=>compile(binary([[copy(n(0),n(0)),t(','),n(0xcc)]])),/end of statement/);
  assert.throws(()=>compile(binary([[w(0x9a8)]])),/Unsupported token/);
  const q=execute(binary([[t('Print'),fn('Logic Of',n(8))]]));assert.deepStrictEqual(q.logs,[[-2147483640]]);
});

test('Screen Copy: original Wonderland data/paste/copy loops publish all five full level bitmaps without swapping',()=>{
  for(let level=1;level<=5;level++){
    const {program:p,timers:c}=execute(require('./helpers/wonderlandMapCopy')(level),100000,{files:{read:name=>fs.readFileSync(path.join(__dirname,'../examples/Wonderland',name.split('/').pop())).toString('latin1')}});
    c.tick(20);assert.strictEqual(p.state.waiting,'key');p.sendKey('map');c.tick(20);
    const world=p.display.screen(0),logical=world.pixels,physical=world.physicalPixels,expected=logical.slice(),panel=p.display.screen(1).physicalPixels.slice();
    assert.strictEqual(p.state.waiting,'sleep');assert.ok(expected.some((v,i)=>v!==physical[i]));
    const data=p.banks.get(4).data.subarray((level-1)*1440,level*1440);
    const expectedEnemies=Math.min(11,Array.from(data).filter(v=>v>16&&v<22).length);
    assert.strictEqual(p.state.variables.int_nbad,expectedEnemies);
    assert.strictEqual(p.state.variables.int_nblk,Array.from(data).filter(v=>v>10&&v<16).length);
    c.tick(20);assert.strictEqual(world.pixels,logical);assert.strictEqual(world.physicalPixels,physical);
    assert.deepStrictEqual(Buffer.from(physical),Buffer.from(expected));assert.deepStrictEqual(Buffer.from(p.display.screen(1).physicalPixels),Buffer.from(panel));
    assert.strictEqual(world.autoback,0);c.tick(20);assert.strictEqual(p.state.waiting,'key');assert.strictEqual(c.pending(),0);p.stop();
  }
});
