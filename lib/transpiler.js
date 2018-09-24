/* jshint esversion: 6 */

// transpiler
(() => {
  var Buffer = require('./buffer');

  var operators = {
    0x005C : ",",
    0x0064 : ",", // ;
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
    var js = '';
    var js_line = '';

    // line number
    var line_number = 0;

    // command index
    var op_id = 0;

    // index of the first op for each line
    var line_op = ['op_0'];

    // label table
    var label_table = {};

    // how to close the current function
    const TT_CALL_AMOS = 0, TT_ASYNC = 1, TT_COMMENT = 2, TT_ASSIGN = 3,
          TT_NONE = 4, TT_CALL_PROC = 5;
    var token_type = null;

    while (!this.buffer.exhausted())
    {
      var token = this.buffer.popWord();
      // console.log(token.toString(16));

      // end of line or end of instruction token
      if (token == 0x000 || token == 0x054)
      {
        switch (token_type) {
          case TT_CALL_AMOS:
            js_line += '); return op_' + (op_id + 1) + ';';
            break;

          case TT_CALL_PROC:
            js_line += ');';
            break;

          case TT_ASYNC:
            js_line += ');  AMOS.call_stack.push(op_' + (op_id + 1) + '); return true;';
            break;

          case TT_COMMENT:
          case null:
            js_line += ' return op_' + (op_id + 1) + ';';
            break;

          case TT_ASSIGN:
            js_line += '; return op_' + (op_id + 1) + ';';
            break;

          case TT_NONE:
            break;

          default:
            throw "Unknown token type";
        }

        js += 'function op_' + op_id + '() { ' + js_line + ' }\n';
        js_line = '';
        op_id++;
        token_type = null;

        // jump to next line?
        if (token == 0x000)
        {
          line_length = this.buffer.popByte(); // line length
          indent = this.buffer.popByte();
          line_number++;
          line_op.push('op_' + op_id);
        }

        // end of code?
        if (this.buffer.exhausted())
        {
          js += 'function op_' + op_id + '() { AMOS.call_stack = []; return; /*END*/ }\n';
          break;
        }

        continue;
      }

      // comment tokens
      if (token == 0x064a || token == 0x0652)
      {
        this.buffer.popByte();
        let n = this.buffer.popByte();
        js_line += '/*' + this.buffer.popString(n) + '*/';

        if (token_type === null)
          token_type = TT_COMMENT;
        else
          throw "Comment token needs to be the first token on a command";

        continue;
      }

      empty = false;

      // operators
      if (token in operators)
      {
        js_line += ' ' + operators[token] + ' ';
        continue;
      }

      // intrinsic functions
      if (token in intrinsics)
      {
        js_line += intrinsics[token];
        continue;
      }

      // function tokens
      if (token in function_tokens)
      {
        js_line += 'token_' + token.toString(16);
        continue;
      }

      // async token
      if (async_tokens.indexOf(token) >= 0)
      {
        // TODO: push the lext line function into s
        // actually we want the next command; there could be more commands on the same line
        js_line += 'async_' + token.toString(16) + '(';

        if (token_type === null)
          token_type = TT_ASYNC;

        continue;
      }

      // variable reference
      if (token == 0x006)
      {
        let name = this.buffer.popVariableRef();
        js_line += name;

        if (token_type === null)
          token_type = TT_ASSIGN;

        continue;
      }

      // set label
      // 0x000C

      // label reference
      if (token == 0x0012)
      {
        let name = this.buffer.popVariableRef();
        js_line += 'AMOS.call_stack.push(op_' + (op_id + 1) + '); ' +
                   'return proc_' + name + '(';

        if (token_type === null)
          token_type = TT_CALL_PROC;
        continue;
      }

      // double quotes string
      if (token == 0x026)
      {
        let len = this.buffer.popWord();
        js_line += '"' + this.buffer.popString(len) + '"';
        continue;
      }

      // single quotes string
      if (token == 0x002E)
      {
        let len = this.buffer.popWord();
        js_line += "'" + this.buffer.popString(len) + "'";
        continue;
      }

      // integer literal
      if (token == 0x001E || token == 0x0036 || token == 0x003E)
      {
        let val = this.buffer.popDWord();
        js_line += val.toString(10);
        continue;
      }

      // floating point literal
      if (token == 0x0046)
      {
        let bits = this.buffer.popDWord();
        let exponent = bits & 0b1111111;
        let sign = bits & 0b10000000;
        let mantissa = (bits >>> 8)

        if (sign) js_line += '-';
        js_line += mantissa * Math.pow(2, exponent - 88);
        continue;
      }

      // do
      if (token == 0x27e)
      {
        let offset = this.buffer.popWord();
        let num = this.buffer.lineNumber(offset)
        console.log(num);
        continue;
      }

      // Exit (break)
      if (token == 0x029e)
      {
        let offset = this.buffer.popWord();
        let num = this.buffer.lineNumber(offset)
        let byte2 = this.buffer.popWord();
        js_line += 'return line_op[' + num + '];';
        if (token_type === null)
          token_type = TT_NONE;

        let token2 = this.buffer.getWord();
        if (token2 == 0x0000 || token2 == 0x054)
          continue;

        // consume the levels token if provided
        if (this.buffer.popWord() != 0x03e)
          throw "Integer value expected " + token2;
        this.buffer.popDWord();

        continue;
      }

      // open Procedure
      if (token == 0x0376)
      {
        let offset =  this.buffer.popDWord() + 6;
        let seed1 = this.buffer.popWord();
        let flags = this.buffer.popByte();
        let seed2 = this.buffer.popByte();

        // dump code to jump past the procedure definition
        js_line += 'return line_op[' + this.buffer.lineNumber(offset) + '];';

        // fetch procedure name and parameters
        let token2 = this.buffer.popWord();
        if (token2 != 0x006)
          throw "Unknown procedure name token";
        let name = this.buffer.popVariableRef();

        // TODO: this wrapper will take arguments that are inserted into v!
        js += 'function proc_' + name + '() { return op_' + (op_id + 1) + '; }\n';

        if (token_type === null)
          token_type = TT_NONE;
        else
          throw "Procedure definition token must be the first token on a command";

        // TODO: parameters
        continue;
      }

      // end proc
      if (token == 0x0390)
      {
        js_line += 'return;'
        if (token_type === null)
          token_type = TT_NONE;
        continue;
      }

      // inc
      if (token == 0x0444 || token == 0x044e)
      {
        let token2 = this.buffer.popWord();
        if (token2 != 0x006)
          throw "Inc/dec must be followed by a vraiable name";
        let name = this.buffer.popVariableRef();

        if (token == 0x0444)
          js_line += name + '++';
        else if (token == 0x044e)
          js_line += name + '--';

        if (token_type === null)
          token_type = TT_ASSIGN;
        continue;
      }

      // expression tokens
      if (token <= 0x060)
      {
        js_line += '/* token_' +  token.toString(16) + ' */';
        continue;
      }

      // handle function call tokens
      js_line += 'token_' + token.toString(16) + '(';

      if (token_type === null)
        token_type = TT_CALL_AMOS;
      else
        throw "AMOS call token must be the first token on the command";
    }

    js += '// jump table\nline_op = [ ' + line_op.join(', ') + ' ];\n';

    return js;
  };

})();
