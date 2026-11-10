'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
module.exports=async function(browser){
 const root=path.join(__dirname,'../../demos'),manifest=JSON.parse(fs.readFileSync(path.join(root,'amcaf-examples-manifest.json'))),page=await browser.newPage({viewport:{width:1000,height:900}}),errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,route=>{network.push(route.request().url());return route.abort();});
 try{
  assert.strictEqual(manifest.programs.length,12);const catalogue=fs.readFileSync(path.join(root,'amcaf-examples.md'),'utf8');
  for(const item of manifest.programs)assert(catalogue.includes('https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/'+item.file));
  for(const p of manifest.programs){if(p.compiled)continue;await page.goto(pathToFileURL(path.join(root,p.file)).href);assert.strictEqual(await page.locator('pre').textContent(),p.error);assert.strictEqual(await page.locator('#play-game').count(),0);}
  const music=manifest.programs.find(p=>p.source==='Protracker2.AMOS');assert(music.compiled);
  await page.goto(pathToFileURL(path.join(root,music.file)).href);
  await page.evaluate(()=>{const make=AMOS_BROWSER.createCanvasHost;AMOS_BROWSER.createCanvasHost=(...args)=>{const h=make(...args);return{...h,attach(p){window.protracker2=p;return h.attach(p);}};};});
  await page.click('#play-game');await page.waitForFunction(()=>window.protracker2?.state.tracker.position?.position.sequence.ticks>=12);
  assert.strictEqual(await page.locator('#game-viewport').getAttribute('data-backend'),'webgl');assert.strictEqual(await page.locator('#game-viewport').getAttribute('data-source-error'),'');
  await page.locator('#game-stop').evaluate(node=>node.click());const meterTick=await page.evaluate(()=>protracker2.state.tracker.position.position.sequence.ticks);await page.waitForTimeout(60);assert.strictEqual(await page.evaluate(()=>protracker2.state.tracker.position.position.sequence.ticks),meterTick);
  await page.locator('#game-resume').evaluate(node=>node.click());await page.waitForFunction(n=>protracker2.state.tracker.position.position.sequence.ticks>n,meterTick);
  if(await page.evaluate(()=>!!document.fullscreenElement)){await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.fullscreenElement);}
  const meterCanvas=await page.locator('#game-input').boundingBox();await page.mouse.move(meterCanvas.x+meterCanvas.width/2,meterCanvas.y+meterCanvas.height/2);await page.mouse.down();await page.waitForFunction(()=>document.getElementById('game-viewport').dataset.phase==='ended');await page.mouse.up();
  await page.evaluate(()=>AMOS_GAME_PAGE.dispose());
  const q=manifest.programs.find(p=>p.source==='QsinCosArcSqr.AMOS');assert(q.compiled);
  await page.goto(pathToFileURL(path.join(root,q.file)).href);
  await page.evaluate(()=>{const make=AMOS_BROWSER.createCanvasHost;AMOS_BROWSER.createCanvasHost=(...args)=>{const h=make(...args);return{...h,attach(p){window.mathsProgram=p;return h.attach(p);}};};});
  await page.click('#play-game');await page.waitForFunction(()=>window.mathsProgram?.state.variables.int_mx===160&&document.getElementById('game-viewport').dataset.phase==='running');
  const rect=await page.locator('#game-input').boundingBox();await page.mouse.move(rect.x+rect.width*.75,rect.y+rect.height*.5);
  await page.waitForFunction(()=>Math.abs(window.mathsProgram.state.variables.int_dx-80)<=1&&Math.abs(window.mathsProgram.state.variables.int_dy)<=1);
  assert.strictEqual(await page.locator('#game-viewport').getAttribute('data-backend'),'webgl');
  if(await page.evaluate(()=>!!document.fullscreenElement)){await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.fullscreenElement);}
  await page.locator('#game-input').focus();await page.keyboard.press('Escape');await page.waitForFunction(()=>document.getElementById('game-viewport').dataset.phase==='ended');
  await page.locator('#game-restart').evaluate(node=>node.click());await page.waitForFunction(()=>document.getElementById('game-viewport').dataset.phase==='running');
  await page.locator('#game-stop').evaluate(node=>node.click());assert.strictEqual(await page.locator('#game-viewport').getAttribute('data-phase'),'stopped');
  await page.evaluate(()=>AMOS_GAME_PAGE.dispose());assert.deepStrictEqual(errors,[]);assert.deepStrictEqual(network,[]);
  await page.goto(pathToFileURL(path.join(root,'amcaf-hawkeye.html')).href);
  await page.evaluate(()=>{const make=AMOS_BROWSER.createCanvasHost;AMOS_BROWSER.createCanvasHost=(...args)=>{const h=make(...args);return{...h,attach(p){window.hawkeye=p;return h.attach(p);}};};});
  await page.evaluate(()=>{
    window.initialAudioStarts=0;const make=AMOS_WEB_AUDIO_STREAM;
    window.AMOS_WEB_AUDIO_STREAM=(context,...args)=>{const create=context.createBufferSource.bind(context);context.createBufferSource=()=>{const source=create(),start=source.start.bind(source);source.start=(...args)=>{if(source.buffer?.getChannelData(0).some(v=>v!==0)&&context.state==='running')initialAudioStarts++;return start(...args);};return source;};return make(context,...args);};
  });
  await page.click('#play-game');await page.waitForFunction(()=>window.hawkeye?.state.tracker.position?.position.sequence.ticks>=8&&initialAudioStarts>0);
  assert.strictEqual(await page.locator('#game-sound').textContent(),'Mute sound');
  assert.strictEqual(await page.evaluate(()=>hawkeye.banks.get(3).name),'Work    ');
  assert.strictEqual(await page.locator('#game-viewport').getAttribute('data-backend'),'webgl');
  if(await page.evaluate(()=>!!document.fullscreenElement)){await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.fullscreenElement);}
  await page.selectOption('#game-keyboard','typing');await page.locator('#game-input').focus();await page.keyboard.press('x');
  await page.waitForFunction(()=>hawkeye.state.tracker.position.position.mask===14);
  const muted=await page.evaluate(()=>hawkeye.state.tracker.position.position.sampler.voices[0].active);assert.strictEqual(muted,false);
  await page.keyboard.press('x');await page.waitForFunction(()=>hawkeye.state.tracker.position.position.mask===15);
  await page.locator('#game-stop').evaluate(node=>node.click());const ticks=await page.evaluate(()=>hawkeye.state.tracker.position.position.sequence.ticks);await page.waitForTimeout(60);assert.strictEqual(await page.evaluate(()=>hawkeye.state.tracker.position.position.sequence.ticks),ticks);
  await page.locator('#game-resume').evaluate(node=>node.click());await page.waitForFunction(n=>hawkeye.state.tracker.position.position.sequence.ticks>n,ticks);
  await page.locator('#game-input').focus();await page.keyboard.press('x');await page.waitForFunction(()=>document.getElementById('game-viewport').dataset.phase==='ended');
  await page.evaluate(()=>AMOS_GAME_PAGE.dispose());assert.deepStrictEqual(errors,[]);assert.deepStrictEqual(network,[]);
  // A failed initial resume must offer one-click recovery, not a mute/unmute cycle.
  await page.goto(pathToFileURL(path.join(root,'amcaf-hawkeye.html')).href);
  await page.evaluate(()=>{
    const Native=window.AudioContext;window.audioRecovery={attempts:0,pcm:0,starts:0};
    window.AudioContext=function(){const context=new Native();window.recoveryContext=context;const resume=context.resume.bind(context);context.resume=()=>{audioRecovery.attempts++;return audioRecovery.attempts===1?Promise.reject(Error('Prepared activation refusal')):resume();};
      const make=context.createBufferSource.bind(context);context.createBufferSource=()=>{const source=make(),start=source.start.bind(source);source.start=(...args)=>{if(source.buffer?.getChannelData(0).some(v=>v!==0))audioRecovery.starts++;return start(...args);};return source;};return context;};
    const make=AMOS_WEB_AUDIO_STREAM;window.AMOS_WEB_AUDIO_STREAM=(...args)=>{const host=make(...args);return{...host,command(e){if(e.type==='pcm')audioRecovery.pcm++;return host.command(e);}};};
  });
  await page.click('#play-game');await page.waitForFunction(()=>document.getElementById('game-viewport').dataset.sound==='error');
  assert.strictEqual(await page.locator('#game-sound').textContent(),'Enable sound');assert.strictEqual(await page.evaluate(()=>audioRecovery.pcm),0);
  if(await page.evaluate(()=>!!document.fullscreenElement)){await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.fullscreenElement);}
  await page.locator('#game-sound').click();await page.waitForFunction(()=>document.getElementById('game-viewport').dataset.sound==='on'&&audioRecovery.starts>0);
  assert.strictEqual(await page.evaluate(()=>audioRecovery.attempts),2);assert.strictEqual(await page.locator('#game-sound').textContent(),'Mute sound');
  await page.evaluate(()=>recoveryContext.suspend());await page.waitForFunction(()=>document.getElementById('game-sound').textContent==='Enable sound');
  await page.waitForTimeout(60);const starts=await page.evaluate(()=>audioRecovery.starts);
  await page.locator('#game-sound').click();await page.waitForFunction(n=>document.getElementById('game-viewport').dataset.sound==='on'&&audioRecovery.starts>n,starts);
  assert.strictEqual(await page.evaluate(()=>audioRecovery.attempts),3);
  await page.evaluate(()=>AMOS_GAME_PAGE.dispose());assert.deepStrictEqual(errors,[]);assert.deepStrictEqual(network,[]);
  console.log('AMCAF examples passed: 12 catalogue entries/preview links, honest blocker pages and original Protracker2 animation/pause/mouse exit and quick-maths mouse/exit/restart with WebGL. Hawkeye Work-bank music and compiled voice controls also pass; one-click activation/suspension recovery passes; the first Protracker version remains blocked.');
 }finally{await page.close();}
};
