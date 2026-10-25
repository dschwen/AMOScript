/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path');
const { binary, token:t, integer:n, word:w, identifier:id, dword, execute, compile } = require('./helpers/program');
const title = fs.readFileSync(path.join(__dirname, '../examples/Roller2/iffp/roller titel'), 'latin1');
const mouseZone = p => p.inputValue('Mouse Zone');
function startMenu() {
  const clock = require('./helpers/fakeTimers').createFakeTimers(4), p = compile(require('./helpers/roller2MenuSelection')()).create({ files:{read:()=>title}, now:clock.now, setTimeout:clock.setTimeout, clearTimeout:clock.clearTimeout });
  p.tick(1000); return { p, clock };
}

test('Mouse Zone: original token uses the current screen, unsigned hardware words and exclusive windows before inclusive zone edges', () => {
  const { program:p } = execute(binary([[t('Reserve Zone Number'),n(2)], [t('Set Zone'),n(1),t(','),n(0),t(','),n(0),t('To'),n(319),t(','),n(199)],
    [t('Set Zone'),n(2),t(','),n(10),t(','),n(10),t('To'),n(20),t(','),n(20)], [t('Wait Key')], [t('Print'),w(0x16e2)], [t('Wait Key')]]));
  for (const [x,y,expected] of [[128,50,1],[447,249,1],[448,249,0],[447,250,0],[127,50,0],[128,49,0],[128+65536,50,1],[-1,50,0]]) {
    p.setMouse(x,y,5); assert.strictEqual(mouseZone(p),expected); assert.strictEqual(p.inputValue('Mouse Key'),5);
  }
  p.setMouse(138,60,1); assert.strictEqual(mouseZone(p),1); assert.strictEqual(p.inputValue('Mouse Click'),1); mouseZone(p); assert.strictEqual(p.inputValue('Mouse Click'),0);
  p.display.hideScreen(); assert.strictEqual(mouseZone(p),1); p.display.open(1,320,200,16,0); assert.strictEqual(mouseZone(p),0); p.display.select(0); assert.strictEqual(mouseZone(p),1);
  p.display.close(1); p.display.close(0); assert.throws(()=>mouseZone(p),/not open/); p.stop();
});

test('Mouse Zone: selected live geometry and scroll apply before View, with hires conversion and no presentation mutation', () => {
  const { program:p } = execute(binary([[t('Wait Key')]])); const d=p.display;
  d.open(1,704,256,16,0x8000); d.screenDisplay(1,128,50,320,128); d.reserveZones(1); d.setZone(1,44,30,46,32); d.screenOffset(1,24,10);
  p.setMouse(138,70); assert.strictEqual(mouseZone(p),1); p.setMouse(139,70); assert.strictEqual(mouseZone(p),1); p.setMouse(140,70); assert.strictEqual(mouseZone(p),0);
  d.close(0); d.autoViewOff(); const before=d.snapshotDisplay(), version=d.version;
  d.screenOffset(1,40,10); p.setMouse(130,70); assert.strictEqual(mouseZone(p),1);
  const staged=d.snapshotDisplay(); assert.deepStrictEqual({...staged.frame,revision:before.frame.revision},{...before.frame}); mouseZone(p); assert.strictEqual(d.version,version+1);
  d.view(); assert.strictEqual(mouseZone(p),1); p.stop();
});

test('Mouse Zone: integer results store through arrays, DATA/scalars and procedure returns in standalone generated code', () => {
  const { program:p, timers:c, logs } = execute(binary([[t('Reserve Zone Number'),n(1)],[t('Set Zone'),n(1),t(','),n(1),t(','),n(1),t('To'),n(5),t(','),n(5)],
    [t('Data'),w(0),n(1)],[t('Read'),id('index')],[t('Dim'),id('a'),t('('),n(1),t(')')],
    [t('Procedure'),dword(0),w(0),0,0,id('query')],[t('End Proc'),t('['),w(0x16e2),t(']')],
    [t('Wait Key')],[id('a'),t('('),id('index'),t(')'),t('='),w(0x16e2)],[id('query',0x12)],
    [t('Print'),id('a'),t('('),id('index'),t(')'),t(','),t('Param')]]));
  p.setMouse(130,52); p.sendKey('go'); c.tick(0); assert.deepStrictEqual(logs,[[1,1]]); p.stop();
  assert.throws(()=>compile(binary([[t('Print'),w(0x16e2),t('('),n(1),t(')')]])),/end of statement/);
});

test('Roller2 menu: original rectangles classify every title position and original selection branches reach declared guards', () => {
  const { p, clock } = startMenu(); const expected=(x,y)=>x<=60&&y>=127&&y<=153?1:x>=260&&x<=319&&y>=127&&y<=153?2:x>=105&&x<=220&&y>=119&&y<=166?3:x>=249&&x<=295&&y>=42&&y<=50?4:0;
  const pixels=p.display.screen().physicalPixels.slice();
  for(let y=0;y<268;y++)for(let x=0;x<320;x++){p.setMouse(128+x,42+y);assert.strictEqual(mouseZone(p),expected(x,y));}
  assert.deepStrictEqual(p.display.screen().physicalPixels,pixels); p.stop(); assert.strictEqual(clock.pending(),0);
  for(const [x,y,action] of [[30,140,'game'],[290,140,'editor'],[150,140,'scores'],[270,46,'help']]){
    const {p,clock}=startMenu();p.setMouse(128+x,42+y,1);clock.tick(640);
    assert.strictEqual(p.state.variables.string_selection,action);assert.strictEqual(p.state.waiting,'key');if(action==='scores')assert.strictEqual(p.state.variables.int_vtb,1);p.stop();
  }
});

test('Roller2 menu: blank clicks, keyboard shortcuts, direct fire and joystick movement retain original branch precedence', () => {
  for(const mode of ['blank','h','help','fire','moved-fire']){
    const {p,clock}=startMenu();
    if(mode==='blank')p.setMouse(128+80,42+80,1);
    if(mode==='h')p.sendKey('h',0x25);
    if(mode==='help')p.sendKey('\0',95);
    if(mode==='fire')p.setJoystick(1,16);
    if(mode==='moved-fire'){p.setMouse(128+28,42+140);p.setJoystick(1,8);clock.tick(24);p.setJoystick(1,16);}
    clock.tick(640);assert.strictEqual(p.state.variables.string_selection,mode==='blank'?'':mode==='h'?'scores':mode==='help'?'help':'game');
    if(mode==='blank')assert.strictEqual(p.state.waiting,null);else assert.strictEqual(p.state.waiting,'key');p.stop();
  }
});
