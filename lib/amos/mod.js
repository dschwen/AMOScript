/* jshint esversion: 6 */
'use strict';

// Bounded, owned 31-instrument / four-channel M.K. file decoder. No playback.
function readMod(bytes) {
  const fail=message=>{throw new Error(`MOD: ${message}`);};
  if(!ArrayBuffer.isView(bytes)||Object.prototype.toString.call(bytes)!=='[object Uint8Array]')fail('expected byte storage');
  if(bytes.length>16*1024*1024)fail('file exceeds 16 MiB');
  const bounds=(at,length)=>{if(at<0||length<0||at>bytes.length-length)fail(`truncated data at byte ${at} (need ${length})`);};
  const word=at=>{bounds(at,2);return bytes[at]*256+bytes[at+1];};
  const text=(at,length)=>{bounds(at,length);return String.fromCharCode(...bytes.subarray(at,at+length)).split('\0')[0];};
  bounds(0,1084);
  const signature=text(1080,4);if(signature!=='M.K.')fail(`unsupported signature ${JSON.stringify(signature)} (expected four-channel M.K.)`);
  const songLength=bytes[950],restart=bytes[951];if(songLength<1||songLength>128)fail('song length must be 1..128');
  const orderTable=Uint8Array.from(bytes.subarray(952,1080));if(orderTable.some(value=>value>127))fail('pattern number exceeds 127');
  // AMOS Track Play addresses sample storage using all 128 order slots.
  const patternCount=Math.max(...orderTable)+1,sampleStart=1084+patternCount*1024;
  bounds(1084,patternCount*1024);
  let end=sampleStart;const descriptors=[];
  for(let index=0;index<31;index++){
    const at=20+index*30,length=word(at+22)*2,finetune=bytes[at+24],volume=bytes[at+25];
    const loopStart=word(at+26)*2,loopLength=word(at+28)*2;
    if(finetune>15)fail(`invalid finetune for sample ${index+1}`);
    if(volume>64)fail(`invalid volume for sample ${index+1}`);
    if(loopStart>length||(loopLength>2&&loopStart+loopLength>length))fail(`loop exceeds sample ${index+1}`);
    bounds(end,length);
    descriptors.push({number:index+1,name:text(at,22),length,finetune:finetune<8?finetune:finetune-16,volume,loopStart,loopLength,looping:loopLength>2,offset:end});
    end+=length;
  }
  if(end!==bytes.length)fail(`unexpected trailing data at byte ${end}`);
  const patterns=[];
  for(let pattern=0;pattern<patternCount;pattern++){
    const cells=[];
    for(let cell=0;cell<256;cell++){
      const at=1084+pattern*1024+cell*4,instrument=(bytes[at]&240)|(bytes[at+2]>>4);
      if(instrument>31)fail(`invalid sample ${instrument} in pattern ${pattern}, row ${cell>>2}, channel ${cell&3}`);
      cells.push({sample:instrument,period:((bytes[at]&15)<<8)|bytes[at+1],effect:bytes[at+2]&15,parameter:bytes[at+3]});
    }
    patterns.push(cells);
  }
  const samples=descriptors.map(sample=>({...sample,pcm:Int8Array.from(bytes.subarray(sample.offset,sample.offset+sample.length),value=>(value<<24)>>24)}));
  return {title:text(0,20),signature,channels:4,songLength,restart,orderTable,orders:orderTable.slice(0,songLength),patternCount,sampleStart,samples,patterns};
}

if(typeof module==='object'&&module.exports)module.exports=readMod;
else globalThis.AMOS_MOD=readMod;
