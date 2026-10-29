/* jshint esversion: 6 */
'use strict';
// Owned, manual-Synchro AMAL subset. No eval, host scheduling or presentation.
function createAmal(options) {
  const word = value => (value << 16) >> 16;
  const channels = new Map();
  if(options.readBeam!=null && typeof options.readBeam!=='function') throw new Error('readAmalBeam must be a synchronous function');
  if(options.readJoystick!=null && typeof options.readJoystick!=='function') throw new Error('AMAL joystick reader must be a synchronous function');
  // AMALInit is a cold-system initializer. ClrAMAL/Default do not reset it.
  let randomSeed=0x1234,stepping=false;
  function compile(source) {
    if (typeof source !== 'string' || source.length > 32766) throw new Error('Unsupported AMAL source (expected at most 32766 bytes)');
    const chars = [], offsets = [];
    for (let i = 0; i < source.length; i++) {
      const code = source.charCodeAt(i);
      if (code > 255) throw new Error('AMAL source requires byte characters');
      if (!code) break;
      if (code === 27) { i += 2; continue; }
      // AniChr ignores lowercase letters/spacing, retaining uppercase initials.
      if ((code >= 33 && code <= 90) || code === 124 || code === 33) { chars.push(source[i]); offsets.push(i); }
    }
    let at = 0, scope = 0, autoOpen = null;
    const forStack = [];
    const ops = [], labels = new Map();
    const peek = () => chars[at] || '';
    const error = message => { throw new Error(`${message} at AMAL character ${offsets[at] == null ? source.length : offsets[at]}`); };
    const expect = char => { if (peek() !== char) error(`Expected AMAL ${char}`); at++; };
    function register() {
      const kind = peek(); at++;
      if (['X','Y','A'].includes(kind)) return { kind:'object', name:kind };
      if (kind !== 'R') error('Expected AMAL register');
      const name = peek(); at++;
      if (/^[0-9]$/.test(name)) return { kind:'local', index:Number(name) };
      if (/^[A-Z]$/.test(name)) return { kind:'global', index:name.charCodeAt(0)-65 };
      error('Invalid AMAL register');
    }
    function operand(depth) {
      if (depth > 32) error('AMAL expression nesting exceeds 32');
      if (/^[0-9$-]$/.test(peek())) {
        let sign = 1, number = 0;
        if (peek() === '-') { sign = -1; at++; }
        const hex = peek() === '$'; if (hex) at++;
        const start = at, pattern = hex ? /^[0-9A-F]$/ : /^[0-9]$/;
        while (pattern.test(peek())) { number = (number * (hex ? 16 : 10) + parseInt(chars[at++], hex ? 16 : 10)) >>> 0; }
        if (at === start) error('Expected AMAL integer literal');
        return { kind:'literal', value:word(sign * number) };
      }
      if (peek() === 'B' && chars[at+1] === 'C') {
        at += 2; expect('('); const args = [expression(depth+1)];
        expect(','); args.push(expression(depth+1)); expect(','); args.push(expression(depth+1)); expect(')');
        return {kind:'bobCollision',args};
      }
      if (['X','Y'].includes(peek()) && ['S','H'].includes(chars[at+1])) {
        const name = chars[at++] + chars[at++]; expect('('); const screen = expression(depth+1); expect(','); const value = expression(depth+1); expect(')');
        return { kind:'coordinate', name, screen, value };
      }
      if (peek() === 'J') { at++; const port=peek(); if(!['0','1'].includes(port)) error('Expected AMAL joystick 0 or 1'); at++; return {kind:'joystick',port:Number(port)}; }
      if (peek() === 'Z') { at++; expect('('); const mask=expression(depth+1); expect(')'); return {kind:'random',mask}; }
      return register();
    }
    function expression(depth = 0) {
      let expr = operand(depth);
      // AniExp/AmELoop apply all word operators left to right, without precedence.
      while (['=','<','>','+','-','/','*','|','&','!'].includes(peek())) {
        let op = chars[at++]; if (op === '<' && peek() === '>') { op += chars[at++]; }
        expr = { kind:'binary', op, left:expr, right:operand(depth) };
      }
      return expr;
    }
    function label() { const value = peek(); if (!/^[A-Z]$/.test(value)) error('Expected AMAL label'); at++; return value; }
    function branch(command, offset) {
      if (command === 'J') return {kind:'jump',label:label(),scope,offset};
      if (scope !== 1) error('Direct/eXit require AMAL Autotest');
      if (command === 'D') return {kind:'direct',label:label(),scope,offset};
      if (command === 'X') return {kind:'exit',scope,offset};
      error('Expected AMAL Jump, Direct or eXit');
    }
    while (at < chars.length) {
      if (peek() === ';') { at++; continue; }
      const offset = offsets[at], command = chars[at++];
      if (peek() === ':') {
        at++; if (!/^[A-Z]$/.test(command) || labels.has(command)) error('Invalid or duplicate AMAL label');
        labels.set(command,{index:ops.length,scope}); continue;
      }
      if (ops.length >= 4096) error('AMAL instruction limit exceeded');
      let op;
      if (command === 'A' && peek() === 'U') {
        if (scope) error('Nested AMAL Autotest is not allowed');
        at++; expect('(');
        if (peek() === ')') { at++; op={kind:'autoOff'}; }
        else { autoOpen=ops.length; op={kind:'autoOn',scope:0}; ops.push({...op,offset}); scope=1; continue; }
      } else if (command === 'A') {
        const repeats=expression(),frames=[]; expect(',');
        do {
          if(frames.length===256) error('AMAL Anim frame limit exceeded');
          expect('('); const image=expression(); expect(','); const duration=expression(); expect(')');
          frames.push({image,duration});
        } while(peek()==='(');
        op={kind:'anim',repeats,frames};
      } else if (command === ')') {
        if (!scope) error('Unexpected AMAL Autotest close');
        ops.push({kind:'exit',scope,offset}); ops[autoOpen].destination=ops.length;
        scope=0; autoOpen=null; continue;
      } else if (command === 'L') { const target=register(); expect('='); op={kind:'let',target,expr:expression()}; }
      else if (command === 'M') {
        if(scope) error('Move is not allowed in AMAL Autotest');
        const x=expression(); expect(','); const y=expression(); expect(','); op={kind:'move',x,y,steps:expression()};
      } else if (['J','D','X'].includes(command)) op=branch(command,offset);
      else if (command === 'I') { const expr=expression(), action=chars[at++]; op={kind:'if',expr,action:branch(action,offset)}; }
      else if (command === 'F') {
        if(scope) error('For is not allowed in AMAL Autotest');
        const target=register(); if(target.kind==='object') error('AMAL For requires a local/global register');
        expect('='); const start=expression(); expect('T'); op={kind:'for',target,start,bound:expression()}; forStack.push(ops.length);
      } else if (command === 'N') {
        if(scope) error('Next is not allowed in AMAL Autotest');
        const target=register(), begin=forStack.pop(), owner=ops[begin];
        if(!owner || owner.target.kind!==target.kind || owner.target.index!==target.index) error('Mismatched AMAL For/Next');
        op={kind:'next',begin};
      } else if (command === 'P' && peek() !== 'L') {
        if(scope) error('Pause in AMAL Autotest is not supported');
        op={kind:'pause'};
      } else if (command === 'E') op={kind:'end'};
      else { at--; error('Unsupported AMAL instruction'); }
      ops.push({...op,scope,offset});
    }
    if(scope) error('Unclosed AMAL Autotest');
    if(forStack.length) error('Unmatched AMAL For');
    ops.push({kind:'end',scope:0,offset:source.length});
    function resolveBranch(op) {
      if(op.kind==='if') { resolveBranch(op.action); return; }
      if(op.label==null) return;
      const destination=labels.get(op.label);
      if(!destination) error(`Undefined AMAL label ${op.label}`);
      if(destination.scope !== (op.kind==='direct'?0:op.scope)) error('AMAL branch crosses Autotest boundary');
      op.destination=destination.index;
    }
    for(const op of ops) resolveBranch(op);
    const pending = ops.map(op=>[op,0]);
    while (pending.length) {
      const [value,depth] = pending.pop();
      if (depth > 64) error('AMAL expression tree exceeds depth 64');
      if (value && typeof value === 'object') for (const key of Object.keys(value)) if (typeof value[key] === 'object') pending.push([value[key],depth+1]);
    }
    const freeze = value => { if (value && typeof value === 'object') { for (const key of Object.keys(value)) freeze(value[key]); Object.freeze(value); } return value; };
    return freeze({ source, ops });
  }
  function active(channel) { return channels.get(channel.number)===channel && channel.target.alive() && (!options.isRunning || options.isRunning()); }
  function evaluate(expr, channel) {
    if(expr.kind==='joystick'){
      const value=options.readJoystick ? options.readJoystick(expr.port,()=>active(channel)) : 0;
      if(!Number.isInteger(value) || value<0 || value>31) throw new Error('Invalid AMAL joystick mask (expected synchronous 0..31)');
      if(!active(channel)) throw new Error('AMAL changed during joystick read');
      return value;
    }
    if (expr.kind === 'random') {
      const mask=evaluate(expr.mask,channel),product=randomSeed*0x3171;
      const beam=options.readBeam ? options.readBeam() : 0;
      if(!Number.isInteger(beam) || beam<0 || beam>65535) throw new Error('AMAL beam reader must return a 16-bit word synchronously');
      if(channels.get(channel.number)!==channel || !channel.target.alive() || (options.isRunning && !options.isRunning())) throw new Error('AMAL changed during random beam read');
      // Both additions are WORD operations: carry never reaches the product's
      // high word. Shift the full mixed long before applying the word mask.
      randomSeed=((product&65535)+beam+1)&65535;
      const mixed=((product&0xffff0000)|randomSeed)>>>0;
      return word((mixed>>>8)&mask);
    }
    if (expr.kind === 'bobCollision') return word(options.bobCollision(...expr.args.map(value=>evaluate(value,channel))));
    if (expr.kind === 'literal') return expr.value;
    if (expr.kind === 'local') return channel.locals[expr.index];
    if (expr.kind === 'global') return options.globals[expr.index];
    if (expr.kind === 'object') return word(channel.target.read(expr.name));
    if (expr.kind === 'coordinate') return word(options.coordinate(expr.name,evaluate(expr.screen,channel),evaluate(expr.value,channel)));
    const a = evaluate(expr.left,channel), b = evaluate(expr.right,channel);
    switch (expr.op) {
      case '+': return word(a+b); case '-': return word(a-b); case '*': return word(a*b);
      // Native DIVS by zero leaves the accumulator; overflow retains its low word.
      case '/': { if (!b) return a; const q = Math.trunc(a/b); return q < -32768 || q > 32767 ? a : word(q); }
      case '=': return a === b ? -1 : 0; case '<>': return a !== b ? -1 : 0;
      case '<': return a < b ? -1 : 0; case '>': return a > b ? -1 : 0;
      case '|': return word(a|b); case '&': return word(a&b); case '!': return word(a^b);
      default: throw new Error('Invalid AMAL expression');
    }
  }
  function install(number, source, binding, location) {
    const code = compile(source); // A syntax failure retains the old program.
    channels.delete(number); // Native replacement retires before target resolution.
    const target = options.resolve(binding);
    channels.set(number,{ number, code, binding:Object.freeze({...binding}), target, location:location && {...location}, locals:new Int16Array(10), ip:0, enabled:false, ended:false, move:null, animation:null, autoStart:null, bounds:new Map() });
  }
  function control(number, enabled) {
    for (const [id, channel] of channels) if (number == null || id === number) {
      if (enabled) channel.enabled = true;
      else channels.delete(id); // AMAL OFF removes, rather than freezes, a program.
    }
  }
  function retire() { for (const [id,c] of channels) if (!c.target.alive()) channels.delete(id); }
  function removeTarget(type, number = null) { for (const [id,c] of channels) if (c.binding.type === type && (number == null || c.binding.number === number)) channels.delete(id); }
  function readRegister(target,c) { return target.kind==='local' ? c.locals[target.index] : options.globals[target.index]; }
  function store(target,value,c) {
    if(target.kind==='local') c.locals[target.index]=value;
    else if(target.kind==='global') options.globals[target.index]=value;
    else c.target.write(target.name,value);
  }
  function stepChannel(c,autotest=false) {
    let jumps=autotest?20:10, ip=autotest?c.autoStart:c.ip;
    const save=()=>{if(!autotest)c.ip=ip;};
    for(let count=0;count<100000;count++) {
      c.executingIp=ip;
      const op=c.code.ops[ip];
      if(op.kind==='let') { store(op.target,evaluate(op.expr,c),c); ip++; }
      else if(op.kind==='anim') {
        const repeats=evaluate(op.repeats,c)&65535;
        c.animation={op,ip,loops:repeats,counter:1,index:0}; ip++;
      }
      else if(op.kind==='autoOn') { c.autoStart=ip+1; ip=op.destination; }
      else if(op.kind==='autoOff') { c.autoStart=null; ip++; }
      else if(op.kind==='pause') { ip++; save(); return; }
      else if(op.kind==='end') { c.ended=true; c.autoStart=null; save(); return; }
      else if(['jump','direct','exit','if'].includes(op.kind)) {
        if(op.kind==='if' && !evaluate(op.expr,c)) { ip++; continue; }
        const action=op.kind==='if'?op.action:op;
        if(action.kind==='exit') return;
        if(action.kind==='direct') { c.ip=action.destination; c.move=null; return; }
        ip=action.destination; if(--jumps===0) { save(); return; }
      } else if(op.kind==='for') {
        // Both expressions see the old register; the captured bound is owned
        // by this compiled For instruction, not by a runtime loop stack.
        const start=evaluate(op.start,c),bound=evaluate(op.bound,c);
        store(op.target,start,c); c.bounds.set(ip,bound); ip++;
      } else if(op.kind==='next') {
        const owner=c.code.ops[op.begin],value=word(readRegister(owner.target,c)+1);
        store(owner.target,value,c);
        if(value <= (c.bounds.get(op.begin)||0)) { c.ip=op.begin+1; return; }
        ip++;
      } else if(op.kind==='move') {
        if(c.move) {
          if(--c.move.remaining===0) { c.move=null; ip++; continue; }
        } else {
          const x=evaluate(op.x,c),y=evaluate(op.y,c),steps=Math.max(1,evaluate(op.steps,c));
          const delta=value=>{const q=Math.trunc(Math.abs(value)*256/steps);return q>65535?0:word(value<0?-q:q)*256;};
          c.move={remaining:steps,dx:delta(x),dy:delta(y),fx:32768,fy:32768};
        }
        for(const [axis,delta,fraction] of [['X','dx','fx'],['Y','dy','fy']]) {
          const current=word(c.target.read(axis)),value=(((current&65535)*65536+c.move[fraction])+c.move[delta])|0;
          c.move[fraction]=value&65535;
          if((value>>16)!==current)c.target.write(axis,value>>16);
        }
        save(); return;
      }
    }
    throw new Error('AMAL execution budget exceeded');
  }
  function stepAnimation(c) {
    const animation=c.animation;
    if(!animation) return;
    c.executingIp=animation.ip;
    animation.counter=(animation.counter-1)&65535;
    if(animation.counter) return;
    if(animation.index===animation.op.frames.length){
      if(animation.loops && --animation.loops===0){c.animation=null;return;}
      animation.index=0;
    }
    const frame=animation.op.frames[animation.index];
    // Native AmDoAni writes A before evaluating the duration expression.
    c.target.write('A',evaluate(frame.image,c)&65535);
    animation.counter=evaluate(frame.duration,c)&65535;
    animation.index++;
  }
  function step() {
    if(stepping)throw new Error('Reentrant AMAL Synchro is not supported');
    stepping=true;
    try {
      retire();
      for (const c of [...channels.values()].sort((a,b)=>a.number-b.number)) if (channels.get(c.number)===c && c.enabled && (!c.ended || c.animation)) {
        try { if(!c.ended && c.autoStart!=null)stepChannel(c,true); if(!c.ended)stepChannel(c); if(active(c))stepAnimation(c); }
        catch (error) {
          error.message += ` in AMAL channel ${c.number}, character ${c.code.ops[c.executingIp].offset}`;
          if (c.location && !error.message.includes(' at line ')) error.message += ` at line ${c.location.line}, byte ${c.location.offset}`;
          throw error;
        }
      }
    } finally { stepping=false; }
  }
  function snapshot() { return Object.freeze([...channels.values()].sort((a,b)=>a.number-b.number).map(c=>Object.freeze({number:c.number,binding:c.binding,source:c.code.source,enabled:c.enabled,ended:c.ended,ip:c.ip,autotest:c.autoStart!=null,remaining:c.move ? c.move.remaining : 0,animation:c.animation ? Object.freeze({index:c.animation.index,remaining:c.animation.counter,loops:c.animation.loops}) : null,locals:Object.freeze(Array.from(c.locals))}))); }
  return { compile, install, control, step, retire, removeTarget, randomState:()=>Object.freeze({seed:randomSeed}), clear:()=>channels.clear(), snapshot };
}
if (typeof module === 'object' && module.exports) module.exports = createAmal;
else globalThis.AMOS_AMAL = createAmal;
