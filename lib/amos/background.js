/* jshint esversion: 6 */

// keyboard buffer
var key_buffer = [];
document.onkeypress = (e) => {
  key_buffer.push(e.key);
};

// mouse keys
var mouse_key = 0;
document.onmousedown = (e) => {
  mouse_key = mouse_key | e.which;
};

// interrupt 1/50 s
setInterval(interrupt, 20);
function interrupt()
{
  // blink cursor, etc
}

// run
var curLine;
var ticks = 0;
var preempt = false;
var callStack = [];
function run() {
    curLine = i_start;
    mainLoop();
}
function mainLoop() {
  while (true)
  {
    if (curLine == null) {
      if (callStack.length == 0)
        return;
      curLine = callStack.pop();
    }
    curLine = curLine();
    ticks++;
    if (preempt || ticks > 100)
    {
      setTimeout(mainLoop, 0);
      return;
    }
  }
}
