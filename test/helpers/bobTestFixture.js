'use strict';
module.exports = function bobTestFixture() {
  const fs = require('fs'), path = require('path'), Transpiler = require('../../lib/Transpiler');
  return {
    sources: { 'BobTest.amos': new Transpiler(fs.readFileSync(path.join(__dirname, '../../examples/BobTest/BobTest.amos'))).toModule() },
    sourceNames: ['BobTest.amos'], assets: {}, programOptions: { maxBobs: 65 }, playLabel: 'Play Demo', subject: 'demo',
    finishHint: 'Press a key in the canvas to start 64 bouncing Bobs. After 500 frames, press another key to finish. This unpaced source is not a native speed benchmark.',
    images: require('../fixtures/bob-test/images.json').images, positions: require('../fixtures/bob-test/images.json').positions,
    checkFrameSource: require('./checkBobTestFrame').toString(),
    clockSource: require('./fakeTimers').createFakeTimers.toString(), gpuSources: require('./webglHostSources')()
  };
};
