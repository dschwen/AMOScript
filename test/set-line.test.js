/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {binary,token:t,integer:n,word:w,identifier:id,compile,execute}=require('./helpers/program');
const createDisplay=require('../lib/amos/display'),hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const open=(width=32,height=16)=>[t('Screen Open'),n(0),t(','),n(width),t(','),n(height),t(','),n(16),t(','),t('Lowres')];

test('Set Line: exact token stores low word per screen and preserves it across typed DATA, arrays and procedure results',()=>{
  const {program:p}=execute(binary([open(),[t('Data'),w(0),n(0x1cccc)],[t('Read'),id('v')],[t('Dim'),id('a'),t('('),n(1),t(')')],
    [id('a'),t('('),n(1),t(')'),t('='),id('v')],[w(0x1034),id('a'),t('('),n(1),t(')')],[t('Wait Key')],
    [t('Procedure'),[0,0,0,0],w(0),0,0,id('pattern')],[t('End Proc'),t('['),n(-1),t(']')],[id('pattern',0x12)],[t('Set Line'),t('Param')],[t('Wait Key')]]));
  const s=p.display.screen();assert.strictEqual(s.linePattern,0xcccc);assert.strictEqual(s.linePhase,15);p.display.open(1,32,16,16,0);assert.strictEqual(p.display.screen().linePattern,65535);p.display.setLine(0);p.display.select(0);assert.strictEqual(s.linePattern,0xcccc);p.sendKey('next');p.tick(1000);assert.strictEqual(s.linePattern,65535);p.stop();
  assert.throws(()=>compile(binary([[t('Set Line'),require('./helpers/tokens').text('solid')]])),/numeric.*line 1/);
  assert.throws(()=>execute(binary([[t('Screen Close'),n(0)],[t('Set Line'),n(0)]])),/not open.*line 2/);
  const a=createDisplay(),b=createDisplay();a.setLine(0x10001);assert.strictEqual(a.screen().linePattern,1);assert.strictEqual(b.screen().linePattern,65535);a.open(0,32,16,16,0);assert.strictEqual(a.screen().linePattern,65535);
});

test('Set Line: MSB-first pattern and opaque Ink background follow connected Draw/Draw To phase without resets from Set Line or Gr Locate',()=>{
  const d=createDisplay();d.open(0,32,8,8,0);d.clear(7);d.ink(3,2);d.setLine(0x8000);d.draw(0,0,5,0);d.drawTo(20,0);
  for(let x=0;x<=20;x++)assert.strictEqual(d.point(x,0),x===0||x===16?3:2);assert.strictEqual(d.screen().linePhase,11);
  d.setLine(0x4000);assert.strictEqual(d.screen().linePhase,11);d.draw(0,2,15,2);for(let x=0;x<16;x++)assert.strictEqual(d.point(x,2),x===13?3:2);
  d.grLocate(0,4);d.drawTo(15,4);for(let x=0;x<16;x++)assert.strictEqual(d.point(x,4),x===14?3:2);
  d.setLine(0);d.draw(0,6,31,6);for(let x=0;x<32;x++)assert.strictEqual(d.point(x,6),2);assert.deepStrictEqual([d.screen().gx,d.screen().gy],[31,6]);
});

test('Set Line: clipped axis/diagonal walks keep invisible phase and all octants use bounded portable raster steps',()=>{
  const d=createDisplay();d.open(0,24,24,8,0);d.clear(0);d.ink(3,1);d.setLine(0xcccc);d.draw(-4,0,19,0);for(let x=0;x<20;x++)assert.strictEqual(d.point(x,0),x%4<2?3:1);assert.strictEqual(d.screen().linePhase,8);
  const endpoints=[[18,14],[14,18],[6,18],[2,14],[2,6],[6,2],[14,2],[18,6]];
  // Independent half-up major-axis coordinate construction for these 2:1 rays.
  for(const [x2,y2]of endpoints){const q=createDisplay();q.open(0,24,24,8,0);q.clear(0);q.ink(3,1);q.setLine(0xa55a);q.draw(10,10,x2,y2);const expected=new Uint8Array(24*24),dx=x2-10,dy=y2-10;
    for(let step=0;step<=8;step++){const x=10+Math.sign(dx)*(Math.abs(dx)===8?step:Math.floor(step/2+0.5)),y=10+Math.sign(dy)*(Math.abs(dy)===8?step:Math.floor(step/2+0.5));expected[y*24+x]=(0xa55a&(1<<(15-step)))?3:1;}assert.deepStrictEqual(q.screen().pixels,expected);assert.strictEqual(q.screen().linePhase,7);}
  const before=d.screen().pixels.slice(),phase=d.screen().linePhase;assert.throws(()=>d.draw(0,0,32768,0),/signed words/);assert.throws(()=>d.box(0,0,20,40000),/signed words/);assert.deepStrictEqual(d.screen().pixels,before);assert.strictEqual(d.screen().linePhase,phase);
  assert.throws(()=>execute(binary([open(),[t('Set Line'),n(0xcccc)],[t('Draw'),n(0),t(','),n(0),t('To'),n(32768),t(','),n(0)]])),/signed words at line 3, byte/);
  d.setLine(-1);d.draw(-2147483648,1,2147483647,1);for(let x=0;x<24;x++)assert.strictEqual(d.point(x,1),3);
});

test('Set Line: double-buffer Autoback replays the same phase once and patterned drawing leaves Bar/text/Plot independent',()=>{
  for(const mode of [0,1,2]){const d=createDisplay();d.open(0,32,16,16,0);d.doubleBuffer();d.autoback(mode);const s=d.screen(),logical=s.pixels,physical=s.physicalPixels;logical.fill(5);physical.fill(6);d.ink(3,2);d.setLine(0xaaaa);d.draw(1,1,20,1);
    assert.strictEqual(s.linePhase,12);assert.strictEqual(s.pixels,logical);assert.strictEqual(s.physicalPixels,physical);for(let x=1;x<=20;x++){const wanted=x%2?3:2;assert.strictEqual(logical[32+x],wanted);assert.strictEqual(physical[32+x],mode?wanted:6);}const phase=s.linePhase;d.bar(1,3,5,5);d.plot(7,5);d.paper(0);d.pen(4);d.locate(0,1);d.write('A');assert.strictEqual(s.linePhase,phase);assert.strictEqual(d.point(3,4),3);assert.strictEqual(d.point(7,5),3);assert.ok(s.pixels.slice(8*32).some(v=>v===4));}
});

test('Set Line: Autoback 2 resaves Bob backgrounds and rejects unsupported geometry before disturbing the held Bob',()=>{
  const banks=Buffer.from(fs.readFileSync(path.join(__dirname,'fixtures/image-banks.hex'),'utf8').replace(/\s/g,''),'hex');
  const {program:p}=execute(Buffer.concat([binary([[t('Screen Open'),n(0),t(','),n(64),t(','),n(32),t(','),n(4),t(','),t('Lowres')],[t('Cls Colour'),n(3)],
    [t('Double Buffer')],[t('Autoback'),n(2)],[t('Hot Spot'),n(1),t(','),n(0),t(','),n(0)],[t('Bob'),n(0),t(','),n(0),t(','),n(8),t(','),n(1)],[t('Bob Update')],[t('Set Line'),n(0xaaaa)],[t('Ink2'),n(2),t(','),n(3)],[t('Draw'),n(0),t(','),n(8),t('To'),n(31),t(','),n(8)],[t('Wait Key')]]),banks.subarray(20)]));
  const s=p.display.screen(),frame=s.physicalPixels.slice(),owner=p.bobs.get(0).screen;assert.strictEqual(p.display.point(0,8),1);assert.throws(()=>p.display.draw(0,8,40000,8),/signed words/);assert.deepStrictEqual(s.physicalPixels,frame);assert.strictEqual(p.bobs.get(0).screen,owner);p.bobOff(0);p.updateBobs();for(let x=0;x<32;x++)assert.strictEqual(s.physicalPixels[8*64+x],x%2?3:2);p.stop();
});

test('Roller2 Set Line: original selection/erase/redraw statements match independent blank-preview pixels and phase',()=>{
  const icons=fs.readFileSync(path.join(__dirname,'../examples/Roller2/iffp/icons.abk'),'latin1'),expected=require('./fixtures/roller2/line-pattern.json').frames;
  const {program:p,timers:clock}=execute(require('./helpers/roller2LinePattern')(),1000,{files:{read:name=>name==='icons'?icons:'4,2\r\n',write(){throw Error('write');}}});
  for(const [index,frame]of expected.entries()){if(index){p.sendKey('next');clock.tick(0);}const s=p.display.screen();assert.strictEqual(s.linePattern,frame.pattern);assert.strictEqual(s.linePhase,frame.phase);assert.strictEqual(hash(s.pixels),frame.indicesSha256);const rgba=p.display.canvasFrame().rgba,png=require('./helpers/displayPng').decodePng(fs.readFileSync(path.join(__dirname,'fixtures/roller2',frame.png))).rgba;assert.deepStrictEqual(Buffer.from(rgba),Buffer.from(png));assert.strictEqual(hash(rgba),frame.rgbaSha256);assert.deepStrictEqual([p.state.variables.int_xkst,p.state.variables.int_ykst],frame.cell);assert.strictEqual(p.state.waiting,'key');}
  p.sendKey('finish');clock.tick(0);assert.strictEqual(p.state.halted,true);assert.strictEqual(clock.pending(),0);p.stop();
});
