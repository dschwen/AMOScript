/* jshint esversion: 6 */
'use strict';
module.exports=function webglHostSources(){
  return {
    model:require('../../lib/display/model/frameState').createFrameStateModel.toString(),
    sprites:require('../../lib/display/reference/sprites').createSpriteModel.toString(),
    resources:require('../../lib/display/webgl/resources').createResourceFactory.toString(),
    renderer:require('../../lib/display/webgl/renderer').createRendererFactory.toString(),
    shaders:require('../../lib/display/webgl/shaders').toString(),
    layout:require('../../lib/display/presentation/layout').toString()
  };
};
