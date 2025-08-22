/* jshint esversion: 6 */

var AMOS = {
  config: {
    setTimeout: (typeof setTimeout !== 'undefined' ? setTimeout : null),
    vblHz: 50,
    sleepScale: 1,
    stepBudget: 1000,
  },
  key_buffer : [],
  mouse_key : 0,
  globals : {},

  // driver program instance
  _program: null,

  init: (cfg = {}) => {
    AMOS.config = Object.assign({}, AMOS.config, cfg);
  },

  load: (cases) => {
    const driver = (typeof window !== 'undefined' && window.AMOS_DRIVER) ? window.AMOS_DRIVER : null;
    if (!driver || !driver.createProgram)
      throw new Error('AMOS driver not available; ensure lib/amos/driver.js is loaded');
    AMOS._program = driver.createProgram(cases, AMOS.config);
    AMOS.state = AMOS._program.state;
  },

  run: (maxSteps) => {
    AMOS.setup();
    if (!AMOS._program) {
      console.warn('No program loaded; nothing to run');
      return;
    }
    AMOS.tick(maxSteps);
  },

  // Compat entrypoint used by system.js delays
  mainLoop : () => {
    AMOS.tick();
  },

  tick: (maxSteps) => {
    if (!AMOS._program) return;
    const budget = (maxSteps == null ? AMOS.config.stepBudget : maxSteps);
    AMOS._program.tick(budget);
  },

  setup : () => {
    // keyboard buffer
    if (typeof document !== 'undefined') {
      document.onkeypress = (e) => {
        AMOS.key_buffer.push(e.key);
      };

      // mouse keys
      document.onmousedown = (e) => {
        AMOS.mouse_key = AMOS.mouse_key | e.which;
      };

      // interrupt 1/50 s
      const vblMs = 1000 / (AMOS.config && AMOS.config.vblHz || 50);
      setInterval(() => {
        // blink cursor, etc
      }, vblMs);
    }
  }
};

// Back-compat alias: expose call_stack as the IP stack
Object.defineProperty(AMOS, 'call_stack', {
  get() { return (AMOS.state && AMOS.state.stack) || []; },
  set(v) { /* ignore external sets; managed by driver */ }
});
