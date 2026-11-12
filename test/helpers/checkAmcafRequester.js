'use strict';
const assert=require('assert'),path=require('path'),{pathToFileURL}=require('url');
module.exports=async function(page,root){
 await page.goto(pathToFileURL(path.join(root,'amcaf-example-filerequester.html')).href);
 await page.evaluate(()=>{const make=AMOS_BROWSER.createCanvasHost;AMOS_BROWSER.createCanvasHost=(...args)=>{const host=make(...args);window.requesterGpu=args[1].renderer;return{...host,attach(p){window.requester=p;return host.attach(p);}};};});
 await page.click('#play-game');await page.waitForFunction(()=>window.requester?.state.locals.int_rdir===0&&requester.state.locals.int_numfil>0);
 assert.strictEqual(await page.locator('#game-viewport').getAttribute('data-backend'),'webgl');
 if(await page.evaluate(()=>!!document.fullscreenElement)){await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.fullscreenElement);}
 const parity=()=>page.evaluate(()=>{const r=requesterGpu.render(requester.display.snapshotDisplay()),a=requesterGpu.readPixels(),b=requester.display.renderDisplay();return r.backend==='gpu'&&a.length===b.length&&a.every((v,i)=>v===b[i]);});assert(await parity());
 async function click(x,y){
  const bounds=await page.locator('#game-input').boundingBox();
  const size=await page.evaluate(()=>{const s=requester.display.screen();return{width:s.width,height:s.height};});
  await page.mouse.move(bounds.x+x/size.width*bounds.width,bounds.y+y/size.height*bounds.height);
  // The source polls Mouse Key and retains the previous sample in OMK.
  // Wait for both samples to clear, including after returning to AMOS.
  await page.waitForFunction(()=>(requester.state.locals.int_mk===0&&requester.state.locals.int_omk===0)||requester.state.halted);
  await page.mouse.down();
  try{await page.waitForFunction(()=>requester.state.locals.int_mk===1||requester.state.halted);}
  finally{await page.mouse.up();}
  await page.waitForFunction(()=>requester.state.locals.int_mk===0||!requester.amosHere()||requester.state.halted);
 }
 async function button(number){const [x,y]=await page.evaluate(number=>{const a=requester.state.variables.array_int_fb.values;return[(a.get(number*5)+a.get(number*5+2))/2,(a.get(number*5+1)+a.get(number*5+3))/2];},number);await click(x,y);}
 await button(3);await page.waitForFunction(()=>!requester.amosHere());assert(await page.locator('#game-foreground').isVisible());await page.locator('#game-foreground').click();await page.waitForFunction(()=>requester.amosHere()===-1);assert(await page.locator('#game-foreground').isHidden());
 await button(6);await page.waitForFunction(()=>requester.state.locals.int_ent===6);await page.locator('#game-input').focus();await page.keyboard.type('tmp');await page.waitForFunction(()=>requester.state.variables.array_string_fb.values.get(6).includes('tmp'));for(let i=0;i<3;i++)await page.keyboard.press('Backspace');await page.waitForFunction(()=>!requester.state.variables.array_string_fb.values.get(6).includes('tmp'));
 await click(50,19);await page.waitForFunction(()=>requester.state.locals.string_d==='data'&&requester.state.locals.int_rdir===0);
 const info=await page.evaluate(()=>{const vars=requester.state.variables,a=vars.array_string_fil.values;for(const[index,text]of a)if(text.includes('mod.hawkeye\0')){const l=requester.state.locals,row=index-l.int_filoff-1;return{index,x:50,y:l.int_fy1+row*8+4,top:l.int_fy1+row*8+1};}throw Error('Hawkeye not listed');});
 const region=top=>page.evaluate(top=>{const a=requester.display.screen().pixels,out=[];for(let y=top;y<top+8;y++)out.push(...a.slice(y*640+8,y*640+612));return out;},top);
 const before=await region(info.top);await click(info.x,info.y);await page.waitForFunction(()=>requester.state.locals.string_f==='mod.hawkeye');assert.deepStrictEqual(await region(info.top),before.map(v=>v^3),'Native complement selection');assert(await parity());
 await button(4);await page.waitForFunction(()=>requester.state.variables.string_f==='data/mod.hawkeye');assert(await parity());await button(16);await page.waitForTimeout(80);await button(16);await page.waitForFunction(()=>requester.state.halted);assert.strictEqual(await page.locator('#game-viewport').getAttribute('data-source-error'),'');await page.evaluate(()=>AMOS_GAME_PAGE.dispose());
 console.log('AMCAF FileRequester passed: source device/directory listing, screen-to-back/foreground restore, pointer file selection, independent complement region, two confirmation dialogs, natural End and three GPU frames.');
};
