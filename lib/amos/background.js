/* jshint esversion: 6 */

var AMOS = {
  key_buffer : [],
  mouse_key : 0,

  globals : {},

  cur_line: undefined,
  ticks : 0,
  preempt : false,
  call_stack : [],

  run: () => {
    AMOS.setup();
    AMOS.cur_line = op_0;
    AMOS.mainLoop();
  },

  mainLoop : () => {
    while (true)
    {
      // async call in progress
      if (AMOS.cur_line === true) {
        AMOS.cur_line = AMOS.call_stack.pop();
        return;
      }

      // return or end
      if (AMOS.cur_line === undefined) {
        if (AMOS.call_stack.length == 0)
          return;
        AMOS.cur_line = AMOS.call_stack.pop();
      }

      AMOS.cur_line = AMOS.cur_line();
      AMOS.ticks++;
      if (AMOS.preempt || AMOS.ticks % 100 == 0)
      {
        setTimeout(AMOS.mainLoop, 0);
        return;
      }
    }
  },

  setup : () => {
    // keyboard buffer
    document.onkeypress = (e) => {
      AMOS.key_buffer.push(e.key);
    };

    // mouse keys
    document.onmousedown = (e) => {
      AMOS.mouse_key = AMOS.mouse_key | e.which;
    };

    // interrupt 1/50 s
    setInterval(() => {
      // blink cursor, etc
    }, 20);
  }
};
