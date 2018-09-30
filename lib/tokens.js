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
  '=': 0xFFA2,
  'VAR' : 0x006,
  'CALL': 0x012,
  'To'  : 0x094,
  'For' : 0x23c,
  'Exit': 0x29e,
  'If'  : 0x2be,
  'Then': 0x2c6,
  'Else': 0x2d0,
  'Step': 0x356,
  'Endif'    : 0x2da,
  'Procedure': 0x376,
  'End Proc' : 0x390,
  'Inc' : 0x444,
  'Dec' : 0x44e,
  'Rem' : 0x64a,
  '`'   : 0x652
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
    [[SKIP_BYTE, SKIP_BYTE, 'statements', 0x00], pass],
    [[SKIP_BYTE, SKIP_BYTE, 'label', 'statements', 0x00], amosSetLabel] // VERIFY THIS
  ],
  statements: [
    [['ifStatement'], pass],
    [['statement'], pass],
    [['statement', ':', 'statements'], joinNewLine]
  ],
  statement: [
    [['callStatement'], pass],
    [['variable', '=', 'expression'], amosVariableAssignment],
    [['For', SKIP_WORD, 'variable', '=', 'expression', 'To', 'expression', 'Step',  'expression'], amosForTo],
    [['For', SKIP_WORD, 'variable', '=', 'expression', 'To', 'expression'], amosForTo],
    [['Exit', GET_WORD, SKIP_WORD, 'integer'], amosExit],
    [['Exit', GET_WORD, SKIP_WORD], amosExit],
    [['Rem', SKIP_BYTE, GET_BYTE, terminalStringLast], amosRem],
    [['`', SKIP_BYTE, GET_BYTE, terminalStringLast], amosRem],
    [['Procedure', GET_DWORD, SKIP_WORD, SKIP_BYTE, SKIP_BYTE, 'variable'], amosProcedure],
    [['End Proc', END], amosReturn],
    [['Inc', 'variable'], amosInc],
    [['Dec', 'variable'], amosDec]
  ],
  ifStatement: [
    [['If', SKIP_WORD, 'expression', 'Then', 'statement'], amosIfThen],
  ],
  callStatement: [
    [[0x012, 'identifier'], amosProcedureCall],
    [[0x012, 'identifier', '[', 'list', ']'], amosProcedureCall]
  ],
  list: [
    [['expression'], pass],
    [['expression', ',', 'list'], joinComma]
  ],
  expression: [
    [['variable'], pass],
    [['integer'], pass],
    [['string'], pass],
    [['float'], pass]
  ],
  variable: [
    [[0x006, 'identifier'], pass],
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
  identifier: [
    [[SKIP_WORD, GET_BYTE, GET_BYTE, terminalStringSecondLast], amosIdentifier]
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
      throw "Invalid item '" + item + "' in rule";
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

function joinComma(first, second)
{
  return first + ', ' + second;
}

function joinNewLine(first, second)
{
  return first + ', ' + second;
}

function amosRem(len)
{
  return '/*' + this.popString(len) + '*/';
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
  return '"' + text + '"';
}

function amosSQString(len, text)
{
  return "'" + text + "'";
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
