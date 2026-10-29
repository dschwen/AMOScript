'use strict';
module.exports = async function planetZybexProbe(page) {
  return page.evaluate(async ({ sources, assets, oracle, gpuSources, registerSource, scoreSource, scoreOracle, clockSource, defaultSource, defaultOracle, spriteBufferSource, spriteBufferOracle, gameOverSource, gameOverOracle, channelsSource, channelsOracle, amalSource, amalOracle, wholeSource }) => {
    const make = source => new Function(`return (${source});`)(), check = (value, message) => { if (!value) throw Error(message); };
    const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), v => v.toString(16).padStart(2, '0')).join('');
    const model = make(gpuSources.model)(), sprites = make(gpuSources.sprites)(), canvas = document.createElement('canvas');
    const gpu = make(gpuSources.renderer)(model, sprites, make(gpuSources.resources)(model), make(gpuSources.shaders), make(gpuSources.layout))(document.createElement('canvas'));
    const host = AMOS_BROWSER.createCanvasHost(canvas, { requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    const gpuHost = AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas, { renderer: gpu, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    let program, windows = 0, gpuFrames = 0, scoreFrames = 0, startupFrames = 0, clearedDisplays = 0, spriteBufferFrames = 0, gameOverFrames = 0, channelStages = 0, channelBindings = 0, amalFrames = 0;
    try {
      for (const level of oracle.levels) {
        const module = { exports: {} }; new Function('module', sources[level.level - 1])(module);
        program = module.exports({ files: { read: name => atob(assets[name.toLowerCase()]) } }); host.attach(program); gpuHost.attach(program); program.tick(1000);
        check(program.state.waiting === 'key', 'Missing declared preview guard');
        check(await hash(program.display.screen(1).pixels) === level.indexedSha256, `Level ${level.level}: world bitmap differs`);
        check(program.banks.get(1).images.length === 47 && program.banks.get(5).name === 'Samples ', 'Embedded banks lost');
        for (const view of level.windows) {
          program.display.screenOffset(1, view.x, view.y); host.render(); const actual = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          check(canvas.width === 320 && canvas.height === 160 && await hash(actual) === view.sha256, `Level ${level.level} ${view.x},${view.y}: independent pixels differ`); windows++;
          const previous = program.display.canvasFrame; program.display.canvasFrame = () => { throw Error('GPU used CPU presentation'); };
          try { gpuHost.render(); } finally { program.display.canvasFrame = previous; }
          const hardware = gpu.readPixels(), reference = program.display.renderDisplay();
          check(gpu.stats.lastResult.backend === 'gpu' && hardware.length === reference.length && hardware.every((v, i) => v === reference[i]), `Level ${level.level}: GPU differs`); gpuFrames++;
          if (globalThis.AMOS_DEMO_OBSERVE && [0, level.width > 320 ? 640 : 480].includes(level.width > 320 ? view.x : view.y)) {
            globalThis.AMOS_DEMO_OBSERVE({ name: `Canvas: Level ${level.level} at ${view.x},${view.y}`, width: canvas.width, height: canvas.height, rgba: actual });
            globalThis.AMOS_DEMO_OBSERVE({ name: `WebGL: Level ${level.level} at ${view.x},${view.y}`, width: gpu.stats.lastResult.width, height: gpu.stats.lastResult.lines, rgba: hardware });
          }
        }
        host.detach(); gpuHost.detach(); program.stop();
      }
      for (const standard of ['PAL', 'NTSC']) {
        const module = { exports: {} }; new Function('module', scoreSource)(module); const clock = make(clockSource)();
        program = module.exports({ displayOptions: { snapshotStandard: standard }, now:clock.now, setTimeout:clock.setTimeout, clearTimeout:clock.clearTimeout, files:{ read:name=>atob(assets[name.toLowerCase()]) } });
        host.attach(program);gpuHost.attach(program);program.tick(10000);
        for (const [index, expected] of scoreOracle.frames.entries()) {
          if (index) { program.sendKey('next'); clock.tick(0); }
          check(program.state.waiting === 'key' && program.display.screen(5).x === 77 && program.display.screen(5).y === 0, 'Original score output cursor differs');
          host.render(); const actual=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
          check(canvas.width===640 && canvas.height===171 && await hash(actual)===expected.rgbaSha256, `${standard}: independent score/playfield pixels differ`);
          const previous=program.display.canvasFrame;program.display.canvasFrame=()=>{throw Error('GPU used CPU presentation');};
          try { gpuHost.render(); } finally { program.display.canvasFrame=previous; }
          const hardware=gpu.readPixels(), reference=program.display.renderDisplay();
          check(gpu.stats.lastResult.backend==='gpu' && hardware.every((v,i)=>v===reference[i]) && hardware.length===reference.length, `${standard}: hires score GPU differs`);gpuFrames++;scoreFrames++;
          // Native hardware coordinates cover the same committed raster for
          // the doubled lowres pixels and the single-sample hires score strip.
          check(program.display.screenIn(129,211)===5 && program.display.screenIn(129,209)===2, 'Mixed-resolution screen lookup differs');
          if(globalThis.AMOS_DEMO_OBSERVE){globalThis.AMOS_DEMO_OBSERVE({name:`Canvas: ${standard} score ${expected.score}`,width:canvas.width,height:canvas.height,rgba:actual});globalThis.AMOS_DEMO_OBSERVE({name:`WebGL: ${standard} score ${expected.score}`,width:gpu.stats.lastResult.width,height:gpu.stats.lastResult.lines,rgba:hardware});}
        }
        host.detach();gpuHost.detach();program.stop();check(clock.pending()===0,'Score fixture retained timers');
      }
      for (const standard of ['PAL','NTSC']) {
        const module={exports:{}};new Function('module',defaultSource)(module);const clock=make(clockSource)();
        const calls=[];program=module.exports({displayOptions:{snapshotStandard:standard},now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,system:{command:name=>calls.push(name)}});
        host.attach(program);gpuHost.attach(program);program.tick(1000);host.render();
        const actual=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        check(program.state.waiting==='key' && canvas.width===320 && canvas.height===200 && await hash(actual)===defaultOracle.initialSha256,'Original Default screen differs');
        check(program.display.screen().palette.every((v,i)=>v===defaultOracle.palette[i]) && program.state.flashes.length===1,'Default palette/flash differs');
        const previous=program.display.canvasFrame;program.display.canvasFrame=()=>{throw Error('GPU used CPU presentation');};
        try{gpuHost.render();}finally{program.display.canvasFrame=previous;}
        const hardware=gpu.readPixels(),reference=program.display.renderDisplay();
        check(gpu.stats.lastResult.backend==='gpu' && hardware.length===reference.length && hardware.every((v,i)=>v===reference[i]),'Default GPU differs');gpuFrames++;startupFrames++;
        if(globalThis.AMOS_DEMO_OBSERVE){globalThis.AMOS_DEMO_OBSERVE({name:`Canvas: ${standard} original Default`,width:canvas.width,height:canvas.height,rgba:actual});globalThis.AMOS_DEMO_OBSERVE({name:`WebGL: ${standard} original Default`,width:gpu.stats.lastResult.width,height:gpu.stats.lastResult.lines,rgba:hardware});}
        clock.tick(60);check(program.display.screen().palette[3]===0x440,'Default flash wake differs');
        program.sendKey('next');clock.tick(0);host.render();gpuHost.render();
        check(program.state.waiting==='key' && program.display.screens.size===0 && canvas.width===0 && gpu.resources.context.canvas.width===0 && gpu.stats.lastResult===null,'Original Screen Close retained a display');
        check(calls.join(',')==='Close Editor' && clock.pending()===0 && program.state.spriteBuffer.allocationBytes===4800 && program.state.spriteBuffer.lineLimit===48,'Original startup Sprite allocation/cleanup differs');clearedDisplays++;
        host.detach();gpuHost.detach();program.stop();
      }
      for(const standard of ['PAL','NTSC']) {
        const module={exports:{}};new Function('module',spriteBufferSource)(module);const clock=make(clockSource)();
        program=module.exports({displayOptions:{snapshotStandard:standard},now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});
        host.attach(program);gpuHost.attach(program);program.tick(1000);
        let generation;
        for(const expected of spriteBufferOracle.frames){
          if(expected.stage){program.sendKey('next');clock.tick(0);}
          check(program.state.waiting==='key' && program.mouseVisible()===expected.mouseVisible && program.state.spriteBuffer.lineLimit===expected.lineLimit && program.state.spriteBuffer.allocationBytes===expected.allocationBytes,'Sprite buffer layout/lifecycle differs');
          if(expected.stage===0)generation=program.state.spriteBuffer.generation;
          if(expected.stage===1)check(program.state.spriteBuffer.generation===generation,'Same-size Sprite allocation was replaced');
          host.render();const actual=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
          check(await hash(actual)===expected.sha256,`${standard}: Sprite buffer matrix stage ${expected.stage} pixels differ`);
          const previous=program.display.canvasFrame;program.display.canvasFrame=()=>{throw Error('GPU used CPU presentation');};
          try{gpuHost.render();}finally{program.display.canvasFrame=previous;}
          const hardware=gpu.readPixels(),reference=program.display.renderDisplay();
          check(gpu.stats.lastResult.backend==='gpu' && hardware.length===reference.length && hardware.every((v,i)=>v===reference[i]),'Sprite-buffer GPU differs');gpuFrames++;spriteBufferFrames++;
          if(globalThis.AMOS_DEMO_OBSERVE){globalThis.AMOS_DEMO_OBSERVE({name:`Canvas: ${standard} Sprite buffer stage ${expected.stage}`,width:canvas.width,height:canvas.height,rgba:actual});globalThis.AMOS_DEMO_OBSERVE({name:`WebGL: ${standard} Sprite buffer stage ${expected.stage}`,width:gpu.stats.lastResult.width,height:gpu.stats.lastResult.lines,rgba:hardware});}
        }
        host.detach();gpuHost.detach();program.stop();check(clock.pending()===0,'Sprite buffer matrix retained wakes');
      }
      for (const standard of ['PAL','NTSC']) {
        const module={exports:{}};new Function('module',gameOverSource)(module);const clock=make(clockSource)();
        program=module.exports({displayOptions:{snapshotStandard:standard},now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});
        host.attach(program);gpuHost.attach(program);program.tick(1000);
        for(const expected of gameOverOracle.frames){
          if(expected.stage){program.sendKey('next');clock.tick(0);}
          check(program.state.waiting==='key' && program.display.screen().graphicsMode===expected.mode,'GAME OVER graphics mode/guard differs');
          check(await hash(program.display.screen().pixels)===expected.indicesSha256,'Independent GAME OVER indexed pixels differ');
          host.render();const actual=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
          check(canvas.width===320 && canvas.height===160 && await hash(actual)===expected.rgbaSha256,`${standard}: GAME OVER pixels differ`);
          const previous=program.display.canvasFrame;program.display.canvasFrame=()=>{throw Error('GPU used CPU presentation');};
          try{gpuHost.render();}finally{program.display.canvasFrame=previous;}
          const hardware=gpu.readPixels(),reference=program.display.renderDisplay();
          check(gpu.stats.lastResult.backend==='gpu' && hardware.length===reference.length && hardware.every((v,i)=>v===reference[i]),'GAME OVER GPU differs');gpuFrames++;gameOverFrames++;
          if(globalThis.AMOS_DEMO_OBSERVE){globalThis.AMOS_DEMO_OBSERVE({name:`Canvas: ${standard} GAME OVER stage ${expected.stage}`,width:canvas.width,height:canvas.height,rgba:actual});globalThis.AMOS_DEMO_OBSERVE({name:`WebGL: ${standard} GAME OVER stage ${expected.stage}`,width:gpu.stats.lastResult.width,height:gpu.stats.lastResult.lines,rgba:hardware});}
        }
        host.detach();gpuHost.detach();program.stop();check(clock.pending()===0,'GAME OVER fixture retained wakes');
      }
      {
        const module={exports:{}};new Function('module',channelsSource)(module);const clock=make(clockSource)();
        program=module.exports({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,files:{read:name=>atob(assets[name.toLowerCase()])}});
        host.attach(program);gpuHost.attach(program);program.tick(1000);
        for(const expected of channelsOracle.frames){
          if(expected.stage){program.sendKey('next');clock.tick(0);}
          check(program.state.waiting==='key' && program.state.variables.int_stage===expected.stage && program.bobs.size===0,'Channel fixture guard/object creation differs');
          for(let channel=0;channel<64;channel++){
            const binding=program.channelBinding(channel);
            check(Object.isFrozen(binding) && binding.type===(expected.bobs.includes(channel)?'bob':'sprite') && binding.number===channel,'Original channel routing differs');channelBindings++;
          }
          host.render();const actual=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
          check(await hash(actual)===oracle.levels[0].windows[0].sha256,'Channel routing changed the independent background');channelStages++;
        }
        const previous=program.display.canvasFrame;program.display.canvasFrame=()=>{throw Error('GPU used CPU presentation');};
        try{gpuHost.render();}finally{program.display.canvasFrame=previous;}
        const hardware=gpu.readPixels(),reference=program.display.renderDisplay();
        check(gpu.stats.lastResult.backend==='gpu' && hardware.length===reference.length && hardware.every((v,i)=>v===reference[i]),'Channel routing changed GPU output');gpuFrames++;
        if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:'WebGL: original channel routing retains level background',width:gpu.stats.lastResult.width,height:gpu.stats.lastResult.lines,rgba:hardware});
        host.detach();gpuHost.detach();program.stop();check(clock.pending()===0,'Channel routing retained wakes');
      }
      for(const standard of ['PAL','NTSC']) {
        const module={exports:{}};new Function('module',amalSource)(module);const clock=make(clockSource)(),captures=[];
        program=module.exports({vblHz:standard==='PAL'?50:60,displayOptions:{snapshotStandard:standard},now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,files:{read:name=>atob(assets[name.toLowerCase()])}});
        host.attach(program);gpuHost.attach(program);const update=program.update;
        program.update=()=>{
          update();const expected=amalOracle.frames[captures.length],channel=program.amalSnapshot()[0];
          check(expected && program.bobInfo('X Bob',21)===expected.x && program.bobInfo('Y Bob',21)===expected.y && channel.remaining===expected.remaining && channel.ended===expected.ended,'Original AMAL MOVE trace differs');
          host.render();const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
          captures.push({rgba,expected});
          if(expected.png){
            const previous=program.display.canvasFrame;program.display.canvasFrame=()=>{throw Error('GPU used CPU presentation');};
            try{gpuHost.render();}finally{program.display.canvasFrame=previous;}
            const hardware=gpu.readPixels(),reference=program.display.renderDisplay();
            check(gpu.stats.lastResult.backend==='gpu' && hardware.length===reference.length && hardware.every((v,i)=>v===reference[i]),'AMAL MOVE GPU differs');gpuFrames++;
            if(globalThis.AMOS_DEMO_OBSERVE){globalThis.AMOS_DEMO_OBSERVE({name:`Canvas: ${standard} AMAL drop ${expected.frame}`,width:canvas.width,height:canvas.height,rgba});globalThis.AMOS_DEMO_OBSERVE({name:`WebGL: ${standard} AMAL drop ${expected.frame}`,width:gpu.stats.lastResult.width,height:gpu.stats.lastResult.lines,rgba:hardware});}
          }
        };
        program.tick(1000);program.sendKey('play');clock.tick(1000);
        check(captures.length===14 && program.state.waiting==='key','AMAL preview did not complete its declared frame loop');
        for(const frame of captures){check(await hash(frame.rgba)===frame.expected.rgbaSha256,'Independent AMAL drop pixels differ');amalFrames++;}
        host.detach();gpuHost.detach();program.stop();check(clock.pending()===0,'AMAL preview retained wakes');
      }
      {
        const module={exports:{}};new Function('module',wholeSource)(module);const clock=make(clockSource)();
        program=module.exports({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,files:{read:name=>atob(assets[name.toLowerCase()])}});
        let error;try{program.tick(10000);clock.tick(10000);}catch(value){error=value;}
        check(error && error.message==='Unsupported AMAL instruction at AMAL character 11 at line 276, byte 11614','Complete unchanged source did not reach its declared Autotest gate');
        check(program.state.halted && program.amalSnapshot().length===0 && clock.pending()===0,'Full-source runtime gate retained owned work');program.stop();
      }
      const registers = { exports: {} }; new Function('module', registerSource)(registers); const r = registers.exports({}); r.tick(1000);
      check(r.state.halted && Array.from({ length: 26 }, (_, i) => r.amreg(i)).every((value, i) => value === (i === 9 ? 1234 : i === 20 ? 4 : i >= 1 && i <= 8 ? 100 : 0)), 'Original clear_amal register exchange differs'); r.stop();
      return { registersVerified: true, levels: 7, windows, scoreFrames, startupFrames, clearedDisplays, spriteBufferFrames, gameOverFrames, channelStages, channelBindings, amalFrames, gpuFrames, fullGameCompiled: true, runtimeGate: 'AMAL Autotest', previewOnly: true };
    } finally { host.detach(); gpuHost.detach(); if (program) program.stop(); const gl = gpu.resources.context; gpu.dispose(); const ext = gl.getExtension('WEBGL_lose_context'); if (ext && !gl.isContextLost()) ext.loseContext(); }
  }, require('./planetZybexFixture')());
};
