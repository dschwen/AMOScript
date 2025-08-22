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

// Wait Vbl (uses requestAnimationFrame if available, falls back to setTimeout)
function async_cca()
{
  if (typeof window !== 'undefined' && window.requestAnimationFrame) {
    window.requestAnimationFrame(AMOS.mainLoop);
  } else if (AMOS.config && AMOS.config.setTimeout) {
    const period = 1000 / (AMOS.config.vblHz || 50);
    AMOS.config.setTimeout(AMOS.mainLoop, period * (AMOS.config.sleepScale || 1));
  }
}

// Wait [time in 1s/50]
function async_129e(time)
{
  const st = (AMOS.config && AMOS.config.setTimeout) || (typeof setTimeout !== 'undefined' ? setTimeout : null);
  if (!st) return;
  const vblMs = 1000 / ((AMOS.config && AMOS.config.vblHz) || 50);
  const scale = (AMOS.config && AMOS.config.sleepScale) || 1;
  st(AMOS.mainLoop, time * vblMs * scale);
}

// Wait Key
function async_1290()
{
  document.addEventListener("keydown", function _listener() {
    document.removeEventListener("keydown", _listener, true);
    AMOS.mainLoop();
  }, true);
}
