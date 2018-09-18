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

  var async_tokens = [0x0cca, 0x1290, 0x129e];

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

    // parenthesis to close
    var parens = 0;

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

        // jump to next line?
        if (token == 0x000)
        {
          line_length = this.buffer.popByte(); // line length
          indent = ' '.repeat(this.buffer.popByte());
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

      // async token
      if (async_tokens.indexOf(token) >= 0)
      {
        // TODO: push the lext line function into s
        js += 's.push(() => { i???(s,v)}); '
        js += 'async_' + token.toString(16) + '(s,v,';
        parens++;
        continue;
      }

      // variable reference
      if (token == 0x006)
      {
        this.buffer.popWord(); // unknown
        let len = this.buffer.popByte();
        let flags = this.buffer.popByte();
        let name = this.buffer.popString(len);

        if (flags & 1) name = 'float_' + name;
        else if (flags & 2) name = 'string_' + name;
        else name = 'int_' + name;

        js += name;
      }

      // set label
      // 0x000C

      // label reference
      if (token == 0x0012)
      {
        throw "labels not supported"
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

      // expression tokens
      if (token <= 0x060)
      {
        continue;
      }

      // handle function call tokens
      js += 'token_' + token.toString(16) + '(';
      parens++;
    }

    return js;
  };

})();
