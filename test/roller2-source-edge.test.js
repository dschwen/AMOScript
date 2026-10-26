/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const Reader = require('../lib/Buffer'), Tokens = require('../lib/TokenReader');
const { binary, token: t, integer: n, identifier: id, execute } = require('./helpers/program');
const root = path.join(__dirname, '../examples/Roller2'), original = fs.readFileSync(path.join(root, 'Roller II.AMOS')), fixed = fs.readFileSync(path.join(root, 'current/Roller II.AMOS'));
function fixture(source, bx, by, dx, dy, wall = false) {
  const r = new Reader(source), line = i => source.subarray(r.lines[i - 1], r.lines[i - 1] + source[r.lines[i - 1]] * 2);
  const rows = [[t('Reserve As Work'),n(10),t(','),n(490)], ...Object.entries({bx,by,dx,dy,hd:7,hc:99,v:0,fx:1}).map(([name,value])=>[id(name),t('='),n(value)])];
  if (wall) for (const [offset,value] of [[bx+dx+(by+dy)*20,33],[240+bx+dx+(by+dy)*20,4]]) rows.push([t('Poke'),t('Start'),t('('),n(10),t(')'),t('+'),n(offset),t(','),n(value)]);
  const body = Buffer.concat([line(15),binary(rows).subarray(20),...Array.from({length:5},(_,i)=>line(641+i)),binary([[t('Wait Key')],[t('End')],[id('joab',0xc)],[id('hit'),t('='),n(1)],[t('Wait Key')],[t('End')]]).subarray(20)]);
  const header=Buffer.from(source.subarray(0,20));header.writeUInt32BE(body.length,16);return Buffer.concat([header,body,source.subarray(20+r.code_bytes)]);
}
const files = { read: () => fs.readFileSync(path.join(root,'music/Roller_II_Samples.Abk'),'latin1') };
test('Roller2 AMOS source: only movement lines 642/645 change; the edge guard precedes both map reads and the original wall branch remains', () => {
  const a = new Reader(original), b = new Reader(fixed); assert.strictEqual(a.lines.length,b.lines.length);
  const changed=[];for(let i=0;i<a.lines.length;i++){const aa=original.subarray(a.lines[i],a.lines[i]+original[a.lines[i]]*2),bb=fixed.subarray(b.lines[i],b.lines[i]+fixed[b.lines[i]]*2);if(!aa.equals(bb))changed.push(i+1);}
  assert.deepStrictEqual(changed,[642,645]); assert.deepStrictEqual(original.subarray(20+a.code_bytes),fixed.subarray(20+b.code_bytes));
  const tokens=new Tokens(b).read();assert.ok(tokens.filter(x=>x.location.line===642).some(x=>x.name==='If'));
  assert.strictEqual(tokens.filter(x=>x.location.line===643&&x.name==='Peek').length,1); assert.strictEqual(tokens.filter(x=>x.location.line===644&&x.name==='Peek').length,1);
  const expected=require('../examples/Roller2/current/manifest.json');assert.strictEqual(crypto.createHash('sha256').update(fixed).digest('hex'),expected.files['Roller II.AMOS'].sha256);
});
test('Roller2 AMOS source: all four edges use original bump/wait/return without reading outside the bank; interior/wall cells keep ordinary reads', () => {
  for(const [bx,by,dx,dy] of [[0,5,-1,0],[19,5,1,0],[10,0,0,-1],[17,11,0,1]]){
    const {program:p,timers:c}=execute(fixture(fixed,bx,by,dx,dy),1000,{files});c.tick(20);
    assert.strictEqual(p.state.variables.int_hit,1);assert.strictEqual(p.state.variables.int_last,7);assert.strictEqual(p.state.variables.int_hc,99);assert.strictEqual(p.state.variables.int_hd,0);
    assert.strictEqual(p.state.variables.int_bx,bx);assert.strictEqual(p.state.variables.int_by,by);assert.throws(()=>p.peek(p.bankStart(10)+490),/out of bounds/);p.stop();
  }
  for(const wall of [false,true]){const {program:p,timers:c}=execute(fixture(fixed,8,5,1,0,wall),1000,{files});c.tick(20);assert.strictEqual(p.state.variables.int_hit,wall?1:0);assert.strictEqual(p.state.variables.int_hc,wall?4:0);p.stop();}
  assert.throws(()=>execute(fixture(original,17,11,0,1),1000,{files}),/Bank memory address out of bounds/);
});
