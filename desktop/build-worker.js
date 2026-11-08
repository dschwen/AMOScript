'use strict';
const {parentPort,workerData}=require('worker_threads');
try{parentPort.postMessage({ok:true,result:require('../tools/project').buildProject(workerData.project,{preview:workerData.preview})});}catch(error){parentPort.postMessage({ok:false,error:error.message});}
