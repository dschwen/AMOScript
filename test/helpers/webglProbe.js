/* jshint esversion: 6 */
'use strict';

// Exercise the display plan's integer sampling and framebuffer path. This is a
// capability gate, not an implemented Amiga renderer or performance benchmark.
module.exports = async function webglProbe(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2; canvas.height = 2;
    const gl = canvas.getContext('webgl2', { antialias: false, depth: false, stencil: false });
    if (!gl) throw new Error('Display probe requires WebGL2');
    const shaders = [], textures = [];
    let program, framebuffer, vao;
    try {
      const compile = (type, source) => {
        const shader = gl.createShader(type);
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          throw new Error(`Display probe shader: ${gl.getShaderInfoLog(shader)}`);
        }
        return shader;
      };
      program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, `#version 300 es
        void main() {
          vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
          gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
        }`));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `#version 300 es
        precision highp float;
        precision highp int;
        uniform highp usampler2D chip;
        layout(location = 0) out uvec4 colour;
        void main() {
          uint pixel = uint(gl_FragCoord.x) + 2u * uint(gl_FragCoord.y);
          uint address = pixel == 0u ? 0u : pixel == 1u ? 2047u : pixel == 2u ? 2048u : 524287u;
          uint value = texelFetch(chip, ivec2(int(address & 2047u), int(address >> 11u)), 0).r;
          colour = uvec4(value, value ^ 255u, pixel, 255u);
        }`));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(`Display probe link: ${gl.getProgramInfoLog(program)}`);
      }
      const texture = () => {
        const result = gl.createTexture();
        textures.push(result);
        gl.bindTexture(gl.TEXTURE_2D, result);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return result;
      };
      const chip = texture();
      const bytes = new Uint8Array(512 * 1024);
      bytes[0] = 17; bytes[2047] = 67; bytes[2048] = 131; bytes[524287] = 251;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, 2048, 256, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, bytes);
      const output = texture();
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8UI, 2, 2, 0, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, null);
      framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, output, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error('Display probe integer framebuffer is incomplete');
      }
      gl.useProgram(program);
      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, chip);
      gl.uniform1i(gl.getUniformLocation(program, 'chip'), 0);
      gl.disable(gl.BLEND); gl.disable(gl.DITHER);
      gl.viewport(0, 0, 2, 2);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const pixels = new Uint8Array(16);
      gl.readPixels(0, 0, 2, 2, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, pixels);
      const error = gl.getError();
      if (error !== gl.NO_ERROR) throw new Error(`Display probe GL error ${error}`);
      // readPixels is bottom-up; return canonical top-left rows explicitly.
      return { pixels: Array.from(pixels.slice(8)).concat(Array.from(pixels.slice(0, 8))),
        version: gl.getParameter(gl.VERSION), maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) };
    } finally {
      if (vao) gl.deleteVertexArray(vao);
      if (framebuffer) gl.deleteFramebuffer(framebuffer);
      for (const texture of textures) gl.deleteTexture(texture);
      if (program) gl.deleteProgram(program);
      for (const shader of shaders) gl.deleteShader(shader);
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    }
  });
};
