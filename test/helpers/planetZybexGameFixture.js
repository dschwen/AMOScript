'use strict';
module.exports=function(){
  const fs=require('fs'),path=require('path'),root=path.join(__dirname,'../../examples/PlanetZybex');
  return{progressionSource:require('./planetZybexProgression').toString(),inputs:require('../fixtures/planet-zybex/progression-input.json'),progressionOracle:require('../fixtures/planet-zybex/progression.json'),source:new(require('../../lib/Transpiler'))(fs.readFileSync(path.join(root,'Zybex.AMOS'))).toModule(),
    assets:require('../../tools/build_game_page').loadAssets(path.join(root,'manifest.json')),
    oracle:require('../fixtures/planet-zybex/game.json'),pcm:fs.readFileSync(path.join(__dirname,'../fixtures/planet-zybex/sample4.f32')).toString('base64'),
    replaySource:require('./planetZybexReplay').toString(),clockSource:require('./fakeTimers').createFakeTimers.toString(),
    gpuSources:require('./webglHostSources')(),audioSource:require('../../lib/amos/webAudio').createWebAudioHost.toString()};
};
