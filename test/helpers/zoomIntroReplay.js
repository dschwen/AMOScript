/* jshint esversion: 6 */
'use strict';

module.exports = function zoomIntroReplay(create, clock, asset, capture = () => {}) {
  const reads = [];
  const p = create({ now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    files: { read(name) { reads.push(name); if (name !== 'df1:r.abk') throw Error(`Unexpected intro asset ${name}`); return asset; },
      write() { throw Error('Intro must not write files'); } } });
  p.tick(100000);
  for (let frame = 1; frame <= 29; frame++) {
    if (p.state.waiting !== 'sleep') throw Error(`Intro frame ${frame} did not wait for VBL`);
    capture(frame, p);
    clock.tick(20);
  }
  if (p.state.waiting !== 'key' || p.state.location.line !== 49) throw Error('Intro did not reach original final prompt');
  return { p, reads };
};
