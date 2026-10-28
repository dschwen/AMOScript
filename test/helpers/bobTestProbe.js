'use strict';
module.exports = async function bobTestProbe(page) {
  return page.evaluate(input => {
    const make = source => new Function(`return (${source});`)(), check = (ok, message) => { if (!ok) throw Error(message); };
    const bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0)), images = input.images.map(bytes), positions = bytes(input.positions), checkFrame = make(input.checkFrameSource);
    const module = {exports:{}}; new Function('module', input.sources['BobTest.amos'])(module);
    const clock = make(input.clockSource)(), p = module.exports({...input.programOptions, now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});
    const canvas = document.createElement('canvas'); canvas.tabIndex=0; document.body.append(canvas);
    const s=input.gpuSources, model=make(s.model)(), sprites=make(s.sprites)();
    const gpu=make(s.renderer)(model,sprites,make(s.resources)(model),make(s.shaders),make(s.layout))(document.createElement('canvas'));
    const host=AMOS_BROWSER.createCanvasHost(canvas,{requestAnimationFrame:()=>1,cancelAnimationFrame(){}}), gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{renderer:gpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
    let updates=0, frames=0, gpuFrames=0;
    function capture(name) {
      host.render(); const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      const previous=p.display.canvasFrame;p.display.canvasFrame=()=>{throw Error('GPU called CPU presentation');};
      try {gpuHost.render();} finally {p.display.canvasFrame=previous;}
      const actual=gpu.readPixels(),reference=p.display.renderDisplay();
      check(gpu.stats.lastResult.backend==='gpu'&&actual.length===reference.length&&actual.every((v,i)=>v===reference[i]),`${name}: GPU pixels differ`);gpuFrames++;frames++;
      if(globalThis.AMOS_DEMO_OBSERVE){globalThis.AMOS_DEMO_OBSERVE({name:`Canvas: ${name}`,width:canvas.width,height:canvas.height,rgba});globalThis.AMOS_DEMO_OBSERVE({name:`WebGL: ${name}`,width:gpu.stats.lastResult.width,height:gpu.stats.lastResult.lines,rgba:actual});}
    }
    try {
      host.attach(p);gpuHost.attach(p);p.tick(10000);check(p.state.waiting==='key'&&p.state.location.line===23,'Missing original start prompt');
      p.banks.get(1).images.forEach((image,i)=>check(image.pixels.every((v,j)=>v===images[i][j]),`Captured image ${i+1} differs from Python`));
      const background=p.display.screen().pixels.slice(), update=p.updateBobs;capture('Original start prompt');
      p.stop();clock.tick(1000);check(p.state.stopped&&p.bobs.size===0,'Pause advanced original prompt');p.resume();
      p.updateBobs=()=>{update();if(updates<=500){const sampled=[0,1,100,319,500].includes(updates);checkFrame(p,background,images,positions,updates,sampled);if(sampled)capture(`BobTest frame ${updates}`);}else{check(p.display.screen().pixels.every((v,i)=>v===background[i]),'Bob Off did not restore background');capture('Bob Off background restored');}updates++;};
      host.focus();canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'a',code:'KeyA',bubbles:true}));canvas.dispatchEvent(new KeyboardEvent('keyup',{key:'a',code:'KeyA',bubbles:true}));clock.tick(0);
      check(updates===502&&p.state.waiting==='key'&&p.state.location.line===59&&p.bobs.size===0,'Original 500-frame run did not finish');capture('Original final key prompt');
      host.focus();canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'b',code:'KeyB',bubbles:true}));clock.tick(0);check(p.state.halted&&clock.pending()===0,'Final key did not end program');
      return {images:3,objects:64,movementFrames:500,positionChecks:32064,frames,gpuFrames,restored:true,ended:true};
    } finally {host.detach();gpuHost.detach();p.stop();canvas.remove();const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();}
  },require('./bobTestFixture')());
};
