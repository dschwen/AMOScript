'use strict';
// Build-time only. Preserve public properties, script globals and license notices.
module.exports=function minifyJavaScript(source){
 return require('terser').minify_sync(source,{
  ecma:2020,compress:{passes:2},mangle:{properties:false},
  format:{comments:'some',inline_script:true}
 }).code;
};
