/* jshint esversion: 6 */
'use strict';
const assert=require('assert');
const {binary,token:t,integer:n,text,execute,compile}=require('./helpers/program');

test('sparse Fade: leading/interior/trailing omissions retain register positions and unrelated palette state',()=>{
  const {program:p,timers:c}=execute(binary([[t('Palette'),...Array.from({length:5},(_,i)=>[...(i?[t(',')]:[]),n(0xabc)])],
    [t('Fade'),n(1),t(','),t(','),n(0x123),t(','),t(','),n(0x456),t(',')],[t('Wait Key')]]));
  c.tick(320);assert.deepStrictEqual(Array.from(p.display.screen().palette.slice(0,5)),[0xabc,0x123,0xabc,0x456,0xabc]);p.stop();assert.strictEqual(c.pending(),0);
});

test('sparse Fade: all-omitted lists cancel only the fade and accept the exact 32-register boundary',()=>{
  const {program:p}=execute(binary([[t('Fade'),n(1),...Array.from({length:32},()=>t(','))],[t('Wait Key')]]));
  assert.strictEqual(p.state.fade.active,false);p.fade(1);assert.strictEqual(p.state.fade.active,true);p.fadeColours(1,[null,null]);assert.strictEqual(p.state.fade.active,false);p.stop();
  assert.throws(()=>compile(binary([[t('Fade'),n(1),...Array.from({length:33},()=>t(','))]])),/at most 32/);
});

test('sparse Fade: supplied expressions evaluate once and invalid boxed floats preserve the existing job',()=>{
  let calls=0;const {program:p,timers:c}=execute(binary([[t('Fade'),n(1),t(','),t(','),t('Exist'),t('('),text('x'),t(')'),t(',')],[t('Wait Key')]]),100,{files:{exists(){calls++;return true;}}});
  c.tick(400);assert.strictEqual(calls,1);assert.strictEqual(p.display.screen().palette[1],0xf80); // True is negative and is skipped.
  p.fade(2);const before=p.state.fade;assert.throws(()=>p.fadeColours(1,[null,{value:p.val('1.5'),type:'dynamic'}]),/integer values/);assert.strictEqual(p.state.fade,before);p.stop();
  assert.throws(()=>compile(binary([[t('Fade'),n(1),t(','),t(','),text('bad')]])),/integer values/);
});
