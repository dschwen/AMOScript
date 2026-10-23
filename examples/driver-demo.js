'use strict';

(function(){

  function makeCases(logFn) {
    const cases = [];
    cases[0] = (s) => { logFn('start'); return { call: 2 }; };
    cases[1] = (s) => { logFn('after call'); return { halt: true }; };
    cases[2] = (s) => { logFn('proc enter'); return { yield: true }; };
    cases[3] = (s) => { logFn('proc work'); return { sleepVbl: 1 }; };
    cases[4] = (s) => { logFn('proc return'); return { ret: true }; };
    return cases;
  }

  function driverDemoRun() {
    const log = (msg) => console.log('[demo]', msg);
    const cases = makeCases(log);
    if (typeof window !== 'undefined' && window.AMOS) {
      window.AMOS.init({ vblHz: 50, sleepScale: 1 });
      window.AMOS.load(cases);
      window.AMOS.run(100);
    } else {
      const { createProgram } = require('../lib/amos/driver');
      const prog = createProgram(cases, { setTimeout: require('timers').setTimeout });
      prog.tick(100);
    }
  }

  if (typeof window !== 'undefined') {
    window.driverDemoRun = driverDemoRun;
    // expose for browser
  } else {
    module.exports = { driverDemoRun };
  }
})();
