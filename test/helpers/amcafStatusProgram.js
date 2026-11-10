'use strict';
module.exports=function(){
 const{binary,token:t,word:w,integer:n,text}=require('./tokens'),ext=off=>[w(0x4e),[19,0],w(off)];
 const fn=(off,arg)=>arg==null?ext(off):[ext(off),t('('),n(arg),t(')')];
 const report=()=>[t('Print'),fn(0x15de),t(','),fn(0x15f0),t(','),fn(0x15fe,0),t(','),fn(0x160e,0),t(','),fn(0x10e6,0),t(','),fn(0x10e6,0),t(','),fn(0x10b6),t(','),fn(0x10b6)];
 return binary([[ext(0x0456),text('music'),t(','),n(-3)],[ext(0x10f2),n(0)],[ext(0x108e),n(3)],[t('Wait Key')],report(),[t('Wait Key')],report(),[t('Wait Key')],[ext(0x10a8)]]);
};
