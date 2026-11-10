'use strict';
module.exports=function(){
 const{binary,token:t,word:w,integer:n}=require('./tokens'),e=off=>[w(0x4e),[8,0],w(off)],draw=(x,y,a,b,c,m)=>[e(m==null?0x1016:0x1030),n(x),t(','),n(y),t('To'),n(a),t(','),n(b),t(','),n(c),...(m==null?[]:[t(','),n(m)])];
 return binary([[t('Screen Open'),n(0),t(','),n(64),t(','),n(64),t(','),n(8),t(','),n(0)],
 [t('Cls Colour'),n(4)],[t('Double Buffer')],[t('Autoback'),n(0)],
 draw(4,4,28,12,3),draw(4,28,28,20,1,1),draw(20,4,20,28,0,2),[t('Set Line'),n(0xa55a)],draw(6,32,26,32,3,3),[e(0x388),n(31),t(','),n(31),t(','),n(15)],
 [t('Wait Key')],[t('Screen Swap')],[t('Wait Key')],[t('Set Line'),n(65535)],
 draw(12,40,8,60,1,-1),draw(13,40,19,60,1,-1),draw(35,35,33,60,1,-1),draw(36,35,40,60,1,-1),[t('Wait Key')],
 [e(0x1066),n(0),t(','),n(0),t(','),n(0),t(','),n(32),t(','),n(64),t(','),n(64)],
 [e(0x1258)],[t('Screen Swap')],[t('Wait Key')]]);
};
