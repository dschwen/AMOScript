'use strict';
module.exports=function(){
 const{binary,token:t,word:w,integer:n,text}=require('./tokens'),ext=offset=>[w(0x4e),[19,0],w(offset)];
 const fn=(off,args)=>[ext(off),t('('),args,t(')')];
 return binary([
  [ext(0x0456),text('input'),t(','),n(-7)],
  [ext(0x0472),text('snapshot'),t(','),n(7)],
  [ext(0x0480),text('alias'),t(','),t('Start'),t('('),n(7),t(')')],
  [t('Print'),fn(0x0ec8,[n(-12),t(','),n(5)]),t(','),fn(0x0eb8,[n(-12),t(','),n(5)])],
  [t('Print'),fn(0x02f0,text('Data:music/mod.hawkeye')),t(','),fn(0x03e0,text('Data:music/mod.hawkeye')),t(','),fn(0x03ec,text('Data:music'))],
  [t('Print'),fn(0x093a,[n(-8),t(','),n(1)]),t(','),fn(0x092e,[n(1),t(','),n(32)])],
  [t('Wait Key')]
 ]);
};
