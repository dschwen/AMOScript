/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {binary,token:t,integer:n,word:w,identifier:id,dword,execute,compile}=require('./helpers/program');
const screen=(width=35,height=25)=>[t('Screen Open'),n(0),t(','),n(width),t(','),n(height),t(','),n(16),t(','),t('Lowres')];

test('Cline: original bare token clears the whole current text row in paper colour and preserves cursor and partial edge pixels',()=>{
  const {program:p}=execute(binary([screen(),[t('Cls Colour'),n(5)],[t('Paper'),n(3)],[t('Locate'),n(2),t(','),n(1)],[w(0x158a)],[t('Wait Key')]])),s=p.display.screen();
  for(let y=0;y<25;y++)for(let x=0;x<35;x++)assert.strictEqual(p.display.point(x,y),y>=8&&y<16&&x<32?3:5);
  assert.deepStrictEqual([s.x,s.y,s.paper,s.pen,s.ink],[2,1,3,2,2]);assert.strictEqual(s.pixels,s.physicalPixels);p.stop();
});

test('Cline: Autoback modes preserve buffer identities and clear exactly the applicable rows',()=>{
  for(const mode of [0,1,2]){
    const {program:p}=execute(binary([screen(32,24),[t('Double Buffer')],[t('Autoback'),n(mode)],[t('Paper'),n(3)],[t('Locate'),n(2),t(','),n(1)],[t('Wait Key')]])),s=p.display.screen(),logical=s.pixels,physical=s.physicalPixels;
    logical.fill(5);physical.fill(6);p.display.clearLine();assert.strictEqual(s.pixels,logical);assert.strictEqual(s.physicalPixels,physical);
    for(let i=0;i<logical.length;i++){const cleared=i>=32*8&&i<32*16;assert.strictEqual(logical[i],cleared?3:5);assert.strictEqual(physical[i],cleared&&mode?3:6);}
    assert.deepStrictEqual([s.x,s.y],[2,1]);p.stop();
  }
});

test('Cline: Autoback 2 restores and resaves Bob backgrounds without removing the owner or captured pixels',()=>{
  const banks=Buffer.from(fs.readFileSync(path.join(__dirname,'fixtures/image-banks.hex'),'utf8').replace(/\s/g,''),'hex');
  const source=Buffer.concat([binary([[t('Screen Open'),n(0),t(','),n(64),t(','),n(32),t(','),n(4),t(','),t('Lowres')],[t('Cls Colour'),n(3)],
    [t('Double Buffer')],[t('Autoback'),n(2)],[t('Paper'),n(2)],[t('Hot Spot'),n(1),t(','),n(0),t(','),n(0)],
    [t('Bob'),n(0),t(','),n(0),t(','),n(8),t(','),n(1)],[t('Bob Update')],[t('Locate'),n(4),t(','),n(1)],[w(0x158a)],[t('Wait Key')]]),banks.subarray(20)]);
  const {program:p}=execute(source),s=p.display.screen(),owner=p.bobs.get(0).screen;assert.strictEqual(owner,s);assert.strictEqual(p.display.point(0,8),1);
  p.bobOff(0);p.updateBobs();assert.strictEqual(s.physicalPixels[8*64],2);p.updateBobs();assert.strictEqual(p.display.point(0,8),2);assert.strictEqual(s.physicalPixels[8*64],2);assert.strictEqual(p.display.point(0,0),3);p.stop();
});

test('Cline: hidden selection and procedure calls use current screen; unsupported counted form and missing screens fail with context',()=>{
  const {program:p}=execute(binary([screen(32,24),[t('Cls Colour'),n(5)],
    [t('Screen Open'),n(1),t(','),n(32),t(','),n(24),t(','),n(16),t(','),t('Lowres')],[t('Screen Hide')],[t('Paper'),n(3)],
    [t('Procedure'),dword(0),w(0),0,0,id('clear')],[w(0x158a)],[t('End Proc')],[id('clear',0x12)],[t('Wait Key')]]));
  assert.strictEqual(p.display.screen(0).physicalPixels[0],5);assert.strictEqual(p.display.screen(1).physicalPixels[0],3);assert.strictEqual(p.display.screen(1).hidden,true);p.stop();
  assert.throws(()=>compile(binary([[w(0x1596),n(1)]])),/Unsupported token 0x1596/);
  assert.throws(()=>compile(binary([[w(0x158a),n(1)]])),/end of statement/);
  assert.throws(()=>execute(binary([[t('Screen Close'),n(0)],[w(0x158a)]])),/not open.*line 2, byte/);
});
