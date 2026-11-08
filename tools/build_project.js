'use strict';
const {loadProject,buildProject,exportHTML}=require('./project');
function main(args){if(args.length!==2)throw Error('Usage: node tools/build_project.js project.amos-project.json output.html');const result=buildProject(loadProject(args[0]));exportHTML(args[1],result.html);console.log('Exported '+args[1]+' ('+result.stats.files+' asset files, '+result.stats.bytes+' bytes)');}
if(require.main===module)try{main(process.argv.slice(2));}catch(error){console.error(error.code==='EEXIST'?'Output already exists; choose a new HTML filename.':error.message);process.exitCode=1;}
module.exports={main};
