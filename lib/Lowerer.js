/* jshint esversion: 6 */
'use strict';

const functions = require('./FunctionTable');
const display = require('./DisplayTable');

class Lowerer {
  constructor() {
    this.ops = [];
    this.labels = Object.create(null);
    this.variables = new Map();
    this.loops = [];
    this.blocks = [];
    this.procedures = new Map();
    this.globals = new Set();
    this.scope = null;
    this.counter = 0;
    this.variableBufferBytes = null;
    this.stackEntries = null;
    this.dataScopes = new Map([['@main', { entries: [], labels: Object.create(null) }]]);
  }

  error(message, location) {
    throw new Error(`${message} at line ${location.line}, byte ${location.offset}`);
  }

  symbolName(token) {
    const prefix = token.flags & 2 ? 'string_' : token.flags & 1 ? 'float_' : 'int_';
    return (token.array || token.flags & 0x40 ? 'array_' : '') + prefix + token.value.replace(/[^a-z0-9]/g, c => `_${c.charCodeAt(0).toString(16)}_`);
  }

  symbol(token) {
    const name = this.symbolName(token);
    const value = token.array || token.flags & 0x40 ? 'null' : token.flags & 2 ? '""' : '0';
    if (this.scope && (this.scope.parameters.includes(name) || !(this.globals.has(name) || this.scope.shared.has(name)))) {
      this.scope.locals.set(name, value);
      return `state.locals.${name}`;
    }
    this.variables.set(name, value);
    return name;
  }

  expression(node) {
    const type = this.type(node);
    switch (node.kind) {
      case 'number': case 'string': return JSON.stringify(node.value);
      case 'variable': {
        const storage = this.symbol(node);
        return node.array ? `program.arrayGet(${storage}, [${this.indices(node).join(', ')}])` : storage;
      }
      // Open_MathLibraries initializes ValPi to FFP word 0xc90fd942.
      case 'constant': return node.name === 'Pi#' ? '3.141592264175415' : node.name === 'Hires' ? '32768' : node.name === 'True' ? '-1' : '0';
      case 'bit_not': return `(~program.integer(${this.expression(node.value)}))`;
      case 'param': return `state.param.${this.type(node)}`;
      case 'unary': {
        if (type === 'dynamic') return `program.numericUnary(${JSON.stringify(node.operator)}, ${this.expression(node.value)})`;
        const result = `(${node.operator}(${this.expression(node.value)}))`;
        return type === 'integer' ? `(${result} | 0)` : result;
      }
      case 'binary': {
        let a = this.expression(node.left);
        let b = this.expression(node.right);
        if (this.type(node.left) === 'dynamic' || this.type(node.right) === 'dynamic') return `program.numericBinary(${JSON.stringify(node.operator)}, ${a}, ${b}, ${JSON.stringify(this.type(node.left))}, ${JSON.stringify(this.type(node.right))})`;
        if (node.operator === 'Mod' || (type === 'integer' && ['+', '-', '*', '/'].includes(node.operator))) return `program.integerOperation(${JSON.stringify(node.operator)}, ${a}, ${b})`;
        if (['And', 'Or', 'Xor'].includes(node.operator)) {
          const operator = { And: '&', Or: '|', Xor: '^' }[node.operator];
          return `(program.integer(${a}) ${operator} program.integer(${b}))`;
        }
        if (!['And', 'Or', 'Xor'].includes(node.operator) && (node.operator === '^' || this.type(node.left) === 'float' || this.type(node.right) === 'float')) {
          a = this.floating(node.left, a);
          b = this.floating(node.right, b);
        }
        if (type === 'float' && ['+', '-'].includes(node.operator)) return `program.floatAdd(${a}, ${b}, ${node.operator === '-'})`;
        if (type === 'float' && node.operator === '*') return `program.floatMultiply(${a}, ${b})`;
        if (type === 'float' && node.operator === '/') return `program.floatDivide(${a}, ${b})`;
        if (node.operator === '^') return `program.floatPower(${a}, ${b})`;
        if (node.operator === '/') return `program.divide(${a}, ${b})`;
        if (node.operator === '-' && type === 'string') return `program.subtractStrings(${a}, ${b})`;
        if (node.operator === '+' && type === 'string') return `program.addStrings(${a}, ${b})`;
        const operator = { '=': '===', '<>': '!==', '#<=': '<=', '#>=': '>=', And: '&', Or: '|', Xor: '^' }[node.operator] || node.operator;
        const expression = `((${a}) ${operator} (${b}))`;
        if (['=', '<>', '<', '>', '<=', '>=', '#<=', '#>='].includes(node.operator)) return `(${expression} ? -1 : 0)`;
        return expression;
      }
      case 'function': {
        const fn = { Sin: 'sin', Min: 'min', Max: 'max', Log: 'log10', Ln: 'log', Exp: 'exp' }[node.name];
        const args = node.args.map(arg => this.expression(arg));
        if (node.name === 'Timer') return 'program.timer()';
        if (node.name === 'Dir$') return 'program.currentDirectory()';
        if (node.name === 'Exist') return `program.fileExists(${args[0]})`;
        if (['Fsel$', 'Fsel$2', 'Fsel$3', 'Fsel$4'].includes(node.name)) return `program.fileSelector(${args.join(', ')})`;
        if (display.queries[node.name]) {
          const query = display.queries[node.name];
          const values = node.args.map(arg => this.numeric(arg));
          if (query.prefix) values.unshift(JSON.stringify(query.prefix));
          return `program.${query.target === 'program' ? '' : 'display.'}${query.method}(${values.join(', ')})`;
        }
        if (node.name === 'Val') return `program.val(${args[0]})`;
        if (['Abs', 'Sgn', 'Int'].includes(node.name)) return `program.numberFunction(${JSON.stringify(node.name)}, ${args[0]}, ${JSON.stringify(this.type(node.args[0]))})`;
        if (node.name === 'Min' || node.name === 'Max') return `program.${fn}(${args.join(', ')}, ${JSON.stringify(this.type(node.args[0]))}, ${JSON.stringify(this.type(node.args[1]))})`;
        if (['Eof', 'Lof', 'Pof'].includes(node.name)) return `program.fileInfo(${JSON.stringify(node.name)}, program.integer(${args[0]}))`;
        if (node.name === 'Ln' || node.name === 'Exp') return `program.${node.name === 'Ln' ? 'naturalLog' : 'floatExp'}(${this.floating(node.args[0], args[0])})`;
        if (['Sin', 'Cos', 'Tan'].includes(node.name)) return `program.floatTrig(${this.floating(node.args[0], args[0])}, ${JSON.stringify(node.name)})`;
        if (!fn) return `program.stringFunction(${JSON.stringify(node.name)}, [${args.join(', ')}])`;
        return `Math.${fn}(${node.args.map((arg, i) => this.floating(arg, args[i])).join(', ')})`;
      }
      default: return this.error(`Unsupported expression ${node.kind}`, node.location);
    }
  }

  type(node) {
    switch (node.kind) {
      case 'string': return 'string';
      case 'number': return node.code === 0x46 ? 'float' : 'integer';
      case 'variable': return node.flags & 2 ? 'string' : node.flags & 1 ? 'float' : 'integer';
      case 'constant': return node.name === 'Pi#' ? 'float' : 'integer';
      case 'param': return node.name === 'Param$' ? 'string' : node.name === 'Param#' ? 'float' : 'integer';
      case 'bit_not':
        if (this.type(node.value) === 'string') this.error('Not requires a numeric expression', node.location);
        return 'integer';
      case 'unary':
        if (this.type(node.value) === 'string') this.error('Numeric unary operator applied to string', node.location);
        return this.type(node.value);
      case 'function': {
        const args = node.args.map(arg => this.type(arg));
        functions[node.name].forEach((expected, i) => {
          if ((expected === 'string' && args[i] !== 'string') || (expected === 'number' && args[i] === 'string')) this.error(`Wrong argument type for ${node.name}`, node.location);
        });
        if (node.name === 'Min' || node.name === 'Max') {
          if ((args[0] === 'string') !== (args[1] === 'string')) this.error('Cannot compare strings with numbers', node.location);
          return args.includes('dynamic') ? 'dynamic' : args.includes('float') ? 'float' : args[0];
        }
        if (node.name.includes('$')) return 'string';
        if (display.queries[node.name]) return 'integer';
        if (node.name === 'Val') return 'dynamic';
        if (node.name === 'Abs' || node.name === 'Int') return args[0];
        if (node.name === 'Sgn') return 'integer';
        if (['Timer', 'Exist', 'Len', 'Asc', 'Instr', 'Instr3', 'Eof', 'Lof', 'Pof'].includes(node.name)) return 'integer';
        return 'float';
      }
      case 'binary': {
        const left = this.type(node.left);
        const right = this.type(node.right);
        const comparison = ['=', '<>', '<', '>', '<=', '>=', '#<=', '#>='].includes(node.operator);
        if ((left === 'string') !== (right === 'string')) this.error('Cannot mix strings and numbers', node.location);
        if (comparison) return 'integer';
        if (left === 'string') {
          if (!['+', '-'].includes(node.operator)) this.error('Invalid string operator', node.location);
          return 'string';
        }
        if (['And', 'Or', 'Xor', 'Mod'].includes(node.operator)) return 'integer';
        if (left === 'dynamic' || right === 'dynamic') return 'dynamic';
        return node.operator === '^' || left === 'float' || right === 'float' ? 'float' : 'integer';
      }
      default: return this.error(`Unknown expression type ${node.kind}`, node.location);
    }
  }

  convert(value, target) {
    const sourceType = this.type(value);
    const targetType = this.type({ ...target, kind: 'variable' });
    if ((sourceType === 'string') !== (targetType === 'string')) this.error('Assignment type mismatch', value.location);
    const expression = this.expression(value);
    return targetType === 'integer' ? `program.integer(${expression})` : targetType === 'float' ? this.floating(value, expression) : expression;
  }

  floating(node, expression = this.expression(node)) {
    const type = this.type(node);
    return type === 'float' ? expression : `program.float(${expression}, ${JSON.stringify(type)})`;
  }

  indices(node) {
    return node.indices.map(index => {
      if (this.type(index) === 'string') this.error('Array index must be numeric', index.location);
      return `program.integer(${this.expression(index)})`;
    });
  }

  numeric(node) {
    if (this.type(node) === 'string') this.error('Expected numeric expression', node.location);
    return `program.integer(${this.expression(node)})`;
  }

  condition(node) {
    if (this.type(node) === 'string') this.error('Condition must be numeric', node.location);
    return `program.value(${this.expression(node)})`;
  }

  assignment(target, expr, node) {
    const storage = this.symbol(target);
    this.emit('assign', node, { target: storage, indices: target.array ? this.indices(target) : null, expr });
  }

  dataScope() { return this.dataScopes.get(this.scope ? this.scope.name : '@main'); }

  emit(kind, node, fields = {}) { this.ops.push({ kind, ...fields, location: node.location }); }

  label(name, node) {
    if (Object.prototype.hasOwnProperty.call(this.labels, name)) this.error(`Duplicate label ${name}`, node.location);
    this.labels[name] = this.ops.length;
  }

  labelName(name) { return this.scope ? `@${this.scope.name}:${name}` : name; }

  close(kind, node) {
    const frame = this.blocks.pop();
    if (!frame || frame.kind !== kind) this.error(`Mismatched ${node.kind}; expected closing ${frame ? frame.kind : 'block'}`, node.location);
    return frame;
  }

  statement(node) {
    switch (node.kind) {
      case 'Set Mouse':
        this.emit('display', node, { method: 'setMouseAxis', target: 'program', args: [JSON.stringify(node.axis), this.numeric(node.value)] });
        break;
      case 'Fade':
        if (node.colours) {
          const colours = node.colours.map(colour => {
            const type = this.type(colour);
            if (!['integer', 'dynamic'].includes(type)) this.error('Explicit Fade colours require integer values', colour.location);
            return `{ value: ${this.expression(colour)}, type: ${JSON.stringify(type)} }`;
          });
          this.emit('display', node, { method: 'fadeColours', target: 'program', args: [this.numeric(node.speed), `[${colours.join(', ')}]`] });
        } else this.emit('display', node, { method: 'fade', target: 'program', args: [this.numeric(node.speed), ...(node.source ? [this.numeric(node.source)] : [])] });
        break;
      case 'Pop Proc':
        if (!this.scope) this.error('Pop Proc requires a procedure', node.location);
        this.emit('proc_return', node, { discard: true, expr: node.result ? this.expression(node.result) : null, type: node.result ? this.type(node.result) : null });
        break;
      case 'display': {
        const command = display.statements[node.command];
        const args = node.args.map((argument, index) => {
          if (argument == null) return 'null';
          const type = command.variadic || command.args[index];
          if (type === 'string') {
            if (this.type(argument) !== 'string') this.error(`${node.command} requires a string`, argument.location);
            return this.expression(argument);
          }
          return this.numeric(argument);
        });
        this.emit('display', node, { method: command.method, target: command.target, args });
        break;
      }
      case 'comment': break;
      case 'Set Buffer':
        if (node !== this.bufferDirective || this.scope || this.ops.length || this.variableBufferBytes != null) this.error('Set Buffer is supported only once before executable statements', node.location);
        this.variableBufferBytes = (node.value.value & 65535) * 1024;
        break;
      case 'Set Stack':
        if (!this.startupDirectives.has(node) || this.scope || this.ops.length || this.stackEntries != null) this.error('Set Stack is supported only once before executable statements', node.location);
        this.stackEntries = (Math.max(10, node.value.value & 65535) + 1) & 65535;
        break;
      case 'Dir$':
        if (this.type(node.value) !== 'string') this.error('Dir$ assignment requires a string', node.location);
        this.emit('display', node, { method: 'setDirectory', target: 'program', args: [this.expression(node.value)] });
        break;
      case 'Timer':
        this.emit('display', node, { method: 'setTimer', target: 'program', args: [this.numeric(node.value)] });
        break;
      case 'Rain':
        this.emit('display', node, { method: 'setRain', args: [this.numeric(node.number), this.numeric(node.line), this.numeric(node.value)] });
        break;
      case 'label':
        this.label(this.labelName(node.name), node);
        if (node.body && node.body.kind === 'Data') this.dataScope().labels[node.name] = this.dataScope().entries.length;
        if (node.body) this.statement(node.body);
        break;
      case 'assign':
        this.assignment(node.target, this.convert(node.value, node.target), node);
        break;
      case 'substring_assign':
        if (this.type(node.target) !== 'string') this.error('Substring assignment requires a string variable', node.target.location);
        if (this.type(node.value) !== 'string') this.error('Substring assignment requires a string value', node.value.location);
        this.emit('substring_assign', node, { name: node.name, target: this.symbol(node.target),
          indices: node.target.array ? this.indices(node.target) : null,
          args: node.args.map(arg => this.numeric(arg)), expr: this.expression(node.value) });
        break;
      case 'Dim':
        for (const array of node.arrays) this.emit('dim', node, { target: this.symbol(array), dimensions: this.indices(array), type: this.type(array) });
        break;
      case 'Data':
        for (const value of node.values) this.dataScope().entries.push({ expr: value ? this.expression(value) : null, type: value ? this.type(value) : 'empty', location: value ? value.location : node.location });
        break;
      case 'Read':
        for (const target of node.targets) this.assignment(target, `program.readData(${JSON.stringify(this.type(target))})`, node);
        break;
      case 'Restore':
        this.emit('restore', node, { scope: this.scope ? this.scope.name : '@main', restoreLabel: node.label });
        break;
      case 'Print': case 'Print#':
        this.emit('print', node, { expr: node.values.map((value, index) => {
          const format = node.formats && node.formats[index];
          if (!format) return this.expression(value);
          if (this.type(format) !== 'string') this.error('Print Using requires a string format', format.location);
          if (this.type(value) === 'float') this.error('Floating-point Print Using is not implemented', value.location);
          return `program.formatUsing(${this.expression(format)}, () => (${this.expression(value)}), ${JSON.stringify(this.type(value))})`;
        }).join(', '), separators: node.separators, channel: node.channel ? this.numeric(node.channel) : null });
        break;
      case 'Open In': case 'Open Out': case 'Append':
        if (this.type(node.filename) !== 'string') this.error('Filename must be a string', node.filename.location);
        this.emit('file_open', node, { mode: node.kind, channel: this.numeric(node.channel), filename: this.expression(node.filename) });
        break;
      case 'Close': case 'Close All':
        this.emit('file_close', node, { channel: node.channel ? this.numeric(node.channel) : null });
        break;
      case 'Input#': case 'Line Input#': {
        const channel = this.symbol({ value: `@channel${this.counter++}`, flags: 0 });
        this.emit('assign', node, { target: channel, expr: this.numeric(node.channel) });
        for (const target of node.targets) this.assignment(target, `program.fileRead(${channel}, ${JSON.stringify(this.type(target))}, ${node.kind === 'Line Input#'})`, node);
        break;
      }
      case 'Goto': case 'Gosub': this.emit(node.kind.toLowerCase(), node, { label: this.labelName(node.label) }); break;
      case 'On':
        this.emit('on_branch', node, { expr: this.numeric(node.selector), branch: node.branch,
          labels: node.labels.map(name => this.labelName(name)) });
        break;
      case 'End': this.emit('end', node); break;
      case 'Return': this.emit('return', node); break;
      case 'Wait': this.emit('sleep', node, { expr: this.numeric(node.value) }); break;
      case 'Wait Vbl': this.emit('sleep', node, { expr: '1' }); break;
      case 'Wait Key': this.emit('wait_key', node); break;
      case 'Inc': case 'Dec': {
        if (node.variable.flags & 3) this.error(`${node.kind} requires an integer variable`, node.location);
        if (node.variable.array) {
          this.emit('array_inc', node, { target: this.symbol(node.variable), indices: this.indices(node.variable), delta: node.kind === 'Inc' ? 1 : -1 });
          break;
        }
        const target = this.symbol(node.variable);
        this.emit('assign', node, { target, expr: `((${target} ${node.kind === 'Inc' ? '+' : '-'} 1) | 0)` });
        break;
      }
      case 'ifInline': {
        const otherwise = `@else_${this.counter++}`;
        const end = `@endif_${this.counter++}`;
        const depth = this.blocks.length;
        this.emit('branch_false', node, { cond: this.condition(node.condition), label: otherwise });
        node.yes.forEach(child => this.statement(child));
        if (this.blocks.length !== depth) this.error('Unclosed block in Then branch', node.location);
        this.emit('goto', node, { label: end });
        this.label(otherwise, node);
        node.no.forEach(child => this.statement(child));
        if (this.blocks.length !== depth) this.error('Unclosed block in Else branch', node.location);
        this.label(end, node);
        break;
      }
      case 'If': {
        const otherwise = `@else_${this.counter++}`;
        const end = `@endif_${this.counter++}`;
        this.emit('branch_false', node, { cond: this.condition(node.condition), label: otherwise });
        this.blocks.push({ kind: 'If', otherwise, end, location: node.location, hasElse: false });
        break;
      }
      case 'Else': case 'Else If': {
        const frame = this.close('If', node);
        if (frame.hasElse) this.error('Duplicate Else', node.location);
        this.emit('goto', node, { label: frame.end });
        this.label(frame.otherwise, node);
        if (node.kind === 'Else If') {
          frame.otherwise = `@else_${this.counter++}`;
          this.emit('branch_false', node, { cond: this.condition(node.condition), label: frame.otherwise });
        } else frame.hasElse = true;
        this.blocks.push(frame);
        break;
      }
      case 'Endif': {
        const frame = this.close('If', node);
        if (!frame.hasElse) this.label(frame.otherwise, node);
        this.label(frame.end, node);
        break;
      }
      case 'Do': case 'While': case 'Repeat': {
        const check = `@loop_${this.counter++}`;
        const end = `@loop_end_${this.counter++}`;
        this.label(check, node);
        if (node.kind === 'While') this.emit('branch_false', node, { cond: this.condition(node.condition), label: end });
        const frame = { kind: node.kind, check, end, location: node.location };
        this.blocks.push(frame);
        this.loops.push(frame);
        break;
      }
      case 'Loop': case 'Wend': case 'Until': {
        const frame = this.close({ Loop: 'Do', Wend: 'While', Until: 'Repeat' }[node.kind], node);
        this.loops.pop();
        if (node.kind === 'Until') this.emit('branch_false', node, { cond: this.condition(node.condition), label: frame.check });
        else this.emit('goto', node, { label: frame.check });
        this.label(frame.end, node);
        break;
      }
      case 'Exit': case 'Exit If':
        if (!this.loops.length) this.error('Exit outside loop', node.location);
        this.emit('exit', node, { expr: this.numeric(node.level), condition: node.condition ? this.condition(node.condition) : null, labels: this.loops.slice().reverse().map(frame => frame.end) });
        break;
      case 'Global': case 'Shared': break; // Collected before lowering any scope.
      case 'Procedure': {
        if (this.scope) this.error('Nested procedures are unsupported', node.location);
        const info = this.procedures.get(node.name);
        const end = `@proc_end_${node.name}`;
        if (this.blocks.length) this.error('Procedure inside a block', node.location);
        this.emit('goto', node, { label: end });
        this.label(`@proc_${node.name}`, node);
        this.scope = info;
        node.parameters.forEach(parameter => this.symbol(parameter));
        node.body.forEach(child => this.statement(child));
        if (this.blocks.length) this.error('Unclosed block in procedure', node.location);
        this.emit('proc_return', { location: node.endLocation }, { expr: node.result ? this.expression(node.result) : null, type: node.result ? this.type(node.result) : null });
        this.scope = null;
        this.label(end, node);
        break;
      }
      case 'procedureCall': {
        const procedure = this.procedures.get(node.name);
        if (!procedure) this.error(`Unknown procedure ${node.name}`, node.location);
        if (procedure.parameters.length !== node.args.length) this.error(`Wrong argument count for ${node.name}`, node.location);
        this.emit('proc_call', node, { label: `@proc_${node.name}`, procedure: node.name, args: node.args.map((arg, i) => this.convert(arg, procedure.parameterTokens[i])) });
        break;
      }
      case 'For': {
        const variable = this.symbol(node.variable);
        const id = this.counter++;
        const check = `@for_check_${id}`;
        const end = `@for_end_${id}`;
        if (node.variable.flags & 2) this.error('For requires a numeric variable', node.location);
        if (node.variable.flags & 0x40) this.error('For array index variables are unsupported', node.location);
        const step = this.symbol({ value: `@step${id}`, flags: node.variable.flags });
        const limit = this.symbol({ value: `@limit${id}`, flags: node.variable.flags });
        this.emit('assign', node, { target: variable, expr: this.convert(node.start, node.variable) });
        this.emit('assign', node, { target: limit, expr: this.convert(node.end, node.variable) });
        this.emit('assign', node, { target: step, expr: this.convert(node.step, node.variable) });
        this.label(check, node);
        const frame = { kind: 'For', variable, integer: !(node.variable.flags & 1), step, limit, check, end, location: node.location };
        this.loops.push(frame);
        this.blocks.push(frame);
        break;
      }
      case 'Next': {
        if (!this.loops.length) this.error('Next without For', node.location);
        const frame = this.close('For', node);
        this.loops.pop();
        if (node.variable && this.symbol(node.variable) !== frame.variable) this.error('Next variable does not match For', node.location);
        const increment = `${frame.variable} + (${frame.step})`;
        this.emit('assign', node, { target: frame.variable, expr: frame.integer ? `((${increment}) | 0)` : `program.floatAdd(${frame.variable}, ${frame.step})` });
        this.emit('branch_false', node, { cond: `((${frame.step}) >= 0 ? ${frame.variable} <= (${frame.limit}) : ${frame.variable} >= (${frame.limit}))`, label: frame.end });
        this.emit('goto', node, { label: frame.check });
        this.label(frame.end, node);
        break;
      }
      default: this.error(`Unsupported statement ${node.kind}`, node.location);
    }
  }

  lower(ast) {
    this.bufferDirective = ast.statements.find(node => node.kind !== 'comment');
    this.startupDirectives = new Set();
    for (const node of ast.statements) {
      if (!['comment', 'Set Buffer', 'Set Stack'].includes(node.kind)) break;
      this.startupDirectives.add(node);
    }
    const collect = (nodes, scope = null) => {
      for (const node of nodes) {
        if (node.kind === 'Global') node.variables.forEach(variable => this.globals.add(this.symbolName(variable)));
        if (node.kind === 'Shared') {
          if (!scope) this.error('Shared requires a procedure', node.location);
          node.variables.forEach(variable => scope.shared.add(this.symbolName(variable)));
        }
        if (node.kind === 'Procedure') {
          if (this.procedures.has(node.name)) this.error(`Duplicate procedure ${node.name}`, node.location);
          const parameters = node.parameters.map(parameter => this.symbolName(parameter));
          if (new Set(parameters).size !== parameters.length) this.error('Duplicate procedure parameter', node.location);
          const info = { name: node.name, parameters, parameterTokens: node.parameters, locals: new Map(), shared: new Set() };
          this.procedures.set(node.name, info);
          this.dataScopes.set(node.name, { entries: [], labels: Object.create(null) });
          collect(node.body, info);
        }
        if (node.kind === 'label' && node.body) collect([node.body], scope);
        if (node.kind === 'ifInline') { collect(node.yes, scope); collect(node.no, scope); }
      }
    };
    collect(ast.statements);
    ast.statements.forEach(node => this.statement(node));
    if (this.blocks.length) this.error(`Unclosed ${this.blocks[0].kind} block`, this.blocks[0].location);
    for (const op of this.ops) {
      if (op.label && !Object.prototype.hasOwnProperty.call(this.labels, op.label)) this.error(`Unresolved label ${op.label}`, op.location);
      if (op.kind === 'on_branch') for (const name of op.labels) {
        if (!Object.prototype.hasOwnProperty.call(this.labels, name)) this.error(`Unresolved label ${name}`, op.location);
      }
      if (op.kind === 'restore') {
        const labels = this.dataScopes.get(op.scope).labels;
        if (op.restoreLabel != null && !Object.prototype.hasOwnProperty.call(labels, op.restoreLabel)) this.error(`Restore label ${op.restoreLabel} does not identify Data`, op.location);
        op.index = op.restoreLabel == null ? 0 : labels[op.restoreLabel];
      }
    }
    return this;
  }
}

module.exports = Lowerer;
