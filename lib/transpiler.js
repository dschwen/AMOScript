/* jshint esversion: 6 */

// transpiler
(() => {
  var Buffer = require('./buffer');

  var operators = {
    0x005C : ",",
    0x0064 : ";",
    0x0074 : "(",
    0x007C : ")",
    0x0084 : "[",
    0x008C : "]",
    0xFFC0 : "+",
    0xFFCA : "-",
    0xFFA2 : "=",
    0xFFE2 : "*",
    0xFFEC : "/",
    0xFFB6 : ">",
    0xFFAC : "<",
    0xFF8E : ">=",
    0xFF7A : "<=",
    0xFF98 : ">=",
    0xFF84 : "<=",
    0xFF66 : "<>",
    0xFFF6 : "^"
  };

  var intrinsics = {
    // 0x06A0 : "Sgn",
    0x06AA : "Math.abs",
    0x06B4 : "Math.floor",		// =Int( v# )
    // 0x06BE : "Radian" ,
    // 0x06CA : "Degree" ,
    0x06D6 : "Math.PI" ,
    // 0x06E0 : "Fix" ,
    0x06EA : "Math.min" ,
    0x06F6 : "Math.max" ,
    0x0702 : "Math.sin" ,
    0x070C : "Math.cos" ,
    0x0716 : "Math.tan" ,
    0x0720 : "Math.asin" ,
    0x072C : "Math.acos" ,
    0x0738 : "Math.atan" ,
    0x0744 : "Math.sinh" ,
    0x0750 : "Math.cosh" ,
    0x075C : "Math.tanh" ,
    // 0x0768 : "Sqr" ,
    // 0x0772 : "Log" ,
    // 0x077C : "Ln" ,
    0x0786 : "Math.exp"
  };

  // async keywords
  var async_tokens = [0x0cca, 0x1290, 0x129e];

  // async functions (these need to generate temporaries that are preemptable)


  // these are followed by explicit parenthesis token pairs
  var function_tokens = [];

  function default_finalize(next) { return 'return ' + next + ';\n'; }

  module.exports.run = (data) =>
  {
    // AMOS data buffer
    this.buffer = new Buffer(new Uint8Array(data));
    var line_length = this.buffer.popByte();

    // is the current line empty
    var empty = true;

    // indentation
    var indent = ' '.repeat(this.buffer.popByte());

    // Javascript text
    var js = 'function i_start(s,v) {\n';

    // parenthesis to close
    var parens = 0;

    // command index on the current line
    var command_id = 0;

    // function called at command end
    var finalize = default_finalize;

    while (!this.buffer.exhausted())
    {
      var token = this.buffer.popWord();
      // console.log(token.toString(16));

      // end of line or end of instruction token
      if (token == 0x000 || token == 0x054)
      {
        if (parens > 0 || !empty)
          js += ')'.repeat(parens) + ';\n';
        parens = 0;
        command_id++;

        // jump to next line?
        if (token == 0x000)
        {
          line_length = this.buffer.popByte(); // line length
          indent = ' '.repeat(this.buffer.popByte());
          command_id = 0;
        }

        // finalize previous command
        if (!empty)
        {
          let label = 'i_' + this.buffer.lineNumber() + '_' + command_id;
          js += finalize(label) + '}\nfunction ' + label + '(s,v) {\n';

          // set default finalize
          finalize = default_finalize;
        }

        empty = true;
        continue;
      }

      // comment tokens
      if (token == 0x064a || token == 0x0652)
      {
        this.buffer.popByte();
        let n = this.buffer.popByte();
        js += '//' + this.buffer.popString(n) + '\n';
        continue;
      }

      empty = false;

      // operators
      if (token in operators)
      {
        js += ' ' + operators[token] + ' ';
        continue;
      }

      // intrinsic functions
      if (token in intrinsics)
      {
        js += intrinsics[token];
        continue;
      }

      // function tokens
      if (token in function_tokens)
      {
        js += 'token_' + token.toString(16);
        continue;
      }

      // async token
      if (async_tokens.indexOf(token) >= 0)
      {
        // TODO: push the lext line function into s
        // actually we want the next command; there could be more commands on the same line
        js += 's.push(() => { line_???(s,v)}); '
        js += 'async_' + token.toString(16) + '(s,v,';
        parens++;
        continue;
      }

      // variable reference
      if (token == 0x006)
      {
        let name = this.buffer.popVariableRef();
        js += name;
      }

      // set label
      // 0x000C

      // label reference
      if (token == 0x0012)
      {
        let name = this.buffer.popVariableRef();
        js += '// call proc_' + name + '\n';
      }

      // double quotes string
      if (token == 0x026)
      {
        let len = this.buffer.popWord();
        js += '"' + this.buffer.popString(len) + '"';
        continue;
      }

      // single quotes string
      if (token == 0x002E)
      {
        let len = this.buffer.popWord();
        js += "'" + this.buffer.popString(len) + "'";
        continue;
      }

      // integer literal
      if (token == 0x001E || token == 0x0036 || token == 0x003E)
      {
        let val = this.buffer.popDWord();
        js += val.toString(10);
      }

      // floating point literal
      if (token == 0x0046)
      {
        let bits = this.buffer.popDWord();
        let exponent = bits & 0b1111111;
        let sign = bits & 0b10000000;
        let mantissa = (bits >>> 8)

        if (sign) js += '-';
        js += mantissa * Math.pow(2, exponent - 88);
      }

      // open Procedure
      if (token == 0x0376)
      {
        let offset =  this.buffer.popDWord() + 10;
        let seed1 = this.buffer.popWord();
        let flags = this.buffer.popByte();
        let seed2 = this.buffer.popByte();

        // dump code to jump past the procedure definition
        js += '// jump to line_' + this.buffer.lineNumber(offset) + '\n';

        // fetch procedure name and parameters
        let token2 = this.buffer.popWord();
        if (token2 != 0x006)
          throw "Unknown procedure name token";
        let name = this.buffer.popVariableRef();

        // dump function to call first line of procedure
        // TODO: this wrapper will take arguments that are inserted into v!
        js += 'function proc_' + name + '(s,v) { line_' + (this.buffer.lineNumber() + 1) + '(s,v); }';

        // TODO: parameters
        continue;
      }

      // expression tokens
      if (token <= 0x060)
      {
        continue;
      }

      // handle function call tokens
      js += 'token_' + token.toString(16) + '(';
      parens++;
    }

    return js + 'return;}';
  };

})();
