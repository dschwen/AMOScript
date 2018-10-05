/* jshint esversion: 6 */

var Buffer = require('./Buffer');
var Grammar = require('./Grammar');

// transpiler
class Transpiler extends Grammar
{
  constructor(data)
  {
    // AMOS data buffer
    super(new Buffer(new Uint8Array(data)));

    // line number
    var line_number = 0;

    // command index
    var op_id = 0;

    // index of the first op for each line
    var line_op = ['op_0'];

    // label table
    var label_table = {};

    this.run();
  }
}

module.exports = Transpiler;
