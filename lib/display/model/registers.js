/* jshint esversion: 6 */
'use strict';

function createRegisterModel() {
  const R = Object.freeze({ COP1LCH: 0x80, COP1LCL: 0x82, COP2LCH: 0x84, COP2LCL: 0x86,
    COPJMP1: 0x88, COPJMP2: 0x8a, DIWSTRT: 0x8e, DIWSTOP: 0x90,
    DDFSTRT: 0x92, DDFSTOP: 0x94, DMACON: 0x96, BPL1PTH: 0xe0,
    BPLCON0: 0x100, BPLCON1: 0x102, BPLCON2: 0x104, BPL1MOD: 0x108, BPL2MOD: 0x10a,
    SPR0PTH: 0x120, SPR0POS: 0x140, SPR0CTL: 0x142, SPR0DATA: 0x144, SPR0DATB: 0x146,
    COLOR00: 0x180, NOOP: 0x1fe });
  function fetchBytes(control, start, stop) {
    const step = control & 0x8000 ? 4 : 8;
    start = dataFetchPosition(control, start); stop = dataFetchPosition(control, stop);
    if (start < 0x18 || stop < start || stop + 8 > 226 || (stop - start) % step) throw new Error('Unsupported OCS data-fetch window');
    return ((stop - start) / step + (control & 0x8000 ? 2 : 1)) * 2;
  }
  function dataFetchPosition(control, value) { return value & (control & 0x8000 ? 0xfc : 0xf8); }
  function fetchOffset(control, start) {
    return ((control & 0x8000 ? 0x3c : 0x38) - dataFetchPosition(control, start)) * (control & 0x8000 ? 4 : 2);
  }
  return { R, fetchBytes, dataFetchPosition, fetchOffset };
}

module.exports = Object.assign({ createRegisterModel }, createRegisterModel());
