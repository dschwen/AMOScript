/* jshint esversion: 6 */
'use strict';
module.exports = async function optimizerProbe(page) {
  const Transpiler = require('../../lib/Transpiler'), bytes = require('./optimizerProgram')();
  return page.evaluate(({ sources }) => {
    const runs = sources.map(source => {
      const module = { exports: {} }; new Function('module', source)(module);
      return module.exports({ setTimeout() {}, clearTimeout() {}, now: () => 0 });
    });
    const snapshots = p => JSON.stringify({ ip: p.state.ip, ticks: p.state.ticks, location: p.state.location, variables: p.state.variables });
    const budgets = [1, 2, 3, 17, 31, 1000, 7, 2, 4096];
    try {
      for (const budget of budgets) {
        const results = runs.map(p => JSON.stringify(p.tick(budget)));
        if (results[0] !== results[1] || snapshots(runs[0]) !== snapshots(runs[1])) throw Error(`Optimized execution differs at budget ${budget}`);
      }
      return { comparisons: budgets.length, originalTicks: runs[1].state.ticks,
        blocksExecuted: runs[1].optimization.blocksExecuted, instructionsBatched: runs[1].optimization.instructionsBatched };
    } finally { runs.forEach(p => p.stop()); }
  }, { sources: [false, true].map(optimize => new Transpiler(bytes).toModule({ optimize })) });
};
