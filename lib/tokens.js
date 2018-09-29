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
  line: [
    [[GET_BYTE, GET_BYTE, '"commands"', 0x00], amosLine]
  ],
  commands: [
    [['"command"']],
    [['"command"', ':', '"commands"']]
  ],
  command: [
    [['VAR', GET_VARIABLE, 0xFFA2, GET_EXPRESSION, END], amosVariableAssignment],
    [['CALL', GET_VARIABLE], amosProcedureCall],
    [['For', SKIP_WORD, 'VAR', GET_VARIABLE, '=', GET_EXPRESSION, 'To', GET_EXPRESSION, END], amosForTo],
    [['For', SKIP_WORD, 'VAR', GET_VARIABLE, '=', GET_EXPRESSION, 'To', GET_EXPRESSION, 'Step', GET_EXPRESSION, END], amosForTo],
    [['if', SKIP_WORD, GET_EXPRESSION, 'Then', '"command"'], amosForTo],
    [['Exit', GET_WORD, SKIP_WORD, END], amosExit],
    [['Exit', GET_WORD, SKIP_WORD, 0x03e, SKIP_DWORD, END], amosExit],
    [['Rem', GET_STRING, END], amosRem],
    [['`', GET_STRING, END], amosRem],
    [['Procedure', GET_DWORD, SKIP_WORD, SKIP_BYTE, SKIP_BYTE, 'VAR', GET_VARIABLE], amosProcedure],
    [['End Proc', END], amosReturn],
    [['Inc', 'VAR', GET_VARIABLE, END], amosInc],
    [['Dec', 'VAR', GET_VARIABLE, END], amosDec]
  ]
};

testRules()
{
  var token_start_ip = this.buffer.ip;
  var eliminated = [];
  // for (i of rules)
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
