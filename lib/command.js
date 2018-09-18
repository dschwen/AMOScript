/* jshint esversion: 6 */

// command line wrapper
(() => {
  var fs = require('fs');
  var transpiler = require('./transpiler');

  module.exports.run = () =>
  {
    var in_name = process.argv[2];
    var out_name = process.argv[3];

    // check if files exist
    if (!in_name || !fs.existsSync(in_name)) {
      console.log('Input file', in_name, 'does not exist!');
      return 1;
    }

    if (out_name && fs.existsSync(out_name)) {
      console.log('Refusing to overwrite output file', out_name);
      return 1;
    }

    // load stuff
    in_buffer = fs.readFileSync(in_name);

    // transpile into JS
    let js_text = transpiler.run(in_buffer);

    // write output
    if (out_name)
      fs.writeFileSync(out_name, js_text);
    else
      console.log(js_text);
  };
})();
