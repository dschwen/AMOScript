'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const Reader=require('../lib/Buffer'),Tokens=require('../lib/TokenReader'),{binary,token:t,integer:n,identifier:id,execute}=require('./helpers/program');
const root=path.join(__dirname,'../examples/PlanetZybex'),original=fs.readFileSync(path.join(root,'Zybex.AMOS')),fixed=fs.readFileSync(path.join(root,'current/Zybex.AMOS'));
test('Zybex docking source: only three vertical copy lines change, with identical headers/line locations/banks and pinned original/current hashes',()=>{
  const a=new Reader(original),b=new Reader(fixed),manifest=require('../examples/PlanetZybex/current/manifest.json');assert.deepStrictEqual(a.lines,b.lines);assert.deepStrictEqual(original.subarray(0,20),fixed.subarray(0,20));assert.deepStrictEqual(original.subarray(20+a.code_bytes),fixed.subarray(20+b.code_bytes));
  assert.strictEqual(crypto.createHash('sha256').update(original).digest('hex'),manifest.upstream.sha256);assert.strictEqual(crypto.createHash('sha256').update(fixed).digest('hex'),manifest.source.sha256);assert.deepStrictEqual(require('../tools/fix_zybex_docking')(original),fixed);
  const changed=[];for(let i=0;i<a.lines.length;i++){const start=a.lines[i],end=start+original[start]*2;if(!original.subarray(start,end).equals(fixed.subarray(start,end)))changed.push(i+1);}assert.deepStrictEqual(changed,[1494,1499,1506]);
  const tokens=new Tokens(b).read();for(const line of changed){const row=tokens.filter(x=>x.location.line===line);assert.deepStrictEqual(row.slice(0,13).map(x=>x.value??x.name),['Screen Copy Rectangle',1,',',0,',','lop',',',320,',','lop','+',160,'To']);}
});
function fixture(source,line){
  const r=new Reader(source),start=r.lines[line-1],body=Buffer.concat([binary([
    [t('Screen Open'),n(1),t(','),n(320),t(','),n(640),t(','),n(16),t(','),t('Lowres')],[t('Cls Colour'),n(0)],
    ...[[479,3],[480,5],[481,7]].flatMap(([y,c])=>[[t('Ink'),n(c)],[t('Bar'),n(0),t(','),n(y),t('To'),n(319),t(','),n(y)]]),
    [t('Screen Open'),n(2),t(','),n(320),t(','),n(160),t(','),n(16),t(','),t('Lowres')],[t('Cls Colour'),n(2)],[t('Double Buffer')],[t('Autoback'),n(0)],[t('Cls Colour'),n(4)],[id('lop'),t('='),n(480)]
  ]).subarray(20),source.subarray(start,start+source[start]*2),binary([[t('Wait Key')]]).subarray(20)]),header=Buffer.from(source.subarray(0,20));header.writeUInt32BE(body.length,16);return Buffer.concat([header,body,source.subarray(20+r.code_bytes)]);
}
test('Zybex docking source: upstream x=480 copies remain native no-ops; corrected vertical row 480 copies affect Logic only before the ordinary swap',()=>{
  for(const line of [1494,1499,1506])for(const[bytes,corrected]of [[original,false],[fixed,true]]){
    const{program:p}=execute(fixture(bytes,line));const s=p.display.screen(2);assert.ok(s.physicalPixels.every(x=>x===2));assert.ok(s.pixels.subarray(0,320).every(x=>x===(corrected?5:4)));assert.ok(s.pixels.subarray(320,640).every(x=>x===(corrected?7:4)));assert.ok(s.pixels.subarray(640).every(x=>x===(corrected?0:4)),JSON.stringify({line,corrected,values:[...new Set(s.pixels.subarray(640))]}));p.display.swap(2);assert.strictEqual(s.physicalPixels[0],corrected?5:4);p.stop();
  }
});
