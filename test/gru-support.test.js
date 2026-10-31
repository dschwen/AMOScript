'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {binary,token:t,integer:n,identifier:id,text,dword,word,compile,execute}=require('./helpers/program');
const fn=(name,...args)=>[t(name),...(args.length?[t('('),...args.flatMap((a,i)=>[...(i?[t(',')]:[]),a]),t(')')]:[])];
const assign=(name,value,flags=0)=>[id(name,6,flags),t('='),value];
const strings=value=>Buffer.from(value).toString('latin1');

test('Gru programs: all 39 original hashes are pinned; 33 compile without source changes and six retain explicit blockers',()=>{
  const root=path.join(__dirname,'../examples/GruPrograms'),manifest=require('../examples/GruPrograms/manifest.json');
  const failures={'Gru1/Intr/Anim.AMOS':/token 0x1ea6/,'Gru1/Intr/Anim.Bak':/token 0x1ea6/,'Gru1/Intr/Animplay.Bak':/Expected =; found -/,'Gru1/Intr/Scroll_C.AMOS':/Invalid AMOS line length/,'Gru2/SpriteXpro.AMOS':/token 0x1270/,'progs1/Amos progs/Grid.Bak':/Expected =; found EOL/};
  let count=0;for(const entry of manifest.sources){const bytes=fs.readFileSync(path.join(root,entry.path));assert.strictEqual(bytes.length,entry.byteLength);assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256);if(failures[entry.path])assert.throws(()=>compile(bytes),failures[entry.path]);else{compile(bytes);count++;}}
  assert.strictEqual(count,33);
});

test('Def Scroll: exclusive rectangles, signed-word definitions, overlap, clipping and untouched exposed pixels match independent copies',()=>{
  const {program:p}=execute(binary([[t('Wait Key')]]));const d=p.display;d.open(0,32,20,16,0);
  for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1],[-3,-2],[4,3],[100,0]]){
    const s=d.screen();for(let y=0;y<20;y++)for(let x=0;x<32;x++)s.pixels[y*32+x]=(x*7+y*3)%16;
    const before=s.pixels.slice(),expected=before.slice();
    for(let y=2;y<18;y++)for(let x=1;x<31;x++){const tx=x+dx,ty=y+dy;if(tx>=0&&tx<32&&ty>=0&&ty<20)expected[ty*32+tx]=before[y*32+x];}
    d.defineScroll(1,1,2,31,18,dx,dy);d.scroll(1);assert.deepStrictEqual(s.pixels,expected);
  }
  assert.throws(()=>d.scroll(2),/not defined/);assert.throws(()=>d.defineScroll(11,0,0,1,1,0,0),/number/);
  d.defineScroll(1,0,0,10,10,65535,0);d.scroll(1);d.resetDefault();p.stop();
});

test('Def Scroll: real statement lowering preserves definitions across screens and Autoback mirrors without changing cursor or bank addresses',()=>{
  const {program:p}=execute(binary([[t('Def Scroll'),n(1),t(','),n(0),t(','),n(0),t('To'),n(16),t(','),n(8),t(','),n(1),t(','),n(0)],[t('Wait Key')]]));
  p.display.open(1,32,16,4,0);p.display.ink(3);p.display.plot(2,2);p.display.doubleBuffer();p.display.autoback(2);p.reserveWork(10,8);const address=p.bankStart(10);p.display.locate(1,1);p.display.scroll(1);
  const s=p.display.screen();assert.strictEqual(s.pixels[2*32+3],3);assert.strictEqual(s.physicalPixels[2*32+3],3);assert.deepStrictEqual([s.x,s.y],[1,1]);assert.strictEqual(p.bankStart(10),address);p.stop();
});

test('Legacy forms: base Fsel$ reads one through four typed operands, Load/Save consume uncached bank operands, declared bare calls and top-level Shared work',()=>{
  const files=require('../lib/amos/files').createMemoryFiles({},['one','two','three','four']);
  const lines=[1,2,3,4].map(count=>[t('Print'),fn('Fsel$',...['*','default','title','subtitle'].slice(0,count).map(text))]);
  assert.deepStrictEqual(execute(binary(lines),100,{files}).logs,[['one'],['two'],['three'],['four']]);
  assert.throws(()=>compile(binary([[t('Print'),fn('Fsel$',text('*'),n(1))]])),/Wrong argument type/);
  assert.throws(()=>compile(binary([[t('Print'),fn('Fsel$2',text('*'),text('x'),text('bad'))]])),/Expected \)/);
  const result=execute(binary([[t('Shared'),id('x')],assign('x',n(1)),[id('incx')],
    [t('Procedure'),dword(0),word(0),0,0,id('incx')],[t('Inc'),id('x')],[t('End Proc')],[t('Print'),id('x')]]));assert.deepStrictEqual(result.logs,[[2]]);
  assert.throws(()=>compile(binary([[id('undeclared')]])),/Expected =/);
  const raw=require('../lib/BankWriter').byteString(require('../lib/BankWriter').write([{number:5,type:'data',name:'Data    ',memory:'fast',permanent:true,data:Uint8Array.of(1,2)}]));
  const memory=require('../lib/amos/files').createMemoryFiles({'input.abk':raw});const r=execute(binary([[t('Load'),text('input.abk'),t(','),n(10)],[t('Save'),text('output.abk'),t(','),n(10)]]),100,{files:memory});assert.strictEqual(r.program.banks.get(10).data[1],2);assert.ok(memory.read('output.abk').length>20);
});

test('Text Base: default and preloaded font baselines follow the selected screen without changing text pixels',()=>{
  const {program:p,logs}=execute(binary([[t('Print'),fn('Text Base')],[t('Wait Key')]]),100,{displayOptions:{diskFonts:[{name:'test',width:8,height:12,baseline:9,data:new Uint8Array(256*12)}]}});assert.deepStrictEqual(logs,[[7]]);
  p.display.getDiscFonts();p.display.setFont(1);assert.strictEqual(p.display.textBase(),9);p.display.open(1,320,200,16,0);assert.strictEqual(p.display.textBase(),7);p.display.select(0);assert.strictEqual(p.display.textBase(),9);p.stop();
});

test('Varptr/Areg: live integer and byte-string memory use checked big-endian access; changed strings retire their old addresses',()=>{
  const source=binary([assign('x',n(0x12345678)),assign('s',text('abc'),2),assign('px',fn('Varptr',id('x'))),assign('ps',fn('Varptr',id('s',6,2))),
    [t('Areg'),t('('),n(0),t(')'),t('='),id('px')],[t('Wait Key')],assign('s',text('other'),2),[t('Wait Key')]]);
  const {program:p,timers:c}=execute(source);const v=p.state.variables;assert.strictEqual(p.addressRegister(0),v.int_px);assert.strictEqual(p.leek(v.int_px),0x12345678);
  p.loke(v.int_px,-2);assert.strictEqual(v.int_x,-2);assert.strictEqual(p.peek(v.int_ps),97);p.poke(v.int_ps+1,255);assert.strictEqual(v.string_s,'a\xffc');assert.throws(()=>p.deek(v.int_ps+2),/bounds/);
  p.sendKey('continue');c.tick(0);assert.throws(()=>p.peek(v.int_ps),/retired/);assert.throws(()=>p.setAddressRegister(7,1),/Areg/);p.stop();
  assert.throws(()=>compile(binary([[t('Print'),fn('Varptr',n(1))]])),/requires an integer or string variable/);
});

test('Pload/Call: one CODE hunk becomes an owned Asm bank; native adapter consumes frozen registers and writes live variable bytes',()=>{
  const code=Buffer.from([0x4e,0x75,0x4e,0x71]),hunk=Buffer.from([0x3f3,0,1,0,0,1,0x3e9,1].flatMap(dword).concat([...code],dword(0x3f2)));
  const input=binary([[t('Pload'),text('code'),t(','),n(-10)],assign('x',n(5)),[t('Areg'),t('('),n(0),t(')'),t('='),fn('Varptr',id('x'))],[t('Call'),n(10)],[t('Print'),id('x')]]);
  let called=0;const native={call(request){called++;assert.ok(Object.isFrozen(request.dataRegisters));assert.strictEqual(request.kind,'Call');assert.deepStrictEqual(Array.from(request.read(request.value,4)),Array.from(code));request.write(request.addressRegisters[0],Uint8Array.of(0,0,0,42));return{dataRegisters:[7,0,0,0,0,0,0,0]};}};
  const r=execute(input,100,{files:{read:()=>strings(hunk)},native});assert.deepStrictEqual(r.logs,[[42]]);assert.strictEqual(called,1);assert.strictEqual(r.program.banks.get(10).memory,'chip');assert.strictEqual(r.program.banks.get(10).name,'Asm     ');
  assert.throws(()=>execute(input,100,{files:{read:()=>strings(hunk)}}),/68000 execution is not built in/);
  for(const bytes of [hunk.subarray(0,12),Buffer.from('bad!'),hunk.subarray(0,hunk.length-1)])assert.throws(()=>execute(input,100,{files:{read:()=>strings(bytes)}}),/Pload/);
});

test('Bgrab: ownership moves from a stopped parent; old addresses retire and missing accessory context is explicit',()=>{
  const parent=execute(binary([[t('Wait Key')]])).program;parent.reserveWork(10,4);parent.poke(parent.bankStart(10),123);const old=parent.bankStart(10);parent.stop();
  const child=execute(binary([[t('Bgrab'),n(10)],[t('Wait Key')]]),100,{parentProgram:parent}).program;
  assert.strictEqual(parent.banks.has(10),false);assert.strictEqual(child.peek(child.bankStart(10)),123);assert.throws(()=>parent.peek(old),/retired/);child.stop();
  assert.throws(()=>execute(binary([[t('Bgrab'),n(10)]])),/accessory context.*line 1/);
});

test('Run: filename resolves once, execution terminates and owned resources clear before one synchronous loader notification',()=>{
  let calls=0,program;const input=binary([[t('Dir$'),t('='),text('game:')],[t('Run File'),text('next.amos')],[t('Print'),text('must not run')]]);
  program=compile(input).create({setTimeout,clearTimeout,files:{isDirectory:()=>true},system:{command(name,request){calls++;assert.strictEqual(name,'Run');assert.strictEqual(request.filename,'game:next.amos');assert.ok(Object.isFrozen(request));assert.strictEqual(program.state.halted,true);assert.strictEqual(program.amalSnapshot().length,0);}}});program.tick(100);program.tick(100);assert.strictEqual(calls,1);assert.strictEqual(program.state.runRequest.filename,'game:next.amos');
  assert.throws(()=>execute(binary([[t('Run')]])),/program loader/);assert.throws(()=>execute(binary([[t('Run File'),text('bad')]]),100,{system:{command:()=>Promise.resolve()}}),/complete synchronously/);
});

test('Varptr: local array targets retain captured cells and retire on procedure return; byte copies accept signed variable pointers',()=>{
  const input=binary([[t('Global'),id('addr')],[id('p')],[t('Wait Key')],
    [t('Procedure'),dword(0),word(0),0,0,id('p')],[t('Dim'),id('a'),t('('),n(1),t(')')],
    assign('addr',fn('Varptr',[id('a'),t('('),n(0),t(')')])),[t('Wait Key')],[t('End Proc')]]);
  const {program:p,timers:c}=execute(input);const address=p.state.variables.int_addr;p.loke(address,42);assert.strictEqual(p.state.locals.array_int_a.values.get(0),42);
  p.reserveWork(10,4);p.copyMemory(address,address+4,p.bankStart(10));assert.strictEqual(p.leek(p.bankStart(10)),42);
  p.sendKey('return');c.tick(0);assert.throws(()=>p.peek(address),/retired/);p.stop();
});

test('Native bridge: Doscall dispatch is explicit, invalid/async register results cannot partially overwrite registers and Screen Base handles retire',()=>{
  const input=binary([[t('Print'),fn('Doscall',[t('-'),n(222)])],[t('Wait Key')]]);
  const r=execute(input,100,{native:{call(request){assert.strictEqual(request.kind,'Doscall');assert.strictEqual(request.value,-222);return{dataRegisters:[9,0,0,0,0,0,0,0]};}}});assert.deepStrictEqual(r.logs,[[9]]);r.program.stop();
  for(const result of [Promise.resolve({}),{dataRegisters:[9],addressRegisters:[1,2,3,4,5,6,7]},{dataRegisters:[9,0,0,0,0,0,0,0],addressRegisters:[1]}])assert.throws(()=>execute(input,100,{native:{call:()=>result}}),/synchronous|Invalid native register/);
  let handle;const p=execute(binary([[t('Wait Key')]]),100,{native:{call(request){if(handle==null){handle=request.addressRegisters[0];assert.strictEqual(request.screen(handle).width,320);}else assert.throws(()=>request.screen(handle),/Retired/);return{};}}}).program;
  p.setAddressRegister(0,p.screenAddress());p.doscall(-1);p.display.open(0,320,200,16,0);p.doscall(-1);p.stop();
});
