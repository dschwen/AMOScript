/* jshint esversion: 6 */
'use strict';
// Complete current source, ordinary input only. No variable/IP/bank edits.
function replayRoller2Help(create, clock, files, makeInput, capture = () => {}) {
  const check = (value, message) => { if (!value) throw Error(message); };
  const p = create({ files, now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, print() {} });
  const input = makeInput(p); let frames = 0;
  const record = name => { capture(name, p); frames++; };
  function wait(predicate, fields = 500) {
    for (let i = 0; i < fields && !predicate(); i++) clock.tick(20);
    check(predicate(), `Help replay did not reach its expected prompt at line ${p.state.location.line}`);
  }
  try {
    p.tick(1000); clock.tick(1000); input.key('KeyA'); clock.tick(1840);
    input.key('Help');
    for (let page = 0; page < 7; page++) {
      wait(() => p.state.location.line === 164 && p.state.variables.int_s === page);
      check(p.display.screen().width === 320 && p.display.screen().height === 200, 'Help screen geometry differs');
      check(p.state.variables.int_j === (page < 6 ? 9 : 53), 'Help page did not finish its entries');
      record(page < 6 ? `Help icons ${page * 8 + 1}–${page * 8 + 8}` : 'Help icons 49–52');
      input.key('KeyA'); clock.tick(20);
    }
    // Original timed colour/ball examples, then the final acknowledgement.
    wait(() => p.state.location.line === 164, 5000); record('Final help acknowledgement');
    input.key('KeyA'); clock.tick(20);
    wait(() => p.state.location.line >= 298 && p.state.location.line <= 316, 500);
    check(!p.state.halted && p.state.tracker.playing && p.state.frames.length === 0 && p.state.stack.length === 0, 'Help did not return to the original menu/music');
    check(files.writes.length === 0, 'Help wrote a file'); record('Menu after help');
    return { pages: 7, finalEntries: [49, 50, 51, 52], frames, returnedToMenu: true, writes: 0 };
  } finally { input.dispose(); p.stop(); check(clock.pending() === 0, 'Help cleanup retained a wake'); }
}
module.exports = replayRoller2Help;
