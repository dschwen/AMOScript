'use strict';
// Observe every host-clock advance, not just the progression checkpoints.
// Original source, assets and frozen joystick route; no VM or palette edits.
function replayPlanetZybexLightning(progression, create, clock, files, makeInput, inputs, capture = () => {}, standard = 'PAL', sleepScale = 1) {
  let program, previous = 0;
  const flashes = [];
  const observedClock = { ...clock, tick(ms) {
    clock.tick(ms);
    if (!program || !program.display.screens.has(2) || !program.display.screens.has(5)) return;
    const colour = program.display.screen(2).palette[0];
    if (colour === previous) return;
    previous = colour;
    const level = program.state.variables.int_level;
    if (level !== 1 && level !== 2) return;
    const meta = { level, colour, time: clock.now(), line: program.state.location.line, offset: program.state.location.offset };
    flashes.push(meta);
    capture(`Level ${level} lightning ${flashes.filter(f => f.level === level).length}`, program, meta);
  } };
  const result = progression(options => (program = create({ ...options, sleepScale })), observedClock, files, makeInput, inputs, () => {}, null, standard);
  if (!flashes.some(f => f.level === 1 && f.colour > 0) || !flashes.some(f => f.level === 2 && f.colour > 0)) throw Error('Lightning replay missed a level');
  return { flashes, progression: result };
}
module.exports = replayPlanetZybexLightning;
