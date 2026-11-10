'use strict';
// Original synthetic raw PCM: a 64-byte signed sawtooth, repeated 64 times.
module.exports=()=>Buffer.from(Array.from({length:4096},(_,i)=>((i%64)*4-128)&255));
