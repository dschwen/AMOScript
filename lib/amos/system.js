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
function async_cca(ret, v, time)
{
  AMOS.call_stack.push(ret);
  window.requestAnimationFrame(AMOS.mainLoop);
  return true;
}

// Wait [time in 1s/50]
function async_129e(ret, v, time)
{
  AMOS.call_stack.push(ret);
  setTimeout(AMOS.mainLoop, time / 20.0);
  return true;
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
