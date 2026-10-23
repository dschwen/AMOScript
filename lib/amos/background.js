/* jshint esversion: 6 */
'use strict';

// Browser facade accepts a generated factory or an instruction table.
(function(root) {
  const AMOS = {
    config: {},
    _program: null,
    init(config = {}) { this.config = Object.assign({}, this.config, config); },
    load(source) {
      if (this._program) this._program.stop();
      this._program = typeof source === 'function'
        ? source(this.config)
        : root.AMOS_DRIVER.createProgram(source, this.config);
      this.state = this._program.state;
      return this._program;
    },
    run(maxSteps) {
      if (!this._program) throw new Error('No AMOS program loaded');
      return this._program.tick(maxSteps == null ? (this.config.stepBudget || 1000) : maxSteps);
    },
    tick(maxSteps) { return this.run(maxSteps); },
    stop() { if (this._program) this._program.stop(); },
    resume() { if (this._program) this._program.resume(); },
    sendKey(key) { if (this._program) this._program.sendKey(key); }
  };
  root.AMOS = AMOS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
