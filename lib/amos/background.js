/* jshint esversion: 6 */

// keyboard buffer
var key_buffer = [];
document.onkeypress = (e) => {
  key_buffer.push(e.key);
}

// mouse keys
var mouse_key = 0;
document.onmousedown = (e) => {
  mouse_key = mouse_key | e.which;
}

// run
var curLine;
var ticks = 0;
var preempt = false;
function run(line) {
    curLine = line;
    mainLoop();
}
function mainLoop() {
  while (true)
  {
    if (curLine == null) {
        return;
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
