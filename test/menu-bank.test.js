'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const codec=require('../lib/amos/menuBank')();
const raw=()=>Uint8Array.from(require('../lib/BankReader').readFile(fs.readFileSync(path.join(__dirname,'../examples/Tutorial/Tutorials/Menus/Data.Menu'))).banks[0].data);

test('Menu banks: native relative pointers recover all 106 supplied records, drawing commands and explicit positions',()=>{
  const data=raw(),tree=codec.decode(data),nodes=[];const visit=(items,prefix=[])=>{for(const node of items){nodes.push({path:[...prefix,node.number],node});visit(node.children,[...prefix,node.number]);}};visit(tree);
  assert.strictEqual(nodes.length,106);assert.strictEqual(tree.length,5);assert.deepStrictEqual(tree.map(node=>node.objects[1][0].text),['PICTURE  ','SELECT  ','COLOURS  ','MODE  ','PATTERN ']);
  const pattern=nodes.find(n=>n.path.join(',')==='5,3,9').node;assert.deepStrictEqual([pattern.x,pattern.y,pattern.flags],[32,-112,74]);assert.deepStrictEqual(pattern.objects[1].map(c=>[c.code,...c.args]),[[20,9],[8,30,15]]);
  const saved=JSON.stringify(tree);data.fill(0);assert.strictEqual(JSON.stringify(tree),saved);assert.deepStrictEqual(codec.decode(codec.encode(tree)),tree);
});

test('Menu banks: checked pointers, object sizes, graph cycles and duplicate item identifiers reject transactionally',()=>{
  for(const mutate of [b=>b.fill(255,4,8),b=>{b[8]=0;b[9]=0;b[10]=0;b[11]=2;},b=>{b[70]=255;b[71]=254;},b=>{b[4]=0;b[5]=0;b[6]=0;b[7]=118;},b=>b.fill(0,12,14)]){const bytes=raw();mutate(bytes);assert.throws(()=>codec.decode(bytes),/Menu bank/);}
  const node=codec.decode(raw())[0];const before=JSON.stringify(node);assert.throws(()=>codec.encode([node,node]),/tree/);assert.strictEqual(JSON.stringify(node),before);
  assert.throws(()=>codec.decode(new Uint16Array(20)),/invalid bytes/);
});
