'use strict';
module.exports=function amcafPreviewProgram(){
  const{binary,token:t,word:w,integer:n,text}=require('./tokens');
  const ext=(slot,offset)=>[w(0x4e),[slot,0],w(offset)];
  return binary([
    [t('Print'),text('AMCAF streaming music - compiled AMOS')],
    [t('Print'),text('Q: stop voice 1, Q: raw effect, Q: end.')],
    [t('Print'),text('Page Stop/Resume pauses the whole song.')],
    [ext(1,0x2ba),text('music.mod'),t(','),n(3)],
    [ext(8,0x108e),n(3)],
    [t('Reserve As Chip Work'),n(5),t(','),n(4096)],
    [w(0x180c),text('sound.raw'),t(','),n(5)],
    [ext(8,0x142a),n(5)],
    [t('Wait Key')],[ext(8,0x1400),n(1)],
    [t('Wait Key')],[ext(8,0x1412),n(8),t(','),t('Start'),t('('),n(5),t(')'),t(','),n(4096),t(','),n(8000)],
    [t('Wait Key')],[ext(8,0x10a8)],[t('End')]
  ]);
};
