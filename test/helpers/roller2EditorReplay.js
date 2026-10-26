/* jshint esversion: 6 */
'use strict';
// Whole current AMOS program, original menu/editor path; physical input only.
function replayRoller2Editor(create, clock, files, makeInput, capture = () => {}) {
  const check = (value, message) => { if (!value) throw Error(message); };
  const p = create({ files, now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, print() {} });
  const input = makeInput(p); let frames = 0;
  const record = name => { capture(name, p); frames++; };
  try {
    p.tick(1000); clock.tick(1000); input.key(); clock.tick(1840);
    input.mouse(410, 182, 1); clock.tick(20); input.mouse(410, 182, 0);
    clock.tick(600); record('Editor opening fade');
    clock.tick(3400);
    const v = p.state.variables;
    check(p.state.location.line >= 341 && p.state.location.line <= 376 && !p.state.halted, 'Original editor did not reach its input loop');
    check(p.display.screens.size === 2 && p.display.screen(1).hardwareY === 240, 'Original overlapping editor windows differ');
    record('Original editor with overlapping panel');
    input.mouse(160, 74, 1); clock.tick(120); input.mouse(160, 74, 0); clock.tick(120);
    check(p.banks.get(10).data[42] === 3 && p.banks.get(10).data[282] === 1, 'Original editor did not place its selected tile');
    record('Original editor tile placed');
    input.mouse(140, 250, 0); clock.tick(120);
    check(v.int_sn === 1 && p.display.current === 1, 'Original editor did not select its foreground panel');
    record('Original foreground panel pointer');
    check(!p.state.halted && files.writes.length === 0, 'Editor entry halted or wrote a file');
    return { frames, placedTile: 3, selectedScreen: 1, writes: 0 };
  } finally { input.dispose(); p.stop(); check(clock.pending() === 0, 'Editor cleanup retained a wake'); }
}
module.exports = replayRoller2Editor;
