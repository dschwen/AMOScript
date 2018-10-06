/* jshint esversion: 6 */

var RuleFunctions = require('./RuleFunctions');
var {token_by_name} = require('./TokenTable');

// constant terminals
const GET_BYTE = -1, SKIP_BYTE = -2,
      GET_WORD = -3, SKIP_WORD = -4,
      GET_DWORD = -5, SKIP_DWORD = -6;

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
        [['line'], this.pass],
        [['line', 'lines'], this.joinNewLine],
      ],
      line: [
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
        [['statement', ':', 'statements'], this.joinNewLine],
        [['statement'], this.pass],
        [[], this.pass]
      ],
      statement: [
        [['callStatement'], this.pass],
        [['variable', '=', 'expression'], this.amosVariableAssignment],
        [['For', SKIP_WORD, 'variable', '=', 'expression', 'To', 'expression', 'Step',  'expression'], this.amosForTo],
        [['For', SKIP_WORD, 'variable', '=', 'expression', 'To', 'expression'], this.amosForTo],
        [['Exit', GET_WORD, SKIP_WORD, 'integer'], this.amosExit],
        [['Exit', GET_WORD, SKIP_WORD], this.amosExit],
        [['Inc', 'variable'], this.amosInc],
        [['Dec', 'variable'], this.amosDec],
        [['Gosub', 0x018, 'identifier'], this.amosGosub],
        [['Goto', 0x018, 'identifier'], this.amosGoto]
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
        [[0x006, 'identifier'], this.pass],
      ],
      expression: [ // VERIFY order
        [['+', 'expression'], this.generateUnary('+')],
        [['-', 'expression'], this.generateUnary('-')],
        [['expression', 'comparison', 'expression'], this.join],
        [['expression', 'And', 'expression'], this.generateBinary('&')],
        [['expression', 'Or', 'expression'], this.generateBinary('|')],
        [['expression', 'Xor', 'expression'], this.amosXor],
        [['expression', '-', 'expression'], this.generateBinary('-')],
        [['expression', '*', 'expression'], this.generateBinary('*')],
        [['expression', '/', 'expression'], this.generateBinary('/')],
        [['expression', '^', 'expression'], this.amosPow],
        [['(', 'expression', ')'], this.amosParens],
        [['value'], this.pass],
        [['amosFunction'], this.pass]
      ],
      comparison: [
        [['#>='], this.generateSymbol('>=')],
        [['#<='], this.generateSymbol('<=')],
        [['>='], this.generateSymbol('>=')],
        [['<='], this.generateSymbol('<=')],
        [['<>'], this.generateSymbol('!=')],
        [['='], this.generateSymbol('==')]
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

  terminalStringSecondLast()
  {
    var args = [...arguments];
    var flags = args.pop();
    var len = args.pop();
    return this._buffer.popString(len);
  }

  terminalStringLast()
  {
    var args = [...arguments];
    var len = args.pop();
    return this._buffer.popString(len);
  }

  run()
  {
    this.applyRuleSet(this._grammar.program);
  }

  applyRule(rule)
  {
    console.log(rule);

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
        let val = item.apply(this, args);
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
        return rule[1](...result);

      // reset pointer to start of rule
      this._buffer.ip = ip;
    }

    return null;
  }

  pass(ret) { return ret; }

  returnNull()
  {
    return null;
  }

  generateSymbol(symbol)
  {
    return (first) => { return symbol; };
  }

  generateUnary(operator)
  {
    return (first) => { return operator + first; };
  }

  generateBinary(operator)
  {
    return (first, second) => { return first + operator + second; };
  }

  generateFunction(func)
  {
    return () => { return `${func}(${[...arguments].join(',')})`; };
  }

  generateString(text)
  {
    return () => { return text; };
  }

  generateAmosTrig(func)
  {
    return (first) => { return func + `(AMOState.trigFactor*(${first}))`; };
  }

  joinComma(first, second)
  {
    if (second !== null)
      return `${first}, ${second}`;
    return first;
  }

  joinNewLine(first, second)
  {
    if (second !== null)
      return `${first}\n${second}`;
    return first;
  }
}

module.exports = Grammar;
