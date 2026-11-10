'use strict';
module.exports=async function(page){
 const T=require('../../lib/Transpiler'),{binary,token:t,integer:n,identifier:id,text,word:w}=require('./tokens');
 const lines=[[t('Screen Open'),n(0),t(','),n(320),t(','),n(200),t(','),n(4),t(','),t('Lowres')],[t('Curs Off')],[id('voices'),t('='),n(15)],
  [t('Bchg'),n(0),t(','),id('voices')],[t('Bchg'),n(3),t(','),id('voices')],
  [t('Print'),text('Bchg voice mask: '),t(';'),id('voices')]];
 for(const name of ['Cup$','Cdown$','Cleft$','Cright$'])lines.push([t('Repeat'),w(0)],[id('key',6,2),t('='),t('Inkey$')],[t('Until'),t('Len'),t('('),id('key',6,2),t(')'),t('>'),n(0)],[id('code'),t('='),t('Asc'),t('('),id('key',6,2),t(')')],[id('match'),t('='),id('key',6,2),t('='),t(name)],[t('Print'),text(name+': '),t(';'),id('match')]);
 lines.push([t('Wait Key')]);const source=new T(binary(lines)).toModule();
 return page.evaluate(source=>{
  const m={exports:{}};new Function('module',source)(m);const canvas=document.createElement('canvas');document.body.append(canvas);
  const p=m.exports({setTimeout,clearTimeout}),host=AMOS_BROWSER.createCanvasHost(canvas,{requestAnimationFrame:()=>1,cancelAnimationFrame(){},joysticks:[]});
  host.attach(p);canvas.tabIndex=0;canvas.focus();
  try{
   p.tick(1000);host.render();const codes=[];
   for(const key of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight']){
    canvas.dispatchEvent(new KeyboardEvent('keydown',{key,code:key,bubbles:true,cancelable:true}));canvas.dispatchEvent(new KeyboardEvent('keyup',{key,code:key,bubbles:true,cancelable:true}));
    p.tick(1000);host.render();if(p.state.variables.int_match!==-1)throw Error('Cursor string does not match injected arrow');codes.push(p.state.variables.int_code);
   }
   if(p.state.variables.int_voices!==6)throw Error('Wrong toggled voice mask');const output=document.createElement('p');output.textContent='Passed: voice mask 15 → 14 → 6; injected keyboard cursor codes '+codes.join(', ');document.body.append(output);return{mask:6,codes};
  }finally{host.detach();p.stop();}
 },source);
};
