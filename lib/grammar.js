/* jshint esversion: 6 */

var RuleFunctions = require('RuleFunctions');
var {token_by_name} = require('TokenTable');

// constant terminals
const GET_BYTE = -1, SKIP_BYTE = -2,
      GET_WORD = -3, SKIP_WORD = -4,
      GET_DWORD = -5, SKIP_DWORD = -6;

class Grammar extends RuleFunctions
{
  constructor(buffer)
  {
    // Token buffer
    this._buffer = buffer;

    // AMOS language grammar
    this._grammar = {
      program: [
        [['lines'], pass]
      ],
      lines: [
        [['line'], pass],
        [['line', 'lines'], joinNewLine],
      ],
      line: [
        [[SKIP_BYTE, SKIP_BYTE, 'lineblock', 0x00], pass],
        [[SKIP_BYTE, SKIP_BYTE, 'label', 'lineblock', 0x00], amosSetLabel]
      ],
      label: [
        [[0x00c, 'identifier'], pass]
      ],
      lineblock: [
        [['ifStatement'], pass],
        [['Procedure', GET_DWORD, SKIP_WORD, SKIP_BYTE, SKIP_BYTE, 'variable'], amosProcedure],
        [['End Proc', END], amosReturn],
        [['Rem', SKIP_BYTE, GET_BYTE, terminalStringLast], amosRem],
        [['`', SKIP_BYTE, GET_BYTE, terminalStringLast], amosRem],
        [['statements'], pass],
      ],
      statements: [
        [['statement', ':', 'statements'], joinNewLine],
        [['statement'], pass],
        [[], pass]
      ],
      statement: [
        [['callStatement'], pass],
        [['variable', '=', 'expression'], amosVariableAssignment],
        [['For', SKIP_WORD, 'variable', '=', 'expression', 'To', 'expression', 'Step',  'expression'], amosForTo],
        [['For', SKIP_WORD, 'variable', '=', 'expression', 'To', 'expression'], amosForTo],
        [['Exit', GET_WORD, SKIP_WORD, 'integer'], amosExit],
        [['Exit', GET_WORD, SKIP_WORD], amosExit],
        [['Inc', 'variable'], amosInc],
        [['Dec', 'variable'], amosDec],
        [['Gosub', 0x018, 'identifier'], amosGosub],
        [['Goto', 0x018, 'identifier'], amosGoto]
      ],
      ifStatement: [
        [['If', SKIP_WORD, 'expression', 'Then', 'statements', 'Else', 'statements'], amosIfThen],
        [['If', SKIP_WORD, 'expression', 'Then', 'statements'], amosIfThen],
      ],
      callStatement: [
        [[0x012, 'ientifier'], amosProcedureCall],
        [[0x012, 'identifier', '[', 'list', ']'], amosProcedureCall]
      ],
      list: [
        [['expression'], pass],
        [['expression', ',', 'list'], joinComma],
        [[], returnNull]
      ],
      printList: [
        [['expression'], pass],
        [['expression', ',', 'printList'], joinComma],
        [['expression', ';', 'printList'], joinComma]
      ],
      value: [
        [['variable'], pass],
        [['number'], pass],
        [['string'], pass]
      ],
      number: [
        [['integer'], pass],
        [['string'], pass],
        [['float'], pass],
        [['constant'], pass]
      ],
      variable: [
        [[0x006, 'identifier'], pass],
      ],
      expression: [ // VERIFY order
        [['+', 'expression'], generateUnary('+')],
        [['-', 'expression'], generateUnary('-')],
        [['expression', 'And', 'expression'], generateBinary('&')],
        [['expression', 'Or', 'expression'], generateBinary('|')],
        [['expression', 'Xor', 'expression'], amosXor],
        [['expression', '-', 'expression'], generateBinary('-')],
        [['expression', '*', 'expression'], generateBinary('*')],
        [['expression', '/', 'expression'], generateBinary('/')],
        [['expression', '^', 'expression'], amosPow],
        [['(', 'expression', ')'], amosParens],
        [['value'], pass],
        [['amosFunction'], pass]
      ],
      integer: [
        [[0x01E, GET_DWORD], amosInteger],
        [[0x036, GET_DWORD], amosInteger],
        [[0x03E, GET_DWORD], amosInteger]
      ],
      string: [
        [[0x026, GET_WORD, terminalStringLast], amosDQString],
        [[0x02E, GET_WORD, terminalStringLast], amosSQString]
      ],
      float: [
        [[0x046, GET_DWORD], amosFloat]
      ],
      constant: [
        [['Pi#'], generateString('Math.PI')]
      ],
      identifier: [
        [[SKIP_WORD, GET_BYTE, GET_BYTE, terminalStringSecondLast], amosIdentifier]
      ],
      amosFunction: [
        [['Sin', '(', 'expression', ')'], generateAmosTrig('Math.sin')],
        [['Min', '(', 'expression', ',', 'expression', ')'], generateFunction('Math.min')],
        [['Max', '(', 'expression', ',', 'expression', ')'], generateFunction('Math.max')],
        [['Log', '(', 'expression', ')'], generateFunction('Math.log10')],
        [['Ln', '(', 'expression', ')'], generateFunction('Math.log')]
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
        if ((item in token_by_name) && (item in grammar))
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
        else if (item in grammar)
        {
          let val = applyRuleSet(grammar[item]);
          if (val === null)
            return null;
          args.push(val);
        }

        // invalid rule item
        throw `Invalid item ${item} in rule`;
      }

      // helper function (for digesting strings)
      else if (typeof item === 'function')
      {
        // use the helper to fetch the string
        let val = item(...args);
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

      let result = applyRule(rule[0]);
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
