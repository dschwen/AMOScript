/* jshint esversion: 6 */

const GET_BYTE = -1, SKIP_BYTE = -2,
      GET_WORD = -3, SKIP_WORD = -4,
      GET_DWORD = -5, SKIP_DWORD = -6,
      GET_VARIABLE = -7, GET_EXPRESSION = -8,
      GET_INTEGER = -9, GET_FLOAT = -10,
      GET_NUMBER = -11, GET_STRING = -12;

var token_byName = {
  ',': 0x05C,
  '(': 0x05C,
  ')': 0x05C,
  '=': 0xFFA2,
  'VAR': 0x006,
  'CALL': 0x012,
  'For': 0x23c,
  'To' : 0x094,
  'Step': 0x356,
  'Exit': 0x29e,
  'Rem': 0x064a,
  '`': 0x0652,
  'Procedure': 0x0376,
  'End Proc': 0x0390,
  'Inc': 0x0444,
  'Dec': 0x044e
};

// special rules for control structures etc
var rules = [
  [['VAR', GET_VARIABLE, 0xFFA2, GET_EXPRESSION], amosVariableAssignment],
  [['CALL', GET_VARIABLE], amosProcedureCall],
  [['For', 'VAR', GET_VARIABLE, '=', GET_EXPRESSION, 'To', GET_EXPRESSION], amosForTo],
  [['For', 'VAR', GET_VARIABLE, '=', GET_EXPRESSION, 'To', GET_EXPRESSION, 'Step', GET_EXPRESSION], amosForTo],
  [['Exit', GET_WORD, SKIP_WORD], amosExit],
  [['Exit', GET_WORD, SKIP_WORD, 0x03e, SKIP_DWORD], amosExit],
  [['Rem', GET_STRING], amosRem],
  [['`', GET_STRING], amosRem],
  [['Procedure', GET_DWORD, SKIP_WORD, SKIP_BYTE, SKIP_BYTE, 'VAR', GET_VARIABLE], amosProcedure],
  [['End Proc'], amosReturn],
  [['Inc', 'VAR', GET_VARIABLE], amosInc],
  [['Dec', 'VAR', GET_VARIABLE], amosDec],
];

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
