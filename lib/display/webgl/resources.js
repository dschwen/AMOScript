/* jshint esversion: 6 */
'use strict';

function createResourceFactory(snapshotModel) {
  return function createResources(canvas, options = {}) {
    const fail = message => { throw new Error(`WebGL display: ${message}`); };
    if (!canvas || typeof canvas.getContext !== 'function' || typeof canvas.addEventListener !== 'function') fail('canvas is required');
    if (options.onStateChange != null && typeof options.onStateChange !== 'function') fail('invalid state listener');
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false });
    if (!gl) fail('WebGL2 is unavailable');
    const capabilities = Object.freeze({ version: gl.getParameter(gl.VERSION),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE), textureUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
      maxViewport: Object.freeze(Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS))) });
    if (capabilities.maxTextureSize < 2048 || capabilities.textureUnits < 8 || capabilities.maxViewport.some(value => value < 2048)) fail('insufficient integer texture/viewport capabilities');
    const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_INT);
    // The signed highp range reports 31 for the minimum and 30 for the
    // maximum exponent (2^31-1), as specified by GetShaderPrecisionFormat.
    if (!precision || precision.rangeMin < 31 || precision.rangeMax < 30) fail('32-bit fragment integers are required');
    const textures = new Map(), programs = new Map(), passSources = new Map();
    let vao = null, debugTarget = null, state = 'initializing', lastError = null;
    let retained = null, uploadedChip = null;
    const counters = { generation: 0, losses: 0, restores: 0, textureAllocations: 0, uploads: 0,
      chipUploadCalls: 0, chipRowsUploaded: 0, tableBytesUploaded: 0, passDraws: 0 };
    let lastUpload = null;
    const vertexSource = `#version 300 es
      void main() {
        vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
        gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
      }`;
    function notify() {
      if (options.onStateChange) options.onStateChange({ state, generation: counters.generation, error: lastError });
    }
    function ready() { if (state !== 'ready' || gl.isContextLost()) fail(`context is ${state}`); }
    function check() {
      const error = gl.getError();
      if (error !== gl.NO_ERROR) fail(`GL error ${error}`);
    }
    function compile(fragment) {
      const shaders = [], program = gl.createProgram();
      try {
        for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragment]]) {
          const shader = gl.createShader(type); shaders.push(shader);
          gl.shaderSource(shader, source); gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) fail(`shader compilation: ${gl.getShaderInfoLog(shader)}`);
          gl.attachShader(program, shader);
        }
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) fail(`program link: ${gl.getProgramInfoLog(program)}`);
        return program;
      } catch (error) { gl.deleteProgram(program); throw error; }
      finally { for (const shader of shaders) gl.deleteShader(shader); }
    }
    function removeTexture(record) {
      if (!record) return;
      if (record.framebuffer) gl.deleteFramebuffer(record.framebuffer);
      gl.deleteTexture(record.texture);
    }
    function allocate(name, width, height, kind, channels, length, target = false) {
      if (width > capabilities.maxTextureSize || height > capabilities.maxTextureSize ||
          width > capabilities.maxViewport[0] || height > capabilities.maxViewport[1]) fail(`texture dimensions exceed capabilities: ${name}`);
      let record = textures.get(name);
      if (record && (record.width !== width || record.height !== height || record.kind !== kind)) {
        removeTexture(record); textures.delete(name); record = null;
      }
      if (!record) {
        const formats = { byte: [gl.R8UI, gl.RED_INTEGER, gl.UNSIGNED_BYTE],
          word: [gl.R16UI, gl.RED_INTEGER, gl.UNSIGNED_SHORT], uint: [gl.R32UI, gl.RED_INTEGER, gl.UNSIGNED_INT],
          rgba: [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE], uint4: [gl.RGBA32UI, gl.RGBA_INTEGER, gl.UNSIGNED_INT],
          byte4: [gl.RGBA8UI, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE] };
        const [internal, format, type] = formats[kind];
        record = { name, width, height, kind, channels, length, format, type, texture: gl.createTexture(), framebuffer: null };
        textures.set(name, record);
        gl.bindTexture(gl.TEXTURE_2D, record.texture);
        for (const parameter of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, parameter, gl.NEAREST);
        for (const parameter of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, parameter, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, internal, width, height, 0, format, type, null);
        counters.textureAllocations++;
      }
      record.length = length;
      if (target && !record.framebuffer) {
        record.framebuffer = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, record.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, record.texture, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) fail(`incomplete framebuffer: ${name}`);
      }
      return record;
    }
    function table(name, width, height, kind, channels, data) {
      const record = allocate(name, width, height, kind, channels, data.length);
      let padded = data;
      if (data.length !== width * height * channels) { padded = new data.constructor(width * height * channels); padded.set(data); }
      gl.bindTexture(gl.TEXTURE_2D, record.texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, record.format, record.type, padded);
      return padded.byteLength;
    }
    function uploadCurrent() {
      const { chip, frame } = retained, rows = chip.length / 2048;
      const full = !uploadedChip || uploadedChip.length !== chip.length;
      const ranges = [];
      for (let row = 0; row < rows; row++) {
        let dirty = full;
        if (!dirty) for (let at = row * 2048; at < (row + 1) * 2048; at++) {
          if (chip[at] !== uploadedChip[at]) { dirty = true; break; }
        }
        if (dirty) {
          const previous = ranges[ranges.length - 1];
          if (previous && previous[1] === row) previous[1]++;
          else ranges.push([row, row + 1]);
        }
      }
      const memory = allocate('chip', 2048, rows, 'byte', 1, chip.length);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, memory.texture);
      let changedRows = 0;
      for (const [start, end] of ranges) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, start, 2048, end - start, gl.RED_INTEGER, gl.UNSIGNED_BYTE, chip.subarray(start * 2048, end * 2048));
        changedRows += end - start;
      }
      const height = Math.max(1, frame.lines);
      let tableBytes = table('lineRegs', 32, height, 'uint', 1, frame.lineRegs);
      tableBytes += table('linePal', 256, height, 'rgba', 4, frame.linePal);
      tableBytes += table('lineSprites', 8, height, 'uint4', 4, frame.lineSprites);
      tableBytes += table('lineEvents', frame.maxEvents, height, 'uint4', 4, frame.lineEvents);
      for (const [name, channels] of [['eventOffsets', 1], ['overflowEvents', 4]]) {
        const data = frame[name], count = Math.max(1, data.length / channels), width = Math.min(2048, count);
        tableBytes += table(name, width, Math.ceil(count / width), channels === 1 ? 'uint' : 'uint4', channels, data);
      }
      allocate('indexBuf', frame.outputWidth, height, 'word', 1, frame.outputWidth * frame.lines, true);
      allocate('colourBuf', frame.outputWidth, height, 'rgba', 4, frame.outputWidth * frame.lines * 4, true);
      check();
      uploadedChip = chip;
      counters.uploads++; counters.chipUploadCalls += ranges.length; counters.chipRowsUploaded += changedRows;
      counters.tableBytesUploaded += tableBytes;
      lastUpload = { full, chipRows: changedRows, ranges, tableBytes };
    }
    function upload(snapshot) {
      if (state === 'disposed') fail('resources are disposed');
      const owned = snapshotModel.createSnapshot(snapshot);
      // Bounds are checked before replacing the retained restoration source.
      if (owned.frame.outputWidth > Math.min(capabilities.maxTextureSize, capabilities.maxViewport[0]) ||
          Math.max(1, owned.frame.lines) > Math.min(capabilities.maxTextureSize, capabilities.maxViewport[1])) fail('frame exceeds texture capabilities');
      retained = owned;
      if (state === 'lost' || gl.isContextLost()) return false;
      ready();
      try { uploadCurrent(); return true; }
      catch (error) { uploadedChip = null; throw error; }
    }
    function readTexture(name) {
      ready();
      const source = textures.get(name);
      if (!source || name === 'debug') fail(`unknown texture: ${name}`);
      const byte = ['byte', 'rgba', 'byte4'].includes(source.kind), kind = byte ? 'byte4' : 'uint4';
      debugTarget = allocate('debug', source.width, source.height, kind, 4, source.width * source.height * 4, true);
      const program = programs.get(source.kind === 'rgba' ? 'normalized' : 'integer');
      gl.bindFramebuffer(gl.FRAMEBUFFER, debugTarget.framebuffer); gl.viewport(0, 0, source.width, source.height);
      gl.useProgram(program); gl.bindVertexArray(vao); gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, source.texture); gl.uniform1i(gl.getUniformLocation(program, 'source'), 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const raw = byte ? new Uint8Array(source.width * source.height * 4) : new Uint32Array(source.width * source.height * 4);
      gl.readPixels(0, 0, source.width, source.height, gl.RGBA_INTEGER, byte ? gl.UNSIGNED_BYTE : gl.UNSIGNED_INT, raw);
      check();
      const Type = source.kind === 'word' ? Uint16Array : byte ? Uint8Array : Uint32Array, result = new Type(source.length);
      // Raw texture row zero is uploaded/read as row zero. The later screen
      // presentation pass, rather than the table codec, owns the Y conversion.
      for (let i = 0; i < result.length; i++) result[i] = raw[Math.floor(i / source.channels) * 4 + i % source.channels];
      return result;
    }
    function initialize() {
      gl.disable(gl.BLEND); gl.disable(gl.DITHER); gl.disable(gl.DEPTH_TEST); gl.disable(gl.STENCIL_TEST);
      gl.disable(gl.SCISSOR_TEST); gl.disable(gl.CULL_FACE);
      gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.pixelStorei(gl.PACK_ALIGNMENT, 1);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      const common = `#version 300 es
        precision highp float; precision highp int;
        layout(location = 0) out uvec4 value;
      `;
      programs.set('integer', compile(`${common}
        uniform highp usampler2D source;
        void main() { value = texelFetch(source, ivec2(gl_FragCoord.xy), 0); }
      `));
      programs.set('normalized', compile(`${common}
        uniform highp sampler2D source;
        void main() { value = uvec4(round(texelFetch(source, ivec2(gl_FragCoord.xy), 0) * 255.0)); }
      `));
      for (const [name, source] of passSources) programs.set(name, compile(source));
      vao = gl.createVertexArray(); uploadedChip = null; lastError = null;
      counters.generation++; state = 'ready';
      if (retained) uploadCurrent();
      check();
    }
    function lost(event) {
      event.preventDefault();
      if (state === 'disposed') return;
      state = 'lost'; uploadedChip = null; lastError = null; counters.losses++;
      textures.clear(); programs.clear(); vao = null; debugTarget = null;
      notify();
    }
    function restored() {
      if (state === 'disposed') return;
      try { initialize(); counters.restores++; }
      catch (error) { state = 'error'; lastError = error.message; }
      notify();
    }
    function release() {
      // Deleting a current program only marks it for deletion. Unbind owned
      // state first so disposal releases the program and attached shaders now.
      gl.useProgram(null); gl.bindVertexArray(null); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      for (const record of textures.values()) removeTexture(record);
      for (const program of programs.values()) gl.deleteProgram(program);
      if (vao) gl.deleteVertexArray(vao);
      textures.clear(); programs.clear(); vao = null; debugTarget = null;
    }
    function dispose() {
      if (state === 'disposed') return;
      canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored);
      if (!gl.isContextLost()) release();
      else { textures.clear(); programs.clear(); vao = null; debugTarget = null; }
      retained = null; uploadedChip = null; passSources.clear(); state = 'disposed'; notify();
    }
    function addPass(name, fragmentSource) {
      if (state === 'disposed') fail('resources are disposed');
      if (typeof name !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name) ||
          ['integer', 'normalized'].includes(name) || passSources.has(name) || passSources.size >= 16 ||
          typeof fragmentSource !== 'string' || fragmentSource.length > 65536) fail('invalid/duplicate render pass');
      if (state === 'ready') programs.set(name, compile(fragmentSource));
      passSources.set(name, fragmentSource);
    }
    function runPass(name, targetName, bindings, uintUniforms = {}) {
      ready();
      const program = programs.get(name), target = textures.get(targetName), inputs = Object.entries(bindings);
      if (!passSources.has(name) || !program || !target || !target.framebuffer || targetName === 'debug') fail('invalid render pass target');
      if (inputs.length > capabilities.textureUnits) fail('too many pass textures');
      gl.disable(gl.BLEND); gl.disable(gl.DITHER); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.STENCIL_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.RASTERIZER_DISCARD); gl.colorMask(true, true, true, true);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer); gl.viewport(0, 0, target.width, target.height);
      gl.useProgram(program); gl.bindVertexArray(vao);
      inputs.forEach(([uniform, textureName], unit) => {
        const texture = textures.get(textureName);
        if (!texture || texture === target || textureName === 'debug') fail('invalid/feedback pass texture');
        gl.activeTexture(gl.TEXTURE0 + unit); gl.bindSampler(unit, null); gl.bindTexture(gl.TEXTURE_2D, texture.texture);
        gl.uniform1i(gl.getUniformLocation(program, uniform), unit);
      });
      for (const [uniform, value] of Object.entries(uintUniforms)) {
        if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) fail('invalid uint pass uniform');
        gl.uniform1ui(gl.getUniformLocation(program, uniform), value);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3); check(); counters.passDraws++;
    }
    canvas.addEventListener('webglcontextlost', lost); canvas.addEventListener('webglcontextrestored', restored);
    try { initialize(); }
    catch (error) { dispose(); throw error; }
    return { upload, readTexture, addPass, runPass, dispose, capabilities,
      get state() { return state; }, get context() { return gl; },
      getTexture(name) {
        ready(); const record = textures.get(name);
        if (!record || name === 'debug') fail(`unknown texture: ${name}`);
        return Object.freeze({ texture: record.texture, framebuffer: record.framebuffer, width: record.width, height: record.height, kind: record.kind });
      },
      get stats() { return { ...counters, state, error: lastError,
        lastUpload: lastUpload ? { ...lastUpload, ranges: lastUpload.ranges.map(range => range.slice()) } : null }; }
    };
  };
}

if (typeof module === 'object' && module.exports) {
  module.exports = createResourceFactory(require('../model/frameState'));
  module.exports.createResourceFactory = createResourceFactory;
} else globalThis.AMOS_WEBGL_RESOURCES_FACTORY = createResourceFactory;
