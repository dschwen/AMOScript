'use strict';
// Declared synthetic inputs, not recovered AMCAF assets. Layouts are written
// directly from the ILBM and AmBk formats, independently of their encoders.
function picture(compression=0) {
 const chunk=(id,bytes)=>{const h=Buffer.alloc(8);h.write(id);h.writeUInt32BE(bytes.length,4);return Buffer.concat([h,bytes,...(bytes.length%2?[Buffer.alloc(1)]:[])]);};
 const bm=Buffer.alloc(20);bm.writeUInt16BE(16);bm.writeUInt16BE(2,2);bm[8]=2;bm[10]=compression;bm[14]=bm[15]=1;bm.writeUInt16BE(16,16);bm.writeUInt16BE(2,18);
 const body=Buffer.from([128,64,32,16,8,4,2,1]),cmap=Buffer.from([0,0,0,255,0,0,0,255,0,0,0,255]);
 const data=Buffer.concat([Buffer.from('ILBM'),chunk('BMHD',bm),chunk('CMAP',cmap),chunk('BODY',compression?Buffer.concat([...body].map(b=>Buffer.from([0,b]))):body)]),head=Buffer.alloc(8);head.write('FORM');head.writeUInt32BE(data.length,4);
 const raw=Buffer.alloc(32);raw.set([128,64,8,4,32,16,2,1]);const col=Buffer.alloc(1024);for(let i=0;i<4;i++)col.set(cmap.subarray(i*3,i*3+3),i*4+1);
 return{input:Buffer.concat([head,data]),raw,col};
}
function sample() {
 const pcm=Buffer.from(Array.from({length:2048},(_,i)=>((i%64)<32?(i%32)*7:217-(i%32)*7)-112));
 const data=Buffer.alloc(20+20+pcm.length);data.write('AmBk');data.writeUInt16BE(5,4);data.writeUInt32BE(0x80000000+8+20+pcm.length,8);data.write('Samples ',12);data.writeUInt16BE(1,20);data.writeUInt32BE(6,22);data.write('Tone    ',26);data.writeUInt16BE(8000,34);data.writeUInt32BE(pcm.length,36);data.set(pcm,40);
 const fixed=Buffer.from(data);fixed[40]=fixed[41]=0;return{input:data,fixed};
}
module.exports={picture,sample};
