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

  module.exports.run = (data) =>
  {
    // AMOS data buffer
    this.buffer = new Buffer(new Uint8Array(data));
    var line_length = this.buffer.popByte();

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

      // operators
      if (token in operators)
      {
        js += ' ' + operators[token] + ' ';
        continue;
      }

      // end of line token
      if (token == 0x000)
      {

        js += ')'.repeat(parens) + ';\n';
        parens = 0;

        line_length = this.buffer.popByte(); // line length
        indent = ' '.repeat(this.buffer.popByte());
        console.log(line_length, indent);
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

      // double quotes string
      if (token == 0x026)
      {
        let len = this.buffer.popWord();
        js += '"' + this.buffer.popString(len) + '"';
        continue;
      }

      // expression tokens
      if (token <= 0x040)
      {
        continue;
      }

      // comment tokens
      if (token == 0x064a || token == 0x0652)
      {
        this.buffer.popByte();
        let n = this.popByte();
        js += indent + '// ' + this.buffer.popString(n) + '\n';
        continue;
      }

      // handle function call tokens
      js += 'token' + token.toString(16) + '(';
      parens++;
    }

    return js;
  };

})();
