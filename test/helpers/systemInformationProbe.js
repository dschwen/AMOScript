'use strict';
module.exports = async function systemInformationProbe(page) {
  const Transpiler = require('../../lib/Transpiler');
  const {binary, token:t, integer:n, word:w, identifier:id} = require('./tokens');
  const fn = (name, args) => [t(name),t('('),args,t(')')];
  const source = new Transpiler(binary([
    [id('version'),t('='),fn('Deek',[fn('Leek',n(4)),t('+'),n(20)])],
    [w(0x4e),[3,0],w(0x0016)],[t('Amos To Front')],
    [w(0x4e),[8,0],w(0x05d6)],[w(0x4e),[8,0],w(0x0956)],[t('Wait Key')]
  ]),{extensions:{8:'amcaf-1.50beta4'}}).toModule();
  return page.evaluate(source => {
    const module = {exports:{}}; new Function('module',source)(module);
    const rows = [], check = (ok,message) => {if(!ok)throw Error(message);};
    for (const version of [34,40]) {
      const calls = [], p = module.exports({setTimeout,clearTimeout,systemInfo:{execVersion:version},system:{command:name=>{calls.push(name);}}});
      try {
        p.tick(100); check(p.state.variables.int_version===version,'Version metadata did not reach the program');
        check(calls.join('|')==='Request Off|Amos To Front|Flush Libs|Audio Lock','Startup command order');
        let rejected=false;try{p.poke(4,0);}catch(error){rejected=/read-only/.test(error.message);}check(rejected,'System memory write accepted');
        rows.push({version,commands:calls,readOnly:rejected});
      } finally {p.stop();}
    }
    const ordinary=module.exports({setTimeout,clearTimeout});let defaultRejected=false;
    try{ordinary.tick(100);}catch(error){defaultRejected=/bounds/.test(error.message);}finally{ordinary.stop();}
    check(defaultRejected,'Default memory unexpectedly exposes system metadata');
    const output=document.createElement('pre');output.textContent='Portable system information (explicit host metadata; no Amiga OS emulation)\n'+JSON.stringify(rows,null,2);document.body.append(output);
    return {versions:rows.map(row=>row.version),readOnly:true,defaultRejected};
  },source);
};
