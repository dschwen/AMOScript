'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { binary, token: t, integer: n, text, compile, execute } = require('./helpers/program');
const source = () => fs.readFileSync(path.join(__dirname, '../examples/BobTest/BobTest.amos'));
const positions = Buffer.from(require('./fixtures/bob-test/images.json').positions, 'base64');
const images = require('./fixtures/bob-test/images.json').images.map(s => Buffer.from(s, 'base64'));
const statement = (name, ...args) => [t(name), ...args.flatMap((v, i) => [...(i ? [t(',')] : []), n(v)])];

test('BobTest: unchanged complete source creates its own three images and runs all 500 frames with independent paths/composites and background restoration', () => {
  const manifest = require('../examples/BobTest/manifest.json'), bytes = source();
  assert.strictEqual(bytes.length, manifest.bytes); assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), manifest.sha256);
  const { program: p, timers } = execute(bytes, 10000, { maxBobs: 65 });
  assert.strictEqual(p.state.location.line, 23); assert.strictEqual(p.state.waiting, 'key');
  p.banks.get(1).images.forEach((image, i) => { assert.deepStrictEqual(Buffer.from(image.pixels), images[i]); assert.deepStrictEqual([image.hotspotX, image.hotspotY, image.masked], [16,16,true]); });
  const background = p.display.screen().pixels.slice(), update = p.updateBobs; let count = 0, composites = 0;
  p.updateBobs = () => { update(); if (count <= 500) { const pixels = [0,1,100,319,500].includes(count); require('./helpers/checkBobTestFrame')(p, background, images, positions, count, pixels); if (pixels) composites++; } else assert.deepStrictEqual(p.display.screen().pixels, background); count++; };
  p.sendKey('a'); timers.tick(0);
  assert.strictEqual(count, 502); assert.strictEqual(composites, 5); assert.strictEqual(p.state.location.line, 59); assert.strictEqual(p.state.variables.int_f, 501); assert.strictEqual(p.bobs.size, 0);
  p.sendKey('b'); timers.tick(0); assert.strictEqual(p.state.halted, true); assert.strictEqual(timers.pending(), 0);
});

test('Circle and Paint: original tokens compile, preserve cursor, fill four-connected regions and clip without crossing row edges', () => {
  const { program: p } = execute(binary([statement('Cls Colour', 0),[t('Curs Off')],statement('Ink', 2), statement('Circle', 15,15,14), statement('Paint',15,15), statement('Ink',1), statement('Circle',10,10,3), [t('Wait Key')]]));
  p.getBob(1,0,0,32,32); assert.deepStrictEqual(Buffer.from(p.banks.get(1).images[0].pixels), images[0]); assert.deepStrictEqual([p.display.screen().gx,p.display.screen().gy], [10,10]);
  const d = p.display; d.open(1,16,4,4,0); const s = d.screen(); s.pixels.fill(0); s.pixels.set([0,1,0,1],0); s.pixels.fill(1,16); d.ink(3); d.paint(0,0); assert.strictEqual(s.pixels[0],3); assert.strictEqual(s.pixels[2],0); assert.strictEqual(s.pixels[15],0);
  const before = s.pixels.slice(); d.paint(-1,0); assert.deepStrictEqual(s.pixels,before); p.stop();
  assert.throws(() => compile(binary([[t('Circle'),text('x'),t(','),n(0),t(','),n(2)]])), /numeric/);
});

test('Circle/Paint: preflight precedes Bob hooks and Autoback replays both buffers', () => {
  const { program:p } = execute(binary([[t('Wait Key')]])), d=p.display; d.doubleBuffer(); d.autoback(2); let calls=0; d.setDrawingHooks({before(){calls++;},after(){calls++;}});
  const s=d.screen(), before=s.pixels.slice();
  for (const args of [[0,0,0],[0,0,-1],[32767,0,1],[0,0,32768]]) assert.throws(()=>d.circle(...args),/Circle/);
  assert.throws(()=>d.paint(32768,0),/Paint/); assert.strictEqual(calls,0); assert.deepStrictEqual(s.pixels,before);
  d.setLine(0xaaaa); assert.throws(()=>d.circle(5,5,3),/patterned/); assert.strictEqual(calls,0); d.setLine(65535);
  d.ink(2); d.circle(15,15,14); d.paint(15,15); assert.deepStrictEqual(s.pixels,s.physicalPixels); assert.strictEqual(calls,4); assert.strictEqual(s.pixels[15*320+15],2); p.stop();
});

test('Paint: seed colour is captured before live Bob restoration and reused for Autoback', () => {
  const {program:p}=execute(binary([[t('Wait Key')]])),d=p.display,s=d.screen();
  d.clear(0);d.ink(3);d.bar(0,0,3,3);p.getBob(1,0,0,4,4);d.clear(0);p.setBob(0,20,20,1);p.updateBobs();d.autoback(2);
  d.ink(2);d.paint(21,21);assert.strictEqual(s.pixels[21*320+21],3);assert.strictEqual(s.pixels[0],0);assert.strictEqual(s.pixels[30*320+30],0);
  p.bobOff();p.updateBobs();assert.ok(s.pixels.every(v=>v===0));p.stop();
});

test('Get Bob: exclusive word-padded logical capture preserves palette/other images, replaces mask/hotspot and validates before mutation', () => {
  const {program:p}=execute(binary([[t('Wait Key')]])),d=p.display,s=d.screen();s.pixels.fill(3);p.getBob(2,1,0,18,2);const bank=p.banks.get(1), first=bank.images[1],palette=bank.palette;
  assert.strictEqual(bank.images[0],null); assert.strictEqual(first.width,32); assert.ok(first.pixels.every((v,i)=>v===(i%32<17?3:0))); assert.strictEqual(first.masked,true); assert.strictEqual(first.mask,null);
  p.hotSpot(2,3,4); p.makeMask(2); p.getBob(1,0,0,1,1); assert.strictEqual(bank.images[1],first); p.getBob(2,0,0,1,1); assert.strictEqual(bank.palette,palette); assert.deepStrictEqual([bank.images[1].hotspotX,bank.images[1].hotspotY,bank.images[1].mask],[0,0,null]);
  const retained=bank.images[1];for(const args of [[0,0,0,1,1],[1,-1,0,1,1],[1,0,0,321,1],[1,0,0,0,1]]){assert.throws(()=>p.getBob(...args),/Get Bob/);assert.strictEqual(bank.images[1],retained);}
  p.stop();
});

test('Bob count: default 64 remains checked; per-factory configured capacity is bounded and does not change Sprite limits', () => {
  const {create}=compile(binary([[t('Wait Key')]]));for(const maxBobs of [0,257,1.5,'65'])assert.throws(()=>create({maxBobs,setTimeout(){}}),/maxBobs/);
  const {program:p}=execute(source()); p.sendKey('a'); assert.throws(()=>p.tick(10000),/Invalid Bob number/); p.stop();
  const {program:q}=execute(source(),10000,{maxBobs:65});q.setBob(64,0,0,1);assert.throws(()=>q.setBob(65,0,0,1),/Invalid Bob/);assert.throws(()=>q.setSprite(64,0,0,1),/Sprite/);q.stop();
});
