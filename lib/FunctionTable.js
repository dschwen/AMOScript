/* jshint esversion: 6 */
'use strict';

// Token-specific arities preserve AMOS's separate two/three-argument variants.
module.exports = {
  At: ['number?', 'number?'],
  'Dir$': [], Exist: ['string'],
  'Fsel$': ['string'], 'Fsel$2': ['string', 'string'],
  'Fsel$3': ['string', 'string', 'string'], 'Fsel$4': ['string', 'string', 'string', 'string'],
  Timer: [], Dfree: [], 'Dir First$': ['string'], 'Dir Next$': [], 'Text Length': ['string'], Btst: ['number', 'number'],
  'Text Base': [],
  'Font$': ['number'],
  Areg: ['number'], Varptr: ['any'], Doscall: ['number'], 'Screen Base': [],
  'Frame Load': ['number', 'number', 'number'], 'Frame Play': ['number', 'number'],
  Sin: ['number'], Cos: ['number'], Tan: ['number'], Min: ['any', 'any'], Max: ['any', 'any'],
  Log: ['number'], Ln: ['number'], Exp: ['number'], Sqr: ['number'],
  Abs: ['number'], Sgn: ['number'], Int: ['number'],
  'Left$': ['string', 'number'], 'Right$': ['string', 'number'],
  'Mid$': ['string', 'number', 'number'], 'Mid$2': ['string', 'number'],
  'Chr$': ['number'], 'Space$': ['number'], 'String$': ['string', 'number'],
  'Upper$': ['string'], 'Lower$': ['string'], 'Flip$': ['string'],
  'Str$': ['number'], Val: ['string'], Len: ['string'], Asc: ['string'],
  Instr: ['string', 'string'], Instr3: ['string', 'string', 'number'],
  Eof: ['number'], Lof: ['number'], Pof: ['number']
};

for (const [name, query] of Object.entries(require('./DisplayTable').queries)) module.exports[name] = query.args;
