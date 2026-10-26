/* jshint esversion: 6 */
'use strict';
// Complete current supplied source/assets. Input and host lifecycle only.
function replayRoller2Current(create, clock, files, makeInput, capture = () => {}) {
  const check = (value, message) => { if (!value) throw Error(message); };
  const p = create({ files, now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, print() {} });
  const input = makeInput(p), frames = [];
  const record = (name, oracle = null, rows = null) => { frames.push(name); capture(name, p, oracle, rows); };
  try {
    p.tick(1000); clock.tick(1000); record('Original logo', 'terminator-el.png', 256);
    input.key('KeyA'); clock.tick(1840); record('Current original title', 'current-roller-title.png', 268);
    input.joy(16); clock.tick(1300); input.joy(0); clock.tick(1000); record('Current level 1 ready');
    input.joy(16); clock.tick(800); input.joy(0); const v = p.state.variables;
    check(v.int_lv === 1 && v.int_bx === 5 && v.int_by === 9 && v.int_noi === 6, 'Current first-level start differs'); record('Current first ball');
    input.joy(8); clock.tick(520); check(v.int_hi === 10 && v.int_bc === 2, 'Current first colour differs'); record('Current first colour transition');
    clock.tick(6480); input.joy(0);
    check(v.int_lv === 3 && v.int_hi === 278 && v.int_noi === 5, 'Current original warp/level-3 path differs'); record('Original warp into level 3');
    input.joy(16); clock.tick(800); input.joy(0); record('Current level 3 ball');
    const completed = { score: v.int_hi, level: v.int_lv }, field = p.state.tracker.position.field;
    p.stop(); check(clock.pending() === 0, 'Current Stop retained a wake'); clock.tick(v.int_tm * 1000 + 1000);
    check(p.state.tracker.position.field === field, 'Stopped current tracker advanced');
    p.resume(); clock.tick(2000);
    check(p.state.music.playing && !p.state.tracker.playing && !p.banks.has(22), 'Current game-over handoff differs'); record('Original game over with AMOS Music');
    input.key('KeyA'); clock.tick(6000);
    check(!p.state.halted && !p.state.music.playing && !p.banks.has(3), 'Restored score image did not allow Music exit');
    check(p.state.location.line >= 1094 && p.state.location.line <= 1103, 'Current post-game scores scroll differs'); record('Original post-game scores');
    clock.tick(10000);
    check(p.state.location.line >= 298 && p.state.location.line <= 316 && p.state.tracker.playing && p.banks.has(22), 'Current scores did not return to menu/music'); record('Original menu after game over', 'current-roller-title.png', 268);
    input.joy(16); clock.tick(2300); input.joy(0); record('Fresh first-level ready');
    input.joy(16); clock.tick(800); input.joy(0);
    check(v.int_lv === 1 && v.int_hi === 0 && v.int_bx === 5 && v.int_by === 9, 'Current menu did not start a fresh game'); record('Fresh original game');
    check(files.writes.length === 0 && !p.state.halted, 'Current bounded path wrote files or halted');
    return { frames: frames.length, ...completed, returnedToMenu: true, freshGame: true, writes: 0 };
  } finally { input.dispose(); p.stop(); check(clock.pending() === 0, 'Current full-game cleanup retained a wake'); }
}
module.exports = replayRoller2Current;
