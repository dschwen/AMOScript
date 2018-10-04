/* jshint esversion: 6 */

// constant terminals
const GET_BYTE = -1, SKIP_BYTE = -2,
      GET_WORD = -3, SKIP_WORD = -4,
      GET_DWORD = -5, SKIP_DWORD = -6;

// token names to enhance rule readability
var token_by_name = {
  ':': 0x54,
  ',': 0x5C,
  '(': 0x74,
  ')': 0x7C,
  '='   : 0xffa2,
  'And' : 0xff58,
  'Or'  : 0xff4c
  'Xor' : 0xff3e
  'To'  : 0x094,
  'For' : 0x23c,
  'Exit': 0x29e,
  'Goto' : 0x2a8,
  'Gosub': 0x2b2,
  'If'   : 0x2be,
  'Then' : 0x2c6,
  'Else' : 0x2d0,
  'Endif': 0x2da,
  'Step' : 0x356,
  'Return': 0x360,
  'Procedure': 0x376,
  'End Proc' : 0x390,
  'Inc' : 0x444,
  'Dec' : 0x44e,
  'Rem' : 0x64a,
  '`'   : 0x652,
  'Pi#' : 0x6d6,
  'Sin' : 0x702
};

// grammar rules
var grammar = {
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
    [['statement', ':', 'statements'], joinNewLine]
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
    [['value'], pass]
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

function terminalStringSecondLast()
{
  var args = [...arguments];
  var flags = args.pop();
  var len = args.pop();
  return this.buffer.popString(len);
}

function terminalStringLast()
{
  var args = [...arguments];
  var len = args.pop();
  return this.buffer.popString(len);
}

function applyRule(rule)
{
  // matched arguments
  var args = [];

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
        let token = this.buffer.popWord();
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
        let token = this.buffer.popWord();
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
            args.push(this.buffer.popByte());
            break;

          case GET_WORD:
            args.push(this.buffer.popWord());
            break;

          case GET_DWORD:
            args.push(this.buffer.popDWord());
            break;

          case SKIP_BYTE:
            this.buffer.popByte();
            break;

          case SKIP_WORD:
            this.buffer.popWord();
            break;

          case SKIP_DWORD:
            this.buffer.popDWord();
            break;

          default:
            throw "Invalid terminal in rule";
        }
      }
    }
  }

  return args;
}

function applyRuleSet(rule_set)
{
  for (let rule of rule_set)
  {
    // save instruction pointer
    let ip = this.buffer.ip;

    let result = applyRule(rule[0]);
    if (result !== null)
      return rule[1](...result);

    // reset pointer to start of rule
    this.buffer.ip = ip;
  }

  return null;
}

function pass(ret) { return ret; }

function returnNull()
{
  return null;
}

function generateUnary(operator)
{
  return (first) => { return operator + first; };
}

function generateBinary(operator)
{
  return (first, second) => { return first + operator + second; };
}

function generateFunction(func)
{
  return () => { return `${func}(${[...arguments].join(',')})`; };
}

function generateString(text)
{
  return () => { return text; };
}

function generateAmosTrig(func)
{
  return (first) => { return func + `(AMOState.trigFactor*(${first}))`; };
}

function joinComma(first, second)
{
  if (second !== null)
    return `${first}, ${second}`;
  return first;
}

function joinNewLine(first, second)
{
  if (second !== null)
    return `${first}\n${second}`;
  return first;
}

function amosParens(value)
{
  return `(${value})`;
}

function amosPow(left, right)
{
  return `Math.pow(${left}, ${right})`;
}

function amosXor(left, right)
{
  return `((${left}) | (${right})) & ~((${left}) & (${right}))`;
}

function amosRem(len)
{
  return `/* ${this.popString(len)} */`;
}

function amosIdentifier(len, flags, name)
{
  if (flags & 1)
    name = 'float_' + name;
  else if (flags & 2)
    name = 'string_' + name;
  else
    name = 'int_' + name;

  return name;
}

function amosVariableAssignment(variable, expression)
{

}

function amosFloat(bits)
{
  let exponent = bits & 0b1111111;
  let sign = (bits & 0b10000000) ? '-' : '';
  let mantissa = (bits >>> 8);
  return sign + (mantissa * Math.pow(2, exponent - 88)).toString(10);
}

function amosInteger(val)
{
  return val.toString(10);
}

function amosDQString(len, text)
{
  return `"${text}"`;
}

function amosSQString(len, text)
{
  return `'${text}'`;
}

function amosForTo(var_name, start, end, step = 1)
{
}

function amosProcedure(end_offset, proc_name)
{}

function amosProcedureCall(proc_name)
{
  // if getWord = 0x0084 ([)  ... 0x008C (]) parameters separated by 0x005C (,)
}

function amosInc(var_name)
{
  // var_name++
}

function amosDec(var_name)
{
  // var_name--
}
