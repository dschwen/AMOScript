/* jshint esversion: 6 */
'use strict';

// Independent fixed offsets in the pinned original binary: bank-4 AmBk at
// 44198, its 20-byte header/name, then 7206 payload bytes through EOF.
// This oracle deliberately does not invoke the production bank decoder.
module.exports=function wonderlandLevelBytes(){
  const fs=require('fs'),path=require('path'),assert=require('assert');
  const bytes=fs.readFileSync(path.join(__dirname,'../../examples/Wonderland/Wonderland.AMOS'));
  assert.strictEqual(bytes.length,51424);
  assert.strictEqual(bytes.subarray(44198,44218).toString('hex'),'416d426b0004000180001c2e4461746173202020');
  return bytes.subarray(44218);
};
