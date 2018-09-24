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

// Global
function token_3aa()
{
}

// Wait Vbl
function async_cca()
{
  window.requestAnimationFrame(AMOS.mainLoop);
}

// Wait [time in 1s/50]
function async_129e(time)
{
  setTimeout(AMOS.mainLoop, time * 20.0);
}

// Wait Key
function async_1290()
{
  document.addEventListener("keydown", function _listener() {
    document.removeEventListener("keydown", _listener, true);
    AMOS.mainLoop();
  }, true);
}
