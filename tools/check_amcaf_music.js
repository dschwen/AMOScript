#!/usr/bin/env node
'use strict';

// Read-only external benchmark. Never copies private modules into the repository.
const fs = require('fs');
const crypto = require('crypto');
const readMod = require('../lib/amos/mod');
const create = require('../lib/amos/amcafSequencer');
const pitch = require('../lib/amos/amcafPitch');
function inspect(bytes, maxTicks = 1000000) {
  if (!Number.isSafeInteger(maxTicks) || maxTicks < 1 || maxTicks > 1000000) throw new Error('Tick limit must be 1..1000000');
  const player = create(readMod(bytes), pitch), hash = crypto.createHash('sha256');
  let triggers = 0, repeatChanges = 0;
  const previous = [0,0,0,0];
  while (!player.state.ends && player.state.ticks < maxTicks) {
    const frame = player.tick();
    hash.update(JSON.stringify(frame) + '\n');
    triggers += frame.triggers.length;
    for (const repeat of frame.repeats) {
      if (repeat.sample !== previous[repeat.voice]) {
        if (!frame.triggers.some(t => t.voice === repeat.voice)) repeatChanges++;
        previous[repeat.voice] = repeat.sample;
      }
    }
  }
  if (!player.state.ends) throw new Error(`AMCAF trace exceeded ${maxTicks} ticks before an end signal`);
  return { evidence: 'JavaScript sequencer trace; no audio playback or native capture',
    moduleSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    ticks: player.state.ticks, triggers, instrumentOnlyRepeatChanges: repeatChanges,
    nextOrder: player.state.order, nextRow: player.state.row,
    traceSha256: hash.digest('hex') };
}
if (require.main === module) {
  try {
    const files = process.argv.slice(2);
    if (!files.length) throw new Error('Usage: node tools/check_amcaf_music.js <external.mod> [external.mod ...]');
    for (const file of files) console.log(JSON.stringify({ file, ...inspect(fs.readFileSync(file)) }, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = inspect;
