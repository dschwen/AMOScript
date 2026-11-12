'use strict';
module.exports=function runtimeMode(mode){
 if(!['shared','full','minimal'].includes(mode))throw Error('Runtime must be shared, full or minimal');
 if(mode==='minimal')throw Error('Minimal bundled runtime is planned and not implemented yet. Choose shared or full.');
 return mode;
};
