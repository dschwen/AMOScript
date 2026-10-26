/* jshint esversion: 6 */
'use strict';

// Complete original source/assets. Only physical input and documented host
// Stop/Resume are injected; no variables, instruction pointers or banks change.
function replayRoller2(create, clock, files, makeInput, capture = () => {}) {
  const check = (value, message) => { if (!value) throw Error(message); };
  const p = create({ files, now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, print() {} });
  const input = makeInput(p), frames = [];
  const record = (name, oracle = null, rows = null) => { frames.push(name); capture(name, p, oracle, rows); };
  try {
    p.tick(1000); clock.tick(1000); record('Original logo', 'terminator-el.png', 256);
    input.key('KeyA'); clock.tick(1840); record('Original title menu', 'roller-title.png', 268);
    input.joy(16); clock.tick(1300); input.joy(0); clock.tick(1000); record('Original level 1 ready');
    input.joy(16); clock.tick(800); input.joy(0);
    let v = p.state.variables;
    check(v.int_lv === 1 && v.int_bx === 5 && v.int_by === 9 && v.int_noi === 5, 'Original first-level start differs');
    record('Original first ball');
    input.joy(8); clock.tick(520); record('Original first colour transition', 'colour-transition.png', 192);
    check(v.int_hi === 10 && v.int_bc === 2, 'Original first colour was not collected');
    clock.tick(6480); input.joy(0);
    check(v.int_lv === 2 && v.int_hi === 248 && v.int_noi === 3, 'Original bonus/level-2 progression differs');
    record('Original level 2 ready');
    input.joy(16); clock.tick(800); input.joy(0);
    check(v.int_bx === 8 && v.int_by === 1 && v.int_tm === 30, 'Original second-level metadata differs');
    record('Original level 2 ball', 'level-2-start.png', 192);
    input.joy(8); clock.tick(20); input.joy(0); clock.tick(1300);
    check(v.int_bx === 9 && v.int_by === 4, 'Original down-arrow wall stop differs'); record('Original down-arrow stop', 'arrow-down.png', 192);
    input.joy(4); clock.tick(20); input.joy(0); clock.tick(1400);
    check(v.int_bx === 5 && v.int_by === 3 && v.int_hi === 248, 'Original up/left arrow stop differs'); record('Original left-arrow stop', 'arrow-left.png', 192);
    const field = p.state.tracker.position.field;
    p.stop(); check(clock.pending() === 0, 'Stop retained a wake'); clock.tick(31000);
    check(p.state.tracker.position.field === field, 'Stopped tracker advanced');
    // AMOS Timer continues while the host is stopped. Resume rebases audio;
    // JOAB observes the elapsed Timer and follows the actual game-over branch.
    p.resume(); clock.tick(2000);
    check(p.state.music.playing && !p.state.tracker.playing && !p.banks.has(22), 'Original game-over music handoff differs');
    check(p.state.location.line >= 994 && p.state.location.line <= 1003, 'Original game-over screen was not reached'); record('Original game over with AMOS Music');
    input.key('KeyA'); let missing = null;
    try { clock.tick(6000); } catch (error) { missing = error.message; }
    check(missing && /Missing Roller II asset:.*iffp\/roller hi.*line 1044/.test(missing), 'Missing original high-score image was not surfaced');
    check(p.state.halted && !p.state.music.playing && !p.banks.has(3) && clock.pending() === 0, 'Missing-asset failure retained music/banks/wakes');
    check(p.display.rainbows.get(0).y === 380, 'Original off-field rainbow was not retained'); record('Missing original high-score image reported');
    check(files.writes.length === 0, 'Bounded full-game replay unexpectedly wrote files');
    return { frames: frames.length, score: v.int_hi, level: v.int_lv, ball: [v.int_bx, v.int_by], musicHandoff: true, timerExpiryAfterHostStop: true, missing, writes: 0 };
  } finally { input.dispose(); p.stop(); check(clock.pending() === 0, 'Full-game cleanup retained a wake'); }
}
module.exports = replayRoller2;
