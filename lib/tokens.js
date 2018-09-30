/* jshint esversion: 6 */

const GET_BYTE = -1, SKIP_BYTE = -2,
      GET_WORD = -3, SKIP_WORD = -4,
      GET_DWORD = -5, SKIP_DWORD = -6,
      GET_VARIABLE = -7, GET_EXPRESSION = -8,
      GET_INTEGER = -9, GET_FLOAT = -10,
      GET_NUMBER = -11, GET_STRING = -12,
      END = -13;

var token_byName = {
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
  'Dec' : 0x44e
  'Rem' : 0x64a,
  '`'   : 0x652,
};

// special rules for control structures etc
var grammar = {
  program: [
    [['"lines"'], null]
  ],
  lines: [
    [['"line"'], null],
    [['"line"', '"lines"'], null],
  ],
  line: [
    [[GET_BYTE, GET_BYTE, '"statements"', 0x00], null]
  ],
  statements: [
    [['"ifStatement"'], null],
    [['"statement"'], null],
    [['"statement"', ':', '"statements"'], null]
  ],
  statement: [
    [['"callStatement"'], pass],
    [['"variable"', '=', '"expression"'], amosVariableAssignment],
    [['For', SKIP_WORD, '"variable"', '=', '"expression"', 'To', '"expression"'], amosForTo],
    [['For', SKIP_WORD, '"variable"', '=', '"expression"', 'To', '"expression"', 'Step',  '"expression"'], amosForTo],
    [['Exit', GET_WORD, SKIP_WORD], amosExit],
    [['Exit', GET_WORD, SKIP_WORD, 0x03e, SKIP_DWORD, END], amosExit],
    [['Rem', GET_STRING, END], amosRem],
    [['`', GET_STRING, END], amosRem],
    [['Procedure', GET_DWORD, SKIP_WORD, SKIP_BYTE, SKIP_BYTE, 'VAR', GET_VARIABLE], amosProcedure],
    [['End Proc', END], amosReturn],
    [['Inc', 'VAR', GET_VARIABLE, END], amosInc],
    [['Dec', 'VAR', GET_VARIABLE, END], amosDec]
  ],
  ifStatement: [
    [['if', SKIP_WORD, GET_EXPRESSION, 'Then', '"statement"'], amosIfThen],
  ],
  callStatement: [
    [[0x012, '"identifier"'], amosProcedureCall]
    [[0x012, '"identifier"', '[', '"list"', ']'], amosProcedureCall]
  ],
  list: [
    [['"expression"'], pass],
    [['"expression"', ',', '"list"'], commaJoin]
  ]
  expression: [
    [['"variable"'], pass],
    [['"integer"'], pass],
    [['"string"'], pass],
    [['"float"'], pass]
  ],
  variable: [
    [[0x006, '"identifier"'], pass],
  ],
  integer: [
    [[0x01E, GET_DWORD], amosInteger],
    [[0x036, GET_DWORD], amosInteger],
    [[0x03E, GET_DWORD], amosInteger]
  ],
  string: [
    [[0x026, GET_WORD], amosDQString],
    [[0x02E, GET_WORD], amosSQString]
  ],
  float: [
    [[0x046, GET_DWORD], amosFloat]
  ],
  identifier: [
    [[SKIP_WORD, GET_BYTE, GET_BYTE], amosIdentifier]
  ]
};

testRules()
{
  var token_start_ip = this.buffer.ip;
  var eliminated = [];
  // for (i of rules)
}

function pass(ret) { return ret; }

function commaJoin(first, second)
{
  return first + ', ' + second;
}

function amosIdentifier(len, flags)
{
  let name = this.popString(len);

  if (flags & 1) name = 'float_' + name;
  else if (flags & 2) name = 'string_' + name;
  else name = 'int_' + name;

  return name;
}

function amosVariableAssignment(variable, expression)
{

}

function amosFloat(bits)
{
  let exponent = bits & 0b1111111;
  let sign = (bits & 0b10000000) ? '-' : '';
  let mantissa = (bits >>> 8)
  return sign + (mantissa * Math.pow(2, exponent - 88)).toString(10);
}

function amosInteger(val)
{
  return val.toString(10);
}

function amosDQString(len)
{
  return '"' + buffer.popString(len) + '"';
}

function amosSQString(len)
{
  return "'" + buffer.popString(len) + "'";
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
