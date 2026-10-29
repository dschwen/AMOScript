/* jshint esversion: 6 */
'use strict';
// Owned, manual-Synchro AMAL subset. No eval, host scheduling or presentation.
function createAmal(options) {
  const word = value => (value << 16) >> 16;
  const channels = new Map();
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
    let at = 0;
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
      if (['X','Y'].includes(peek()) && ['S','H'].includes(chars[at+1])) {
        const name = chars[at++] + chars[at++]; expect('('); const screen = expression(depth+1); expect(','); const value = expression(depth+1); expect(')');
        return { kind:'coordinate', name, screen, value };
      }
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
    while (at < chars.length) {
      if (peek() === ';') { at++; continue; }
      const offset = offsets[at], command = chars[at++];
      if (peek() === ':') {
        at++; if (!/^[A-Z]$/.test(command) || labels.has(command)) error('Invalid or duplicate AMAL label');
        labels.set(command,ops.length); continue;
      }
      if (ops.length >= 4096) error('AMAL instruction limit exceeded');
      let op;
      if (command === 'L') { const target = register(); expect('='); op = { kind:'let', target, expr:expression() }; }
      else if (command === 'M') { const x = expression(); expect(','); const y = expression(); expect(','); op = { kind:'move', x, y, steps:expression() }; }
      else if (command === 'J') op = { kind:'jump', label:label() };
      else if (command === 'I') { const expr = expression(); expect('J'); op = { kind:'if', expr, label:label() }; }
      else if (command === 'P' && peek() !== 'L') op = { kind:'pause' };
      else if (command === 'E') op = { kind:'end' };
      else { at--; error('Unsupported AMAL instruction'); }
      ops.push({ ...op, offset });
    }
    ops.push({ kind:'end', offset:source.length });
    for (const op of ops) if (op.label != null) {
      if (!labels.has(op.label)) error(`Undefined AMAL label ${op.label}`);
      op.destination = labels.get(op.label);
    }
    const pending = ops.map(op=>[op,0]);
    while (pending.length) {
      const [value,depth] = pending.pop();
      if (depth > 64) error('AMAL expression tree exceeds depth 64');
      if (value && typeof value === 'object') for (const key of Object.keys(value)) if (typeof value[key] === 'object') pending.push([value[key],depth+1]);
    }
    const freeze = value => { if (value && typeof value === 'object') { for (const key of Object.keys(value)) freeze(value[key]); Object.freeze(value); } return value; };
    return freeze({ source, ops });
  }
  function evaluate(expr, channel) {
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
    channels.set(number,{ number, code, binding:Object.freeze({...binding}), target, location:location && {...location}, locals:new Int16Array(10), ip:0, enabled:false, ended:false, move:null });
  }
  function control(number, enabled) {
    for (const [id, channel] of channels) if (number == null || id === number) {
      if (enabled) channel.enabled = true;
      else channels.delete(id); // AMAL OFF removes, rather than freezes, a program.
    }
  }
  function retire() { for (const [id,c] of channels) if (!c.target.alive()) channels.delete(id); }
  function removeTarget(type, number = null) { for (const [id,c] of channels) if (c.binding.type === type && (number == null || c.binding.number === number)) channels.delete(id); }
  function stepChannel(c) {
    let jumps = 10;
    for (let count = 0; count < 50000; count++) {
      const op = c.code.ops[c.ip];
      if (op.kind === 'let') {
        const value = evaluate(op.expr,c), target = op.target;
        if (target.kind === 'local') c.locals[target.index] = value;
        else if (target.kind === 'global') options.globals[target.index] = value;
        else c.target.write(target.name,value);
        c.ip++;
      } else if (op.kind === 'pause') { c.ip++; return; }
      else if (op.kind === 'end') { c.ended = true; return; }
      else if (op.kind === 'jump' || op.kind === 'if') {
        if (op.kind === 'if' && !evaluate(op.expr,c)) { c.ip++; continue; }
        c.ip = op.destination; if (--jumps === 0) return;
      } else if (op.kind === 'move') {
        if (c.move) {
          if (--c.move.remaining === 0) { c.move = null; c.ip++; continue; }
        } else {
          const x = evaluate(op.x,c), y = evaluate(op.y,c), steps = Math.max(1,evaluate(op.steps,c));
          const delta = value => { const q = Math.trunc(Math.abs(value)*256/steps); return q > 65535 ? 0 : word(value < 0 ? -q : q)*256; };
          c.move = { remaining:steps, dx:delta(x), dy:delta(y), fx:32768, fy:32768 };
        }
        for (const [axis,delta,fraction] of [['X','dx','fx'],['Y','dy','fy']]) {
          const current = word(c.target.read(axis)), value = (((current & 65535)*65536+c.move[fraction])+c.move[delta])|0;
          c.move[fraction] = value & 65535;
          if ((value >> 16) !== current) c.target.write(axis,value >> 16);
        }
        return;
      }
    }
    throw new Error('AMAL execution budget exceeded');
  }
  function step() {
    retire();
    for (const c of [...channels.values()].sort((a,b)=>a.number-b.number)) if (c.enabled && !c.ended) {
      try { stepChannel(c); }
      catch (error) {
        error.message += ` in AMAL channel ${c.number}, character ${c.code.ops[c.ip].offset}`;
        if (c.location) error.message += ` at line ${c.location.line}, byte ${c.location.offset}`;
        throw error;
      }
    }
  }
  function snapshot() { return Object.freeze([...channels.values()].sort((a,b)=>a.number-b.number).map(c=>Object.freeze({number:c.number,binding:c.binding,source:c.code.source,enabled:c.enabled,ended:c.ended,ip:c.ip,remaining:c.move ? c.move.remaining : 0,locals:Object.freeze(Array.from(c.locals))}))); }
  return { compile, install, control, step, retire, removeTarget, clear:()=>channels.clear(), snapshot };
}
if (typeof module === 'object' && module.exports) module.exports = createAmal;
else globalThis.AMOS_AMAL = createAmal;
