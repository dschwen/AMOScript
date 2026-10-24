/* jshint esversion: 6 */
'use strict';
const fs=require('fs'),readMod=require('../lib/amos/mod');
function summarizeMod(module){
  const effects={};
  for(const pattern of module.patterns)for(const cell of pattern)if(cell.effect||cell.parameter){const key=cell.effect.toString(16)+(cell.effect===14?(cell.parameter>>4).toString(16):'');effects[key]=(effects[key]||0)+1;}
  return {title:module.title,signature:module.signature,channels:module.channels,songLength:module.songLength,restart:module.restart,orders:Array.from(module.orders),patterns:module.patternCount,sampleStart:module.sampleStart,
    samples:module.samples.filter(s=>s.length).map(({pcm,...sample})=>sample),effects,evidence:'Static MOD structure and effect inventory; no tracker playback or Amiga execution capture.'};
}
if(require.main===module){try{if(process.argv.length!==3)throw new Error('Usage: node tools/audit_mod.js file.mod');process.stdout.write(JSON.stringify(summarizeMod(readMod(fs.readFileSync(process.argv[2]))),null,2)+'\n');}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={summarizeMod};
