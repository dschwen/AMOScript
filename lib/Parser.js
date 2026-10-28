/* jshint esversion: 6 */
'use strict';

const TokenReader = require('./TokenReader');
const { token_by_name } = require('./TokenTable');
// The original evaluator compares operator token codes (ILib.s, OP_Ret).
// Equal codes reduce immediately: power chains are left associative.
const precedence = Object.fromEntries([
  'Or', 'Xor', 'And', '=', '<>', '<', '>', '<=', '>=', '#<=', '#>=', '+', '-', 'Mod', '*', '/', '^'
].map(name => [name, token_by_name[name]]));
const functions = require('./FunctionTable');
const display = require('./DisplayTable');

class Parser {
  constructor(buffer) {
    this.tokens = new TokenReader(buffer).read();
    this.index = 0;
  }

  peek() { return this.tokens[this.index]; }
  at(name) { return this.peek().name === name; }
  take() { return this.tokens[this.index++]; }
  match(name) { if (this.at(name)) return this.take(); return null; }
  error(message, token = this.peek()) {
    throw new Error(`${message}; found ${token.name} at line ${token.location.line}, byte ${token.location.offset}`);
  }
  expect(name) { return this.match(name) || this.error(`Expected ${name}`); }

  parse() {
    const statements = [];
    while (!this.at('EOF')) {
      if (this.match('EOL') || this.match(':')) continue;
      statements.push(this.statement());
      if (!['EOL', ':', 'EOF'].includes(this.peek().name)) this.error('Expected end of statement');
    }
    return { kind: 'program', statements };
  }

  statement() {
    const token = this.take();
    const node = { kind: token.name, location: token.location };
    if (token.name === 'X Mouse' || token.name === 'Y Mouse') {
      this.expect('='); node.kind = 'Set Mouse'; node.axis = token.name[0].toLowerCase();
      node.value = this.expression(); return node;
    }
    if (token.name === 'Fade') {
      node.speed = this.expression(); node.source = this.match('To') ? this.expression() : null;
      if (!node.source && this.match(',')) {
        const colour = () => this.at(',') || this.isEnd() ? null : this.expression();
        node.colours = [colour()];
        while (this.match(',')) node.colours.push(colour());
        if (node.colours.length > 32) this.error('Fade supports at most 32 explicit colour expressions', token);
      }
      return node;
    }
    if (display.statements[token.name]) {
      const command = display.statements[token.name];
      node.kind = 'display';
      node.command = token.name;
      node.args = [];
      if (command.pointList) {
        if (this.at('To')) this.error('Polygon To is not implemented', token);
        node.points = [];
        do {
          const x = this.expression(); this.expect(',');
          node.points.push([x, this.expression()]);
          if (node.points.length > command.maxPoints) this.error('Polygon supports at most 16 coordinate pairs', token);
        } while (this.match('To'));
        if (node.points.length < 3) this.error('Polygon requires at least three coordinate pairs', token);
        return node;
      }
      if (command.unverifiedOverloads && token.extension && token.extension.reference === 0) {
        node.args.push(this.expression());
        while (this.match(',')) {
          if (node.args.length >= command.unverifiedOverloads.length) this.error('Unsupported Sam Play argument count', token);
          node.args.push(this.expression());
        }
        node.command = command.unverifiedOverloads[node.args.length - 1];
        node.extension = { ...token.extension };
        return node;
      }
      const read = type => type.endsWith('?') && (this.isEnd() || this.at(',') || this.at('To')) ? null : this.expression();
      if (command.variadic) {
        node.args.push(read(command.variadic));
        while (this.match(',')) node.args.push(read(command.variadic));
      } else command.args.forEach((type, index) => {
        if (index) this.expect(command.to === index ? 'To' : ',');
        node.args.push(read(type));
      });
      return node;
    }
    switch (token.name) {
      case 'comment': return node;
      case 'Pop Proc': {
        const results = this.bracketList(() => this.expression());
        if (results.length > 1) this.error('Pop Proc accepts one result', token);
        node.result = results[0] || null; return node;
      }
      case 'Set Buffer': case 'Set Stack':
        node.value = this.expect('number');
        if (node.value.code !== 0x3e) this.error(`${token.name} requires a decimal integer literal`, node.value);
        return node;
      case 'Dir$':
        this.expect('='); node.value = this.expression(); return node;
      case 'Timer':
        this.expect('=');
        node.value = this.expression();
        return node;
      case 'Rain':
        this.expect('('); node.number = this.expression(); this.expect(','); node.line = this.expression();
        this.expect(')'); this.expect('='); node.value = this.expression(); return node;
      case 'label':
        node.name = token.value;
        // AMOS labels already include the source colon in their token.
        if (![':', 'EOL'].includes(this.peek().name)) {
          node.body = this.statement();
        }
        return node;
      case 'variable':
        if (token.flags === 0 && this.at('[')) {
          node.kind = 'procedureCall'; node.name = token.value;
          node.args = this.bracketList(() => this.expression()); return node;
        }
        node.kind = 'assign';
        node.target = this.variable(token);
        this.expect('=');
        node.value = this.expression();
        return node;
      case 'Left$': case 'Right$': case 'Mid$': case 'Mid$2':
        node.kind = 'substring_assign';
        node.name = token.name;
        this.expect('(');
        node.target = this.variable();
        node.args = [];
        for (let i = 1; i < functions[token.name].length; i++) {
          this.expect(',');
          node.args.push(this.expression());
        }
        this.expect(')');
        this.expect('=');
        node.value = this.expression();
        return node;
      case 'Print#':
        node.channel = this.expression();
        this.expect(',');
        // Shares the same value/separator grammar with screen Print.
      case 'Print':
        node.values = [];
        node.separators = [];
        node.formats = [];
        const readPrintItem = () => {
          let format = null;
          if (this.match('Using')) { format = this.expression(); this.expect(';'); }
          node.formats.push(format);
          node.values.push(this.expression());
        };
        if (!this.isEnd()) {
          readPrintItem();
          while (this.at(',') || this.at(';')) {
            node.separators.push(this.take().name);
            if (this.isEnd()) break;
            readPrintItem();
          }
        }
        return node;
      case 'Open In': case 'Open Out': case 'Open Port': case 'Append':
        node.channel = this.expression();
        this.expect(',');
        node.filename = this.expression();
        return node;
      case 'Close':
        node.channel = this.expression();
        return node;
      case 'Close All': return node;
      case 'Input#': case 'Line Input#':
        node.channel = this.expression();
        this.expect(',');
        node.targets = [this.variable()];
        while (this.match(',')) node.targets.push(this.variable());
        return node;
      case 'Goto': case 'Gosub':
        if (this.at('labelRef') || (this.at('variable') && !(this.peek().flags & 15) &&
            ['EOL', ':', 'Else', 'EOF'].includes(this.tokens[this.index + 1].name))) node.label = this.take().value;
        else node.target = this.expression();
        return node;
      case 'On':
        node.selector = this.expression();
        if (!this.at('Goto') && !this.at('Gosub')) this.error('On requires Goto or Gosub with named labels');
        node.branch = this.take().name;
        node.labels = [this.expect('labelRef').value];
        while (this.match(',')) node.labels.push(this.expect('labelRef').value);
        return node;
      case 'Return': case 'End': case 'Edit': return node;
      case 'Wait':
        node.value = this.expression();
        return node;
      case 'Wait Key': case 'Wait Vbl': return node;
      case 'Do': case 'Loop': case 'Repeat': case 'Wend':
      case 'Else': case 'Endif': return node;
      case 'While': case 'Until':
        node.condition = this.expression();
        return node;
      case 'Swap':
        node.left = this.variable(); this.expect(','); node.right = this.variable();
        return node;
      case 'Inc': case 'Dec':
        node.variable = this.variable();
        return node;
      case 'Add': case 'Add Range':
        node.variable = this.variable();
        this.expect(','); node.delta = this.expression();
        if (token.name === 'Add Range' && !this.at(',')) this.error('Add Range requires lower and upper bounds');
        if (this.match(',')) {
          node.low = this.expression(); this.expect('To'); node.high = this.expression();
        }
        node.kind = 'Add';
        return node;
      case 'Dim':
        node.arrays = [this.variable()];
        while (this.match(',')) node.arrays.push(this.variable());
        if (node.arrays.some(array => !array.indices || !array.indices.length)) this.error('Dim requires array dimensions', token);
        return node;
      case 'Data':
        if (this.index > 1 && this.tokens[this.index - 2].location.line === token.location.line && this.tokens[this.index - 2].name !== 'label') this.error('Data must start a line or follow its label', token);
        node.values = [];
        do {
          node.values.push(this.at(',') || this.at('EOL') ? null : this.expression());
        } while (this.match(','));
        return node;
      case 'Read':
        node.targets = [this.variable()];
        while (this.match(',')) node.targets.push(this.variable());
        return node;
      case 'Restore':
        node.label = this.isEnd() ? null : this.expect('labelRef').value;
        return node;
      case 'Exit If':
        node.condition = this.expression();
        node.level = this.match(',') ? this.expression() : { kind: 'number', value: 1, location: node.location };
        return node;
      case 'Exit':
        node.level = this.isEnd() ? { kind: 'number', value: 1, location: node.location } : this.expression();
        return node;
      case 'If':
        node.condition = this.expression();
        if (this.match('Then')) {
          node.kind = 'ifInline';
          node.yes = this.inlineStatements();
          const hasElse = this.match('Else');
          node.no = hasElse ? this.inlineStatements() : [];
          if (!node.yes.length || (hasElse && !node.no.length)) this.error('Expected conditional statement');
        }
        return node;
      case 'Else If':
        node.condition = this.expression();
        return node;
      case 'Global': case 'Shared':
        node.variables = [this.variable(null, true)];
        while (this.match(',')) node.variables.push(this.variable(null, true));
        return node;
      case 'Procedure':
        node.name = this.expect('variable').value;
        node.parameters = this.bracketList(() => this.expect('variable'));
        this.expect('EOL');
        node.body = [];
        while (!this.at('End Proc')) {
          if (this.at('EOF')) this.error('Procedure without End Proc', token);
          if (this.match('EOL') || this.match(':')) continue;
          node.body.push(this.statement());
          if (![':', 'EOL'].includes(this.peek().name)) this.error('Expected end of statement');
        }
        node.endLocation = this.take().location;
        const results = this.bracketList(() => this.expression());
        if (results.length > 1) this.error('End Proc accepts one result', token);
        node.result = results[0] || null;
        return node;
      case 'procedureCall':
        node.name = token.value;
        node.args = this.bracketList(() => this.expression());
        return node;
      case 'For':
        node.variable = this.expect('variable');
        this.expect('=');
        node.start = this.expression();
        this.expect('To');
        node.end = this.expression();
        node.step = this.match('Step') ? this.expression() : { kind: 'number', value: 1, location: node.location };
        return node;
      case 'Next':
        node.variable = this.match('variable');
        return node;
      default: return this.error('Unsupported statement', token);
    }
  }

  isEnd() { return ['EOF', 'EOL', ':', 'Else'].includes(this.peek().name); }

  variable(token = null, declaration = false) {
    const result = { ...(token || this.expect('variable')), kind: 'variable' };
    if (this.match('(')) {
      result.array = true;
      result.indices = [];
      if (!(declaration && this.at(')'))) {
        result.indices.push(this.expression());
        while (this.match(',')) result.indices.push(this.expression());
      }
      this.expect(')');
    } else if (result.flags & 0x40) this.error('Array reference requires indices', result);
    return result;
  }

  bracketList(read) {
    if (!this.match('[')) return [];
    const values = [];
    if (!this.at(']')) {
      values.push(read());
      while (this.match(',')) values.push(read());
    }
    this.expect(']');
    return values;
  }

  inlineStatements() {
    const statements = [];
    while (!['EOL', 'EOF', 'Else'].includes(this.peek().name)) {
      statements.push(this.statement());
      if (!this.match(':')) break;
    }
    return statements;
  }

  expression(minimum = 0) {
    const token = this.take();
    let left;
    if (token.name === 'variable') {
      left = this.variable(token);
    } else if (['number', 'string'].includes(token.name)) {
      left = { ...token, kind: token.name };
    } else if (token.name === '(') {
      left = this.expression();
      this.expect(')');
    } else if (token.name === '+' || token.name === '-') {
      left = { kind: 'unary', operator: token.name, value: this.expression(0x10000), location: token.location };
    } else if (token.name === 'Not') {
      // FnNot/Expentier evaluates the following expression through its normal
      // delimiter, then converts to integer and inverts the complete longword.
      left = { kind: 'bit_not', value: this.expression(), location: token.location };
    } else if (['Pi#', 'Lowres', 'Hires', 'True', 'False'].includes(token.name)) {
      left = { kind: 'constant', name: token.name, location: token.location };
    } else if (['Param', 'Param#', 'Param$'].includes(token.name)) {
      left = { kind: 'param', name: token.name, location: token.location };
    } else if (functions[token.name]) {
      const args = [];
      if (functions[token.name].length) { this.expect('('); args.push(this.expression()); }
      for (let i = 1; i < functions[token.name].length; i++) {
        this.expect((token.name === 'Frame Load' && i === 1) || (display.queries[token.name] && display.queries[token.name].to === i) ? 'To' : ',');
        args.push(this.expression());
      }
      if (functions[token.name].length) this.expect(')');
      left = { kind: 'function', name: token.name, args, location: token.location };
    } else {
      return this.error('Expected expression', token);
    }
    while (precedence[this.peek().name] != null && precedence[this.peek().name] >= minimum) {
      const operator = this.take().name;
      const right = this.expression(precedence[operator] + 1);
      left = { kind: 'binary', operator, left, right, location: left.location };
    }
    return left;
  }
}

module.exports = Parser;
