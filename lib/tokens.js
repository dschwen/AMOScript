const GET_BYTE = -1, SKIP_BYTE = -2,
      GET_WORD = -3, SKIP_WORD = -4,
      GET_DWORD = -5, SKIP_DWORD = -6,
      GET_VARIABLE = -7, GET_EXPRESSION = -8,
      GET_INTEGER = -9;

var token_byName = {
  '=': 0xFFA2,
  'VAR': 0x006,
  'For': 0x23c,
  'To' : 0x094,
  'Step': 0x356,
  'Exit': 0x29e
};

// special rules for control structures etc
var rules = [
  [['VAR', GET_VARIABLE, 0xFFA2, GET_EXPRESSION], amosVariableAssignment],
  [['For', 'VAR', GET_VARIABLE, '=', GET_EXPRESSION, 'To', GET_EXPRESSION], amosForTo],
  [['For', 'VAR', GET_VARIABLE, '=', GET_EXPRESSION, 'To', GET_EXPRESSION, 'Step', GET_EXPRESSION], amosForToStep],
  [['Exit', GET_WORD, SKIP_WORD], amosExit],
  [['Exit', GET_WORD, SKIP_WORD, 0x03e, SKIP_DWORD], amosExit],
];
