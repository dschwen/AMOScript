/* jshint esversion: 6 */

// keyboard buffer
var AMOS_key_buffer = [];
document.onkeypress = (e) => {
  AMOS_key_buffer.push(e.key);
};

// mouse keys
var AMOS_mouse_key = 0;
document.onmousedown = (e) => {
  AMOS_mouse_key = mouse_key | e.which;
};

// interrupt 1/50 s
setInterval(() => {
  // blink cursor, etc
}, 20);

// run
var AMOS_curLine;
var AMOS_ticks = 0;
var AMOS_preempt = false;
var AMOS_callStack = [];
function run() {
    AMOS_curLine = i_start;
    mainLoop();
}
function mainLoop() {
  while (true)
  {
    if (AMOS_curLine == null) {
      if (AMOS_callStack.length == 0)
        return;
      AMOS_curLine = AMOS_callStack.pop();
    }
    AMOS_curLine = AMOS_curLine();
    AMOS_ticks++;
    if (AMOS_preempt || AMOS_ticks % 100 == 0)
    {
      setTimeout(mainLoop, 0);
      return;
    }
  }
}
