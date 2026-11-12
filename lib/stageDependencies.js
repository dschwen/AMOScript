'use strict';
const fs=require('fs'),path=require('path');
// Copy only the declared production dependency closure, including its notices.
// Current releases use one installed version of each dependency.
module.exports=function stageDependencies(root,destination){
 const copied=new Map();
 function copy(name,from){
  const filename=require.resolve(name+'/package.json',{paths:[from]}),directory=path.dirname(filename),pkg=JSON.parse(fs.readFileSync(filename));
  if(copied.has(name)){if(copied.get(name)!==directory)throw Error('Conflicting staged dependency: '+name);return;}
  copied.set(name,directory);const target=path.join(destination,'node_modules',name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.cpSync(directory,target,{recursive:true});
  for(const dependency of Object.keys(pkg.dependencies||{}))copy(dependency,directory);
 }
 for(const name of Object.keys(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).dependencies||{}))copy(name,root);
};
