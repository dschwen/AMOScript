/* jshint esversion: 6 */
'use strict';

// Serialized into standalone HTML. Keep this function free of Node dependencies.
function installDemo(config) {
  const button = document.getElementById('run-demo'), status = document.getElementById('status');
  const output = document.getElementById('results'), selector = document.getElementById('frames');
  const stage = document.getElementById('stage');
  const zoom = document.getElementById('zoom');
  const fullscreenButton=document.getElementById('frame-fullscreen');
  const fullscreen=AMOS_FULLSCREEN.createFullscreenHost(document.getElementById('frame-view'),{button:fullscreenButton,statusElement:document.getElementById('frame-fullscreen-status'),surface:stage});
  const equal = (a, b) => {
    if (Object.is(a, b)) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = Object.keys(a).sort(), other = Object.keys(b).sort();
    return keys.length === other.length && keys.every((key, i) => key === other[i] && equal(a[key], b[key]));
  };
  const assert = {
    ok(value) { if (!value) throw new Error('Expected a truthy result'); },
    strictEqual(a, b) { if (!Object.is(a, b)) throw new Error(`Expected ${JSON.stringify(b)}, received ${JSON.stringify(a)}`); },
    deepStrictEqual(a, b) { if (!equal(a, b)) throw new Error(`Result differs: expected ${JSON.stringify(b)}, received ${JSON.stringify(a)}`); },
    match(value, expression) { if (!expression.test(value)) throw new Error(`${value} does not match ${expression}`); }
  };
  let frames = [];
  function show() {
    stage.replaceChildren();
    const frame = frames[Number(selector.value)]; if (!frame) return;
    fullscreenButton.hidden=false;
    if (frame.png) {
      const image = new Image(); image.alt = frame.name;
      image.onload = () => { image.style.width = `${image.naturalWidth * Number(zoom.value)}px`; };
      image.src = frame.png; stage.append(image);
    } else {
      const canvas = document.createElement('canvas'); canvas.width = frame.width; canvas.height = frame.height;
      canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.rgba), frame.width, frame.height), 0, 0);
      canvas.style.width = `${frame.width * Number(zoom.value)}px`;
      canvas.setAttribute('aria-label', frame.name); stage.append(canvas);
    }
  }
  selector.addEventListener('change', show);
  zoom.addEventListener('change', show);
  button.addEventListener('click', async () => {
    button.disabled = true; status.textContent = 'Running…'; document.body.dataset.status = 'running';
    fullscreenButton.hidden=true;frames = []; selector.replaceChildren(); stage.replaceChildren(); output.textContent = '';
    const previousObserver = globalThis.AMOS_DEMO_OBSERVE;
    const originalPut = CanvasRenderingContext2D.prototype.putImageData;
    let previousPng = null;
    globalThis.AMOS_DEMO_OBSERVE = frame => frames.push({ ...frame, rgba: new Uint8ClampedArray(frame.rgba) });
    CanvasRenderingContext2D.prototype.putImageData = function(...args) {
      const result = originalPut.apply(this, args);
      const png = this.canvas.toDataURL('image/png');
      if (png !== previousPng) frames.push({ name: `Frame ${frames.length + 1}`, png });
      previousPng = png; return result;
    };
    try {
      // Yield so the running state paints before the larger GPU corpus starts.
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
      const result = await config.evaluate(config.argument);
      config.check(result, assert);
      if (result.failure) throw new Error(`GPU comparison failed: ${result.failure.name}`);
      if (config.pngReference) {
        const image = new Image(); image.src = config.pngReference; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
        assert.deepStrictEqual(Array.from(context.getImageData(0, 0, image.width, image.height).data), result.pixels);
        frames.push({ name: 'Integer readback / independent PNG decode', png: config.pngReference });
      }
      if (result.sample && !frames.length) {
        const bytes = Uint8ClampedArray.from(atob(result.sample.rgba), ch => ch.charCodeAt(0));
        frames.push({ name: 'Native GPU copper stack', width: result.sample.width, height: result.sample.height, rgba: bytes });
      }
      if (result.png && !frames.length) frames.push({ name: 'Rendered output', png: result.png });
      output.textContent = JSON.stringify(result, (key, value) => ['png', 'rgba', 'chip', 'tables'].includes(key) ? '(image/binary data)' : value, 2);
      status.textContent = 'Passed — the browser test assertions succeeded.'; document.body.dataset.status = 'passed';
    } catch (error) {
      output.textContent = error.stack || String(error); status.textContent = 'Failed'; document.body.dataset.status = 'failed';
    } finally {
      CanvasRenderingContext2D.prototype.putImageData = originalPut;
      if (previousObserver === undefined) delete globalThis.AMOS_DEMO_OBSERVE;
      else globalThis.AMOS_DEMO_OBSERVE = previousObserver;
      frames.forEach((frame, i) => { const option = document.createElement('option'); option.value = i; option.textContent = frame.name; selector.append(option); });
      selector.hidden = frames.length === 0;
      if (frames.length) {
        const preferred = frames.findIndex(frame => frame.name === config.initialFrame);
        const copper = frames.findIndex(frame => frame.name === 'copper-stack-dma');
        selector.value = preferred >= 0 ? preferred : copper < 0 ? Math.floor((frames.length - 1) / 2) : copper; show();
      }
      button.disabled = false;
    }
  });
  document.body.dataset.status = 'idle';
}

module.exports = installDemo;
