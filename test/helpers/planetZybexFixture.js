'use strict';
module.exports = function planetZybexFixture() {
  const fs = require('fs'), path = require('path'), Transpiler = require('../../lib/Transpiler');
  const root = path.join(__dirname, '../../examples/PlanetZybex'), oracle = require('../fixtures/packed-picture.json');
  return { channelsSource: new Transpiler(require('./planetZybexChannels')()).toModule(), channelsOracle: require('../fixtures/planet-zybex/channels.json'), gameOverSource: new Transpiler(require('./planetZybexGameOver')()).toModule(), gameOverOracle: require('../fixtures/planet-zybex/game-over.json'), spriteBufferSource: new Transpiler(require('./spriteBufferProgram')()).toModule(), spriteBufferOracle: require('../fixtures/sprite-buffer.json'), defaultSource: new Transpiler(require('./planetZybexDefault')()).toModule(), defaultOracle: require('../fixtures/defaults.json'), scoreSource: new Transpiler(require('./planetZybexScore')()).toModule(), scoreOracle: require('../fixtures/planet-zybex/score.json'), clockSource: require('./fakeTimers').createFakeTimers.toString(), registerSource: new Transpiler(require('./planetZybexRegisters')()).toModule(), sources: oracle.levels.map(level => new Transpiler(require('./planetZybexLevel')(level.level)).toModule()),
    assets: Object.fromEntries(oracle.levels.map(level => [level.file, fs.readFileSync(path.join(root, level.file)).toString('base64')])),
    oracle, gpuSources: require('./webglHostSources')() };
};
