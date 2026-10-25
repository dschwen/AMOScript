/* jshint esversion: 6 */
'use strict';

// Pure shared assertions: browser demos and headless tests use the same
// independently transcribed expectations, without invoking a decoder as oracle.
module.exports = function checkRoller2Initialization(program, expected, loaded = true) {
  const check = (condition, message) => { if (!condition) throw new Error(`Roller II initialization: ${message}`); };
  const variables = program.state.variables;
  const get = (name, index) => program.arrayGet(variables[name], [index]);
  const names = expected[loaded ? 'loadedNames' : 'defaultNames'], scores = expected[loaded ? 'loadedScores' : 'defaultScores'];
  for (const [name, length] of [['array_int_c', 17], ['array_string_hi', 12], ['array_int_scr', 12],
    ['array_string_descr', 55], ['array_string_sas', 55], ['array_int_clen', 55]]) {
    check(variables[name].dimensions.length === 1 && variables[name].dimensions[0] === length, `${name} dimensions`);
  }
  for (let index = 0; index < 12; index++) {
    check(get('array_string_hi', index) === (names[index - 1] || ''), `name ${index}`);
    check(get('array_int_scr', index) === (scores[index - 1] || 0), `score ${index}`);
  }
  for (let index = 0; index < 55; index++) {
    check(get('array_string_sas', index) === (expected.handlers[index] || ''), `handler ${index}`);
    check(get('array_int_clen', index) === (expected.connected.includes(index) ? -1 : 0), `connection ${index}`);
    check(get('array_string_descr', index) === '', `description ${index}`);
  }
  const bank = program.banks.get(10);
  check(bank && bank.type === 'data' && bank.name === 'Work    ' && bank.memory === 'fast' && !bank.permanent && bank.data.length === 490, 'work bank shape');
  check(bank.data.every(byte => byte === 0), 'work bank contents');
  check(program.banks.get(2).images.length === 117 && program.banks.get(1).images.length === 4, 'image banks');
  return { scores: names.map((name, index) => ({ name, score: scores[index] })), handlers: Object.keys(expected.handlers).length, connections: expected.connected.length, workBytes: bank.data.length };
};
