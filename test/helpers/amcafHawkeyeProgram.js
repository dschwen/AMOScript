'use strict';
// Declared music harness: original packed tune, not either original GUI player.
module.exports=function(){
 const{binary,token:t,word:w,integer:n,text}=require('./tokens'),ext=off=>[w(0x4e),[8,0],w(off)];
 return binary([
  [t('Print'),text('AMCAF Hawkeye - packed module playback')],
  [t('Print'),text('Press a key to mute voice 1, then restore it.')],
  [ext(0xea2),text('Data/mod.hawkeye'),t(','),n(-3)],
  [ext(0x108e),n(3)],
  [t('Wait Key')],[ext(0x10d6),n(14)],[t('Print'),text('Voice 1 disabled. Press a key to re-enable.')],
  [t('Wait Key')],[ext(0x10d6),n(15)],[t('Print'),text('All voices enabled; new notes resume voice 1.')],
  [t('Print'),text('Press another key to stop.')],
  [t('Wait Key')],[ext(0x10a8)],[t('End')]
 ]);
};
