'use strict';
const assert=require('assert'),crypto=require('crypto'),original=require('./helpers/amcafOriginal'),oracle=require('./fixtures/amcaf/gameports.json');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function crop(p,x,y,w,h){const b=Buffer.alloc(w*h),s=p.display.screen(0);for(let row=0;row<h;row++)b.set(s.physicalPixels.slice((y+row)*320+x,(y+row)*320+x+w),row*w);return b;}
test('AMCAF GamePorts: original source draws independent joystick/pad regions and exits through normal input',()=>{
 const{p,clock}=original('GamePorts');p.tick(10000);clock.tick(80);assert.strictEqual(p.state.variables.int_lowlevel,1);
 for(const mask of [0,1,2,4,8,16,17,18,20,24,31,0]){p.setJoystick(0,mask);p.setParallelJoystick(0,mask);p.setJoystick(1,mask);p.setParallelJoystick(1,mask);clock.tick(60);for(let port=0;port<4;port++)assert.strictEqual(hash(crop(p,port*80,132,80,68)),oracle.joysticks[mask],`mask ${mask}, port ${port}`);}
 for(const {mask,sha256} of oracle.pads){p.setJoystick(0,0);p.setPortButtons(0,mask);clock.tick(60);assert.strictEqual(hash(crop(p,24,83,128,47)),sha256,`pad ${mask}`);}
 p.sendKey('\x1b');clock.tick(40);assert(p.state.halted);assert.strictEqual(clock.pending(),0);
});
test('AMCAF devices: Xfire exposes seven nondestructive buttons without leaking higher bits into Smouse Key or five-bit Joy',()=>{
 const{p}=original('GamePorts');p.tick(10000);p.setPortButtons(1,127);assert.strictEqual(p.extensionSmouseKey(),7);assert.strictEqual(p.joystickInfo('Joy',1),16);for(let i=0;i<7;i++)assert.strictEqual(p.extensionXfire(1,i),-1);
 p.setParallelJoystick(0,31);assert.strictEqual(p.extensionPjoy(0),31);p.keySpeed(10,2);assert.strictEqual(p.extensionPjoy(0),31);p.stop();assert.strictEqual(p.extensionPjoy(0),0);assert.strictEqual(p.portButtons(1),0);
 for(const args of [[2,0],[0,-1],[0,7]])assert.throws(()=>p.extensionXfire(...args));assert.throws(()=>p.setParallelJoystick(0,32));assert.throws(()=>p.setPortButtons(1,128));
});
test('AMCAF second mouse: native signed words, fractional movement, speed rescaling and signed clamps preserve independent state',()=>{
 const{p}=original('GamePorts');p.tick(10000);p.extensionLimitSmouse(0,0,100,100);p.extensionSmouseX(50);p.extensionSmouseY(50);p.moveSecondaryMouse(1,-1);assert.strictEqual(p.extensionXSmouse(),50);assert.strictEqual(p.extensionYSmouse(),49);p.moveSecondaryMouse(1,1);assert.strictEqual(p.extensionXSmouse(),51);assert.strictEqual(p.extensionYSmouse(),50);
 p.extensionSmouseSpeed(2);assert.strictEqual(p.extensionXSmouse(),51);p.moveSecondaryMouse(4,0);assert.strictEqual(p.extensionXSmouse(),52);p.extensionSmouseX(99);p.moveSecondaryMouse(126,0);assert.strictEqual(p.extensionXSmouse(),100);
 p.extensionSmouseY(-3);assert.strictEqual(p.extensionYSmouse(),-3);p.moveSecondaryMouse(0,0);assert.strictEqual(p.extensionYSmouse(),0);const before=p.extensionXSmouse();assert.throws(()=>p.extensionSmouseSpeed(5));assert.strictEqual(p.extensionXSmouse(),before);p.stop();assert.strictEqual(p.extensionXSmouse(),before);
});
