/* jshint esversion: 6 */

// Print
function token_476()
{
  // var args
  console.log.apply(null, arguments);
}

// Clear Key
function token_1280()
{
  AMOS.key_buffer = [];
}

// Inkey$
function token_f2()
{
  return AMOS.key_buffer.pop() || '';
}

// Wait Vbl
function async_cca(s, v, time)
{
  // pop the closure with the next command state
  var ret = s.pop();
  window.requestAnimationFrame(ret);
}

// Wait [time in 1s/100]
function async_129e(s, v, time)
{
  // pop the closure with the next command state
  var ret = s.pop();
  setTimeout(ret, time / 10.0);
}

// Wait Key
function async_1290(s, v, time)
{
  // pop the closure with the next command state
  var ret = s.pop();
  document.addEventListener("keydown", function _listener() {
    document.removeEventListener("keydown", _listener, true);
    ret();
  }, true);
}
