'use strict';
function packed(){
  const h=Buffer.alloc(114);h.writeUInt32BE(0x12031990);h.writeUInt16BE(368,4);h.writeUInt16BE(4,6);h.writeUInt16BE(113,8);h.writeUInt16BE(42,10);h.writeUInt16BE(368,12);h.writeUInt16BE(4,14);h.writeUInt16BE(0x1204,20);h.writeUInt16BE(2,22);h.writeUInt16BE(1,24);h.writeUInt16BE(0xfff,28);h.writeUInt32BE(0x06071963,90);h.writeUInt16BE(46,98);h.writeUInt16BE(1,100);h.writeUInt16BE(4,102);h.writeUInt16BE(1,104);h.writeUInt32BE(29,106);h.writeUInt32BE(25,110);return Buffer.concat([h,Buffer.from([0xa5,0,0,0,0,0])]);
}
module.exports=function narrowPackedProgram(){
  const {binary,token:t,word:w,integer:n,text,identifier:id}=require('./tokens');
  const args=a=>a.flatMap((v,i)=>[i?t(','):[],n(v)]),open=(id,width,height,colours)=>[t('Screen Open'),args([id,width,height,colours]),t(','),t('Lowres')];
  const payload=packed(),head=Buffer.alloc(20);head.write('AmBk');head.writeUInt16BE(6,4);head.writeUInt32BE(payload.length+8,8);head.write('Pac.Pic.',12);
  const bytes=binary([open(0,302,180,64),[t('Curs Off')],[t('Flash Off')],[t('Colour'),args([3,0xff0])],[t('Cls Colour'),n(3)],[id('mainwidth'),t('='),t('Screen Width')],[t('Wait Key')],
    [t('Load Bank'),text('lace.abk'),t(','),n(6)],[t('Auto View Off')],open(2,368,4,2),[t('Colour'),args([1,0x123])],[t('Screen Hide Number'),n(2)],[[0,0x4e,2,0,0,0x48],n(6)],[t('Auto View On')],
    open(6,86,20,64),[id('scratchwidth'),t('='),t('Screen Width')],[t('Curs Off')],[t('Flash Off')],[t('Colour'),args([0,0])],[t('Colour'),args([1,0x0f0])],[t('Cls Colour'),n(32)],
    [t('Screen Copy Rectangle'),args([2,0,2,80,4]),t('To'),args([6,0,0])],[t('Wait Key')],[t('Screen Hide Number'),n(6)],[t('Wait Key')]]);
  return {bytes,bank:Buffer.concat([head,payload]),payload,widths:[288,80,288],heights:[180,20,180]};
};
module.exports.packed=packed;
