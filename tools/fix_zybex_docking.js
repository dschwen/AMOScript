'use strict';
// Offline tokenized-source correction. Never called by the compiler/runtime.
const crypto=require('crypto'),Reader=require('../lib/Buffer'),Tokens=require('../lib/TokenReader');
function fixDocking(source){
  if(crypto.createHash('sha256').update(source).digest('hex')!=='fdcd685b871cadc7473e103d80cf78293402c839a5dd71922ffcef0213371145')throw Error('Expected pinned upstream Zybex source');
  const out=Buffer.from(source),tokens=new Tokens(new Reader(source)).read();
  for(const line of [1494,1499,1506]){
    const row=tokens.filter(t=>t.location.line===line),bytes=i=>source.subarray(row[i].location.offset,row[i+1].location.offset);
    if(row[0].name!=='Screen Copy Rectangle'||row[3].value!=='lop'||row[5].value!==0||row[9].value!==320||row[11].value!==160||row[12].name!=='To')throw Error('Unexpected docking statement');
    // 1,lop,0,lop+320,160 -> 1,0,lop,320,lop+160. Keep every
    // cached operand and the same physical line size/branch byte locations.
    const replacement=Buffer.concat([bytes(5),bytes(4),bytes(3),bytes(6),bytes(9),bytes(10),bytes(7),bytes(8),bytes(11)]);
    if(replacement.length!==row[12].location.offset-row[3].location.offset)throw Error('Docking line size changed');
    replacement.copy(out,row[3].location.offset);
  }
  return out;
}
if(require.main===module){const fs=require('fs');if(process.argv.length!==4)throw Error('Usage: node tools/fix_zybex_docking.js upstream.AMOS output.AMOS');fs.writeFileSync(process.argv[3],fixDocking(fs.readFileSync(process.argv[2])),{flag:'wx'});}
module.exports=fixDocking;
