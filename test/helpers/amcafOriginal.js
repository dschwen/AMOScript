'use strict';
module.exports=function(name,options={}){
 const fs=require('fs'),T=require('../../lib/Transpiler'),m={exports:{}},raw=fs.readFileSync('examples/AMCAF/AMCAF_Examples/'+name+'.AMOS');
 new Function('module',new T(raw,{extensions:{8:'amcaf-1.50beta4'}}).toModule())(m);
 const clock=require('./fakeTimers').createFakeTimers(),files=require('../../lib/amos/files').createMemoryFiles({'data/AMCAF.anim':fs.readFileSync('examples/AMCAF/AMCAF_Examples/Data/AMCAF.Anim','latin1')});
 return{clock,files,p:m.exports({...clock,files,print(){},...options})};
};
