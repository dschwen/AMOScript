'use strict';
module.exports=function amcafPreviewProgram(){
  const{binary,token:t,word:w,integer:n,text}=require('./tokens');
  const ext=(slot,offset)=>[w(0x4e),[slot,0],w(offset)];
  return binary([
    [t('Print'),text('AMCAF streaming music - compiled AMOS')],
    [t('Print'),text('Use the page controls to Stop or Resume.')],
    [ext(1,0x2ba),text('music.mod'),t(','),n(3)],
    [ext(8,0x108e),n(3)],
    [t('Wait Key')],[ext(8,0x10a8)],[t('End')]
  ]);
};
