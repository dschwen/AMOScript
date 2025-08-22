/* jshint esversion: 6 */

var RuleFunctions = require('./RuleFunctions');
var {token_by_name} = require('./TokenTable');

// constant terminals
const GET_BYTE = -1, SKIP_BYTE = -2,
      GET_WORD = -3, SKIP_WORD = -4,
      GET_DWORD = -5, SKIP_DWORD = -6;

//
// AMOS token bytecode grammar
//

class Grammar extends RuleFunctions
{
  constructor(buffer)
  {
    super();

    // Token buffer
    this._buffer = buffer;

    // AMOS language grammar
    this._grammar = {
      program: [
        [['lines'], this.pass]
      ],
      lines: [
        [['line', 'lines'], this.joinNewLine],
        [['line'], this.pass]
      ],
      line: [
        // Header-dispatched lines for constructs not present as content tokens
        [[SKIP_BYTE, SKIP_BYTE, this.header('For')], this.parseLineFor],
        [[SKIP_BYTE, SKIP_BYTE, this.header('Next')], this.parseLineNext],
        [[SKIP_BYTE, SKIP_BYTE, this.header('Print')], this.parseLinePrint],
        [[SKIP_BYTE, SKIP_BYTE, 'lineblock', 0x00], this.pass],
        [[SKIP_BYTE, SKIP_BYTE, 'label', 'lineblock', 0x00], this.amosSetLabel]
      ],
      label: [
        [[0x00c, 'identifier'], this.pass]
      ],
      lineblock: [
        [['ifStatement'], this.pass],
        [['Procedure', GET_DWORD, SKIP_WORD, SKIP_BYTE, SKIP_BYTE, 'variable'], this.amosProcedure],
        [['End Proc'], this.amosReturn],
        [['Rem', SKIP_BYTE, GET_BYTE, this.terminalStringLast], this.amosRem],
        [['`', SKIP_BYTE, GET_BYTE, this.terminalStringLast], this.amosRem],
        [['statements'], this.pass],
      ],
      statements: [
        [[this.expectEOL], this.generateString('')],
        [['statement', 'statementsTail'], this.joinNewLine]
      ],
      statementsTail: [
        [[':', 'statements'], this.pass],
        [[this.expectEOL], this.generateString('')]
      ],
      statement: [
        [['callStatement'], this.pass],
        [['variable', '=', 'expression'], this.amosVariableAssignment],
        [['For', SKIP_WORD, 'variable', '=', 'expression', 'To', 'expression', 'Step',  'expression'], this.amosForTo],
        [['For', SKIP_WORD, 'variable', '=', 'expression', 'To', 'expression'], this.amosForTo],
        [['Next', 'variable'], this.amosNext],
        [['Next'], this.amosNext],
        [['Exit', GET_WORD, SKIP_WORD, 'integer'], this.amosExit],
        [['Exit', GET_WORD, SKIP_WORD], this.amosExit],
        [['Inc', 'variable'], this.amosInc],
        [['Dec', 'variable'], this.amosDec],
        [['Gosub', 0x018, 'identifier'], this.amosGosub],
        [['Goto', 0x018, 'identifier'], this.amosGoto],
        [['Return'], this.amosReturn],
        [['Return', GET_WORD, SKIP_WORD], this.amosReturn],
        [['Return', SKIP_WORD], this.amosReturn],
        [['End'], this.amosEnd],
        [['Print', 'printList'], this.generateFunction('print')]
      ],
      ifStatement: [
        [['If', SKIP_WORD, 'expression', 'Then', 'statements', 'Else', 'statements'], this.amosIfThen],
        [['If', SKIP_WORD, 'expression', 'Then', 'statements'], this.amosIfThen],
      ],
      callStatement: [
        [[0x012, 'identifier'], this.amosProcedureCall],
        [[0x012, 'identifier', '[', 'list', ']'], this.amosProcedureCall]
      ],
      list: [
        [['expression'], this.pass],
        [['expression', ',', 'list'], this.joinComma],
        [[], this.returnNull]
      ],
      printList: [
        [['expression'], this.pass],
        [['expression', ',', 'printList'], this.joinComma],
        [['expression', ';', 'printList'], this.joinComma]
      ],
      value: [
        [['variable'], this.pass],
        [['number'], this.pass],
        [['string'], this.pass]
      ],
      number: [
        [['integer'], this.pass],
        [['string'], this.pass],
        [['float'], this.pass],
        [['constant'], this.pass]
      ],
      variable: [
        [[0x006, 'identifier'], this.pass]
      ],
      expression: [
        [['operator', 'expression'], this.join],
        [['expressionPow', 'expression'], this.join],
        [['expressionItem', 'expression'], this.join],
        [[], this.pass]
        // [['expression1', '^', 'expression'], this.amosPow],
        // [['expression1', 'Xor', 'expression'], this.amosXor],
      ],
      expressionParens: [
        [['(', 'expression', ')', 'expression'], this.amosParens]
      ],
      expressionPow: [
        [['expressionItem', '^', 'expressionItem'], this.amosPow]
      ],
      expressionItem: [
        [['(', 'expression', ')'], this.amosParens],
        [['+', 'expressionItem'], this.generateUnary('+')],
        [['-', 'expressionItem'], this.generateUnary('-')],
        [['value'], this.pass],
        [['amosFunction'], this.pass]
      ],
      operator: [
        [['+'], this.generateString('+')],
        [['-'], this.generateString('-')],
        [['*'], this.generateString('*')],
        [['/'], this.generateString('/')],
        [['And'], this.generateString('&')],
        [['Or'], this.generateString('|')],
        [['comparison'], this.pass]
      ],
      comparison: [
        [['#>='], this.generateString('>=')],
        [['#<='], this.generateString('<=')],
        [['>='], this.generateString('>=')],
        [['<='], this.generateString('<=')],
        [['<>'], this.generateString('!=')],
        [['='], this.generateString('==')]
      ],
      integer: [
        [[0x01E, GET_DWORD], this.amosInteger],
        [[0x036, GET_DWORD], this.amosInteger],
        [[0x03E, GET_DWORD], this.amosInteger]
      ],
      string: [
        [[0x026, GET_WORD, this.terminalStringLast], this.amosDQString],
        [[0x02E, GET_WORD, this.terminalStringLast], this.amosSQString]
      ],
      float: [
        [[0x046, GET_DWORD], this.amosFloat]
      ],
      constant: [
        [['Pi#'], this.generateString('Math.PI')]
      ],
      identifier: [
        [[SKIP_WORD, GET_BYTE, GET_BYTE, this.terminalStringSecondLast], this.amosIdentifier]
      ],
      amosFunction: [
        [['Sin', '(', 'expression', ')'], this.generateAmosTrig('Math.sin')],
        [['Min', '(', 'expression', ',', 'expression', ')'], this.generateFunction('Math.min')],
        [['Max', '(', 'expression', ',', 'expression', ')'], this.generateFunction('Math.max')],
        [['Log', '(', 'expression', ')'], this.generateFunction('Math.log10')],
        [['Ln', '(', 'expression', ')'], this.generateFunction('Math.log')]
      ]
    };
  }

  //
  // Rule item functions (for matching)
  //

  terminalStringSecondLast(...args)
  {
    return this._buffer.popString(args[1]);
  }

  terminalStringLast(...args)
  {
    return this._buffer.popString(args[0]);
  }

  terminalLogical()
  {
    let token = buffer.popWord();
  }

  //
  // Recursive grammar application routines
  //

  // Helper to match a line-header token by name without committing other rule parts
  header(name)
  {
    const expect = token_by_name[name];
    return () => {
      const w = this._buffer.getWord(this._buffer.ip);
      if (w === expect) {
        // capture current line index for downstream alignment
        this._currentLineIndex = this._buffer.lineNumber();
        this._buffer.popWord();
        this.emit({ kind: 'dbg', tag: `HDR:${name}` });
        return '';
      }
      return null;
    };
  }

  // Procedural header-line parsers (consume rest of line and emit)
  parseLineFor()
  {
    // Try with Step
    const ip0 = this._buffer.ip;
    let r = this.applyRule([SKIP_WORD, 'variable', '=', 'expression', 'To', 'expression', 'Step', 'expression', 0x00]);
    if (r === null) {
      this._buffer.ip = ip0;
      r = this.applyRule([SKIP_WORD, 'variable', '=', 'expression', 'To', 'expression', 0x00]);
    }
    if (r === null) return '';
    // r contains [variable, start, end, step?] because SKIP_WORD/=/'To'/'Step'/0x00 produce no args
    const [variable, start, end, step] = r;
    this.emit({ kind: 'dbg', tag: `FOR:${variable}` });
    return this.amosForTo(variable, start, end, step == null ? 1 : step);
  }

  parseLinePrint()
  {
    const tb = this._buffer;
    const parts = [];
    // Compute current line end to avoid crossing into next line
    const idx = this._currentLineIndex != null ? this._currentLineIndex : tb.lineNumber();
    const start = tb.lines[idx];
    const lineEnd = start + tb.getByte(start) * 2;
    // Parse first expression
    const expr1 = this.applyRuleSet(this._grammar.expression);
    if (expr1 === null || expr1 === '') { tb.ip = lineEnd; return ''; }
    parts.push(expr1);
    // Parse , or ; separated list
    while (tb.ip < lineEnd) {
      const w = tb.getWord(tb.ip);
      if (w === 0x0000) { tb.popWord(); break; }
      if (w === token_by_name[','] || w === token_by_name[';']) {
        tb.popWord();
        const next = this.applyRuleSet(this._grammar.expression);
        if (next === null) break;
        parts.push(next);
        continue;
      }
      // Unexpected token; bail by consuming until EOL
      break;
    }
    const expr = parts.join(', ');
    if (expr) this.emit({ kind: 'print', expr });
    tb.ip = lineEnd;
    this._currentLineIndex = null;
    return expr;
  }

  parseLineNext()
  {
    // Parse a NEXT at the current line (header already consumed by header('Next'))
    const parseOne = () => {
      const r = this.applyRule(['variable', 0x00]);
      if (r !== null) {
        this.emit({ kind: 'dbg', tag: `NEXT:${r[0]}` });
        const out = this.amosNext(r[0]);
        this.alignToLineEnd();
        return out;
      }
      // Try variable-less NEXT
      const r2 = this.applyRule([0x00]);
      if (r2 === null) return '';
      this.emit({ kind: 'dbg', tag: 'NEXT' });
      const out2 = this.amosNext();
      this.alignToLineEnd();
      return out2;
    };

    // Parse the current NEXT line
    let out = parseOne();

    // Greedily parse subsequent NEXT lines if present (handles stacked NEXT)
    const b = this._buffer;
    while (true) {
      const idx = b.lineNumber();
      if (idx >= b.lines.length) break;
      const start = b.lines[idx];
      const hdr = b.getWord(start + 2);
      if (hdr !== token_by_name['Next']) break;
      // Consume header (simulate line rule's SKIP_BYTE, SKIP_BYTE, header pop)
      b.ip = start; b.popByte(); b.popByte(); b.popWord();
      out = parseOne();
    }
    return out;
  }

  run()
  {
    return this.applyRuleSet(this._grammar.program);
  }

  applyRule(rule)
  {
    // matched arguments
    var args = [];

    // shortcut
    var buffer = this._buffer;

    for (let item of rule)
    {
      // either a token name or a sub-rule
      if (typeof item === 'string')
      {
        // sanity check
        if ((item in token_by_name) && (item in this._grammar))
          throw "Ambiguous rule item '" + item + "'";

        // token name
        if (item in token_by_name)
        {
          let token = buffer.popWord();
          // if the token does not match the rule fails
          if (token !== token_by_name[item])
            return null;
        }

        // subrule
        else if (item in this._grammar)
        {
          let val = this.applyRuleSet(this._grammar[item]);
          if (val === null)
            return null;
          args.push(val);
        }
        else
        {
          // invalid rule item
          throw `Invalid item ${item} in rule`;
        }
      }

      // helper function (for digesting strings)
      else if (typeof item === 'function')
      {
        // use the helper to fetch the string
        let reverse_args = [...args].reverse();
        let val = item.apply(this, reverse_args);
        if (val === null)
          return null;
        args.push(val);
      }

      // raw token or terminal
      else if (typeof item === 'number')
      {
        // raw token
        if (item >= 0)
        {
          let token = buffer.popWord();
          // if the token does not match the rule fails
          if (token !== item)
            return null;
        }

        // terminal
        else
        {
          switch (item)
          {
            case GET_BYTE:
              args.push(buffer.popByte());
              break;

            case GET_WORD:
              args.push(buffer.popWord());
              break;

            case GET_DWORD:
              args.push(buffer.popDWord());
              break;

            case SKIP_BYTE:
              buffer.popByte();
              break;

            case SKIP_WORD:
              buffer.popWord();
              break;

            case SKIP_DWORD:
              buffer.popDWord();
              break;

            default:
              throw "Invalid terminal in rule";
          }
        }
      }
    }

    return args;
  }

  applyRuleSet(rule_set)
  {
    for (let rule of rule_set)
    {
      // save instruction pointer
      let ip = this._buffer.ip;

      let result = this.applyRule(rule[0]);
      if (result !== null)
      {
        // console.log(rule, result);
        return rule[1].apply(this, result);
      }

      // reset pointer to start of rule
      this._buffer.ip = ip;
    }

    return null;
  }
}

module.exports = Grammar;
