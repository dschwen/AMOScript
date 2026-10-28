'use strict';
module.exports = async function planetZybexProbe(page) {
  return page.evaluate(async ({ sources, assets, oracle, gpuSources, registerSource, scoreSource, scoreOracle, clockSource }) => {
    const make = source => new Function(`return (${source});`)(), check = (value, message) => { if (!value) throw Error(message); };
    const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), v => v.toString(16).padStart(2, '0')).join('');
    const model = make(gpuSources.model)(), sprites = make(gpuSources.sprites)(), canvas = document.createElement('canvas');
    const gpu = make(gpuSources.renderer)(model, sprites, make(gpuSources.resources)(model), make(gpuSources.shaders), make(gpuSources.layout))(document.createElement('canvas'));
    const host = AMOS_BROWSER.createCanvasHost(canvas, { requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    const gpuHost = AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas, { renderer: gpu, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    let program, windows = 0, gpuFrames = 0, scoreFrames = 0;
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
      const registers = { exports: {} }; new Function('module', registerSource)(registers); const r = registers.exports({}); r.tick(1000);
      check(r.state.halted && Array.from({ length: 26 }, (_, i) => r.amreg(i)).every((value, i) => value === (i === 9 ? 1234 : i === 20 ? 4 : i >= 1 && i <= 8 ? 100 : 0)), 'Original clear_amal register exchange differs'); r.stop();
      return { registersVerified: true, levels: 7, windows, scoreFrames, gpuFrames, fullGameCompiled: false, previewOnly: true };
    } finally { host.detach(); gpuHost.detach(); if (program) program.stop(); const gl = gpu.resources.context; gpu.dispose(); const ext = gl.getExtension('WEBGL_lose_context'); if (ext && !gl.isContextLost()) ext.loseContext(); }
  }, require('./planetZybexFixture')());
};
