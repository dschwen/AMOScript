/* jshint esversion: 6 */
'use strict';

function createRendererFactory(snapshotModel, spriteModel, createResources, createShaderSources) {
  return function createRenderer(canvas, options = {}) {
    const fail = (message, line = null) => { throw new Error(`GPU display: ${message}${line == null ? '' : ` on line ${line}`}`); };
    if (options.onStateChange != null && typeof options.onStateChange !== 'function') fail('invalid state listener');
    let info = null, lastResult = null, lastError = null, frames = 0;
    const resources = createResources(canvas, { onStateChange: event => {
      if (event.state === 'ready' && info) {
        try { draw(); } catch (error) { lastError = error.message; }
      }
      if (options.onStateChange) options.onStateChange({ ...event, state: lastError && event.state === 'ready' ? 'error' : event.state, error: lastError || event.error });
    } });
    function validate(snapshot) {
      snapshotModel.validateSnapshot(snapshot);
      const { chip, frame } = snapshot, caps = resources.capabilities;
      if (frame.chipset === 'AGA') fail('AGA is not implemented');
      if (frame.outputWidth > Math.min(caps.maxTextureSize, caps.maxViewport[0]) ||
          Math.max(1, frame.lines) > Math.min(caps.maxTextureSize, caps.maxViewport[1])) fail('frame exceeds capabilities');
      for (let line = 0; line < frame.lines; line++) {
        const row = line * 32, regs = frame.lineRegs, control = regs[row + 8], planes = (control >> 12) & 7;
        if (control & 0x800) fail('HAM is not implemented', line);
        if ((control & ~0xf604) || planes > (control & 0x8000 ? 4 : 6)) fail('unsupported bitplane mode', line);
        if (regs[row + 9] > 255 || regs[row + 10] > 127 || regs[row + 11] || regs[row + 12] ||
            Math.abs(regs[row + 15] | 0) > 65535) fail('extended registers are not implemented', line);
        if (regs[row + 17]) fail('mid-line events are not implemented', line);
        const start = regs[row + 13] | 0, stop = regs[row + 14] | 0;
        if (stop < start) fail('invalid horizontal window', line);
        spriteModel.validate(frame, line);
        for (let index = 0; index < 32; index++) {
          const at = line * 1024 + index * 4;
          if (frame.linePal[at] % 17 || frame.linePal[at + 1] % 17 || frame.linePal[at + 2] % 17 || frame.linePal[at + 3] !== 255) fail('invalid OCS/ECS palette', line);
        }
        if ((regs[row + 16] & 3) !== 3 || Math.min(frame.outputWidth, stop) <= Math.max(0, start)) continue;
        const samples = frame.samplesPerLowresPixel / (control & 0x8000 ? 2 : 1);
        const last = Math.floor((Math.min(frame.outputWidth, stop) - 1 - start) / samples);
        for (let plane = 0; plane < planes; plane++) {
          const delay = ((regs[row + 9] >> (plane % 2 ? 4 : 0)) & 15) * (control & 0x8000 ? 2 : 1);
          const bit = last + (regs[row + 15] | 0) - delay;
          if (bit >= 0 && regs[row + plane] + Math.floor(bit / 8) >= chip.length) fail(`bitplane ${plane + 1} fetch out of bounds`, line);
        }
      }
    }
    function draw() {
      if (!info) fail('no frame is loaded');
      lastError = null;
      if (info.lines) {
        resources.runPass('decode', 'indexBuf', { chip: 'chip', regs: 'lineRegs' }, { nativeSamples: info.samples });
        resources.runPass('resolve', 'colourBuf', { indices: 'indexBuf', regs: 'lineRegs', palette: 'linePal', sprites: 'lineSprites' }, { nativeSamples: info.samples });
        frames++;
      }
      lastResult = Object.freeze({ backend: info.lines ? 'gpu' : 'gpu-empty', passes: info.lines ? 2 : 0,
        revision: info.revision, width: info.width, lines: info.lines });
      return lastResult;
    }
    function render(snapshot) {
      if (resources.state === 'disposed') fail('renderer is disposed');
      validate(snapshot);
      const { frame } = snapshot;
      info = { revision: frame.revision, width: frame.outputWidth, lines: frame.lines, samples: frame.samplesPerLowresPixel };
      lastError = null;
      try {
        if (!resources.upload(snapshot)) {
          lastResult = Object.freeze({ backend: 'unavailable', reason: 'context-lost', passes: 0 }); return lastResult;
        }
        return draw();
      } catch (error) {
        lastError = error.message; lastResult = Object.freeze({ backend: 'unavailable', reason: error.message, passes: 0 }); throw error;
      }
    }
    function readPixels() {
      if (resources.state !== 'ready' || lastError) fail(lastError || `context is ${resources.state}`);
      if (!info) fail('no frame is loaded');
      if (!info.lines) return new Uint8ClampedArray(0);
      const gl = resources.context, target = resources.getTexture('colourBuf');
      const bytes = new Uint8ClampedArray(info.width * info.lines * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      gl.pixelStorei(gl.PACK_ALIGNMENT, 1); gl.readPixels(0, 0, info.width, info.lines, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      const error = gl.getError(); if (error !== gl.NO_ERROR) fail(`readback GL error ${error}`);
      return bytes;
    }
    try {
      const sources = createShaderSources(); resources.addPass('decode', sources.decode); resources.addPass('resolve', sources.resolve);
    } catch (error) { resources.dispose(); throw error; }
    return { render, readPixels, resources, dispose() { info = null; lastResult = null; resources.dispose(); },
      get state() { return lastError && resources.state === 'ready' ? 'error' : resources.state; },
      get stats() { return { gpuFrames: frames, drawCalls: resources.stats.passDraws, lastResult, error: lastError }; } };
  };
}

if (typeof module === 'object' && module.exports) {
  module.exports = createRendererFactory(require('../model/frameState'), require('../reference/sprites'), require('./resources'), require('./shaders'));
  module.exports.createRendererFactory = createRendererFactory;
} else globalThis.AMOS_WEBGL_RENDERER_FACTORY = createRendererFactory;
