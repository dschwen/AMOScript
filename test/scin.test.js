/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),createDisplay=require('../lib/amos/display');
const {binary,token:t,integer:n,word:w,identifier:id,text,dword,compile,execute}=require('./helpers/program');
const outside=-2147483648;
function stack(){const d=createDisplay();d.open(0,320,250,16,0);d.open(1,320,128,16,0);d.screenDisplay(1,128,140,320,32);d.open(2,320,128,16,0);d.screenDisplay(2,128,160,320,32);d.select(0);return d;}

test('Scin: priority-list traversal, explicit start, unsigned hardware edges and EntNul match an independent exhaustive rectangle oracle',()=>{
  const d=stack(),rectangles=[[2,128,160,448,192],[1,128,140,448,172],[0,128,50,448,300]];
  const oracle=(x,y,from=-1)=>{x&=65535;y&=65535;const first=from===-1?0:rectangles.findIndex(r=>r[0]===from);const hit=rectangles.slice(first).find(r=>x>=r[1]&&x<r[3]&&y>=r[2]&&y<r[4]);return hit?hit[0]:outside;};
  const version=d.version;
  for(let y=0;y<330;y++)for(const x of [127,128,129,447,448,65535])for(const from of [-1,0,1,2])assert.strictEqual(d.screenIn(from,x,y),oracle(x,y,from));
  assert.strictEqual(d.screenIn(130,165),2);assert.strictEqual(d.screenIn(1,130,165),1);assert.strictEqual(d.screenIn(0,130,165),0);
  assert.strictEqual(d.screenIn(130+65536,165-65536),2);assert.strictEqual(d.screenIn(-1,165),outside);assert.strictEqual(d.current,0);assert.strictEqual(d.version,version);
  d.hideScreen(2);assert.strictEqual(d.screenIn(130,165),1);d.hideScreen(1);assert.strictEqual(d.screenIn(1,130,165),0);d.showScreen(2);d.screenToFront(0);assert.strictEqual(d.screenIn(130,165),0);
  d.close(2);d.clone(3);assert.strictEqual(d.screenIn(130,165),3,'Visible clones participate despite being unselectable');d.hideScreen(3);assert.strictEqual(d.screenIn(130,165),0);
});

test('Scin: live geometry/visibility/order precede View, hires uses hardware width and source offsets do not move the hit rectangle',()=>{
  const d=createDisplay();d.open(0,768,200,16,0x8000);d.screenDisplay(0,128,50,320,200);d.screenOffset(0,100,0);
  assert.strictEqual(d.screenIn(447,249),0);assert.strictEqual(d.screenIn(448,249),outside);
  const before=d.canvasFrame().rgba;d.autoViewOff();d.screenDisplay(0,128,100,160,100);
  const version=d.version;assert.strictEqual(d.screenIn(287,199),0);assert.strictEqual(d.screenIn(288,199),outside);assert.strictEqual(d.screenIn(128,99),outside);assert.deepStrictEqual(d.canvasFrame().rgba,before);assert.strictEqual(d.version,version);
  d.hideScreen(0);assert.strictEqual(d.screenIn(128,100),outside);d.showScreen(0);assert.strictEqual(d.screenIn(128,100),0);d.view();assert.strictEqual(d.current,0);
  const a=createDisplay(),b=createDisplay();a.open(0,320,200,16,0);b.open(1,320,200,16,0);assert.strictEqual(a.screenIn(128,50),0);assert.strictEqual(b.screenIn(128,50),1);
});

test('Scin: original token arities, typed arrays/DATA/procedure results and boxed numeric arguments run standalone in once-only order',()=>{
  const {program:p,logs}=execute(binary([[t('Data'),w(0),n(128),t(','),n(50)],[t('Read'),id('hx'),t(','),id('hy')],[t('Dim'),id('a'),t('('),n(1),t(')')],
    [id('a'),t('('),n(1),t(')'),t('='),w(0x16b6),t('('),id('hx'),t(','),id('hy'),t(')')],
    [t('Procedure'),dword(0),w(0),0,0,id('query')],[t('End Proc'),t('['),w(0x16c4),t('('),n(-1),t(','),n(128),t(','),n(50),t(')'),t(']')],
    [id('query',0x12)],[t('Print'),id('a'),t('('),n(1),t(')'),t(','),t('Param'),t(','),w(0x16b6),t('('),n(0),t(','),n(0),t(')')],[t('Wait Key')]]));
  assert.deepStrictEqual(logs,[[0,0,outside]]);p.stop();
  const order=[],value=name=>[t('Val'),t('('),t('Fsel$'),t('('),text(name),t(')'),t(')')];
  const {program:q,logs:ql}=execute(binary([[t('Print'),t('Scin From'),t('('),value('start'),t(','),value('x'),t(','),value('y'),t(')')],[t('Wait Key')]]),1000,{files:{select({path}){order.push(path);return {start:'-1.5',x:'128.9',y:'50.2'}[path];}}});assert.deepStrictEqual(order,['start','x','y']);assert.deepStrictEqual(ql,[[0]]);q.stop();
});

test('Scin: unsupported selectors, closed screens, missing current screen and malformed signatures fail without changing display state',()=>{
  const d=stack(),version=d.version,selected=d.current;
  for(const from of [-2,8,65535])assert.throws(()=>d.screenIn(from,128,50),/Unsupported Scin/);
  assert.throws(()=>d.screenIn(7,128,50),/not open/);assert.strictEqual(d.version,version);assert.strictEqual(d.current,selected);
  d.close(2);d.close(1);d.close(0);assert.throws(()=>d.screenIn(128,50),/not open/);
  assert.throws(()=>compile(binary([[t('Print'),t('Scin'),t('('),text('128'),t(','),n(50),t(')')]])),/Wrong argument type.*line 1/);
  assert.throws(()=>compile(binary([[t('Print'),t('Scin'),t('('),n(128),t(')')]])),/Expected ,|expects|argument/);
  assert.throws(()=>execute(binary([[t('Print'),t('Scin From'),t('('),n(7),t(','),n(128),t(','),n(50),t(')')]])),/not open.*line 1, byte/);
  assert.throws(()=>execute(binary([[t('Print'),t('Scin From'),t('('),n(-2),t(','),n(128),t(','),n(50),t(')')]])),/Unsupported Scin.*line 1, byte/);
});

test('Roller2 Scin: unchanged pointer lines select front/back windows, retain selection outside, convert offsets and query live zones without drawing',()=>{
  const {program:p,timers:c}=execute(require('./helpers/roller2Scin')()),before=p.display.canvasFrame().rgba;
  for(const [hx,hy,sn,selected,x,y,mz]of [[132,54,0,0,4,4,1],[132,144,1,1,20,12,1],[148,160,1,1,36,28,1],[448,160,outside,1,336,28,0],[128,172,0,0,0,122,0],[128,139,0,0,0,89,0],[127,49,outside,0,-1,-1,0]]){
    p.setMouse(hx,hy,1);p.sendKey('step');c.tick(0);const v=p.state.variables;assert.deepStrictEqual([v.int_xs,v.int_ys,v.int_sn,p.display.current,v.int_x,v.int_y,v.int_mz],[hx,hy,sn,selected,x,y,mz]);assert.strictEqual(p.state.waiting,'key');assert.deepStrictEqual(p.display.canvasFrame().rgba,before);assert.strictEqual(p.inputValue('Mouse Click'),hx===132&&hy===54?1:0);
  }
  p.stop();assert.strictEqual(c.pending(),0);
});
