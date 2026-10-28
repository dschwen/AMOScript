'use strict';
module.exports = function screenSlideFixture() {
  const fs = require('fs'), path = require('path'), Transpiler = require('../../lib/Transpiler');
  const root = path.join(__dirname, '../../examples/Introideen');
  return {
    sources: Object.fromEntries(['RolIntrIdee2.amos', 'RolIntrIdee2.Bak'].map(name => [name, new Transpiler(fs.readFileSync(path.join(root, name))).toModule()])),
    assets: Object.fromEntries(['rolIntr', 'RolIntrSam.abk'].map(name => [`df1:${name.toLowerCase()}`, fs.readFileSync(path.join(root, name)).toString('base64')])),
    sourceNames: ['RolIntrIdee2.amos', 'RolIntrIdee2.Bak'], finishHint: 'Press a key in the animation to finish after the picture is revealed.',
    oracle: require('../fixtures/screen-slide.json'), clockSource: require('./fakeTimers').createFakeTimers.toString(), gpuSources: require('./webglHostSources')(),
    audioSource: require('../../lib/amos/webAudio').createWebAudioHost.toString(), sessionSource: require('../../lib/amos/browserAudio').createBrowserAudioSession.toString()
  };
};
