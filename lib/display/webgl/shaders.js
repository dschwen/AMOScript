/* jshint esversion: 6 */
'use strict';

function createShaderSources() {
  const header = `#version 300 es
    precision highp float;
    precision highp int;
    uniform highp usampler2D regs;
    uniform uint nativeSamples;
    uint reg(int column, int line) { return texelFetch(regs, ivec2(column, line), 0).r; }
  `;
  const decode = `${header}
    uniform highp usampler2D chip;
    layout(location = 0) out uint indexValue;
    void main() {
      int x = int(gl_FragCoord.x), line = int(gl_FragCoord.y);
      uint control = reg(8, line), flags = reg(16, line);
      int start = int(reg(13, line)), stop = int(reg(14, line));
      if ((flags & 3u) != 3u || x < start || x >= stop) { indexValue = 256u; return; }
      uint samples = (control & 32768u) != 0u ? nativeSamples / 2u : nativeSamples;
      // Unsigned subtraction preserves a negative signed window origin.
      uint sourceX = (uint(x) - uint(start)) / samples;
      uint count = (control >> 12u) & 7u, value = 0u;
      for (uint plane = 0u; plane < 6u; plane++) {
        if (plane >= count) break;
        uint delay = (reg(9, line) >> ((plane & 1u) * 4u)) & 15u;
        if ((control & 32768u) != 0u) delay *= 2u;
        int sourceBit = int(sourceX) + int(reg(15, line)) - int(delay);
        if (sourceBit < 0) continue;
        uint address = reg(int(plane), line) + uint(sourceBit) / 8u;
        uint byteValue = texelFetch(chip, ivec2(int(address & 2047u), int(address >> 11u)), 0).r;
        value |= ((byteValue >> (7u - (uint(sourceBit) & 7u))) & 1u) << plane;
      }
      indexValue = value;
    }
  `;
  const resolve = `${header}
    uniform highp usampler2D indices;
    uniform highp usampler2D sprites;
    uniform highp sampler2D palette;
    layout(location = 0) out vec4 colour;
    uvec3 paletteRgb(uint index, int line) {
      return uvec3(round(texelFetch(palette, ivec2(int(index), line), 0).rgb * 255.0));
    }
    uint spriteValue(int channel, int x, int line) {
      uvec4 row = texelFetch(sprites, ivec2(channel, line), 0);
      if ((row.a & 2147483648u) == 0u || x < int(row.r)) return 0u;
      uint delta = uint(x) - row.r;
      if (delta >= 16u * nativeSamples) return 0u;
      uint bit = 15u - delta / nativeSamples;
      return ((row.g >> bit) & 1u) | (((row.b >> bit) & 1u) << 1u);
    }
    void main() {
      int x = int(gl_FragCoord.x), line = int(gl_FragCoord.y);
      uint raw = texelFetch(indices, ivec2(x, line), 0).r & 255u;
      uint control = reg(8, line), priority = reg(10, line), index = raw;
      bool dual = (control & 1024u) != 0u, halfbrite = false;
      if (dual) {
        uint pf1 = (raw & 1u) | ((raw >> 1u) & 2u) | ((raw >> 2u) & 4u);
        uint pf2 = ((raw >> 1u) & 1u) | ((raw >> 2u) & 2u) | ((raw >> 3u) & 4u);
        bool choose2 = pf2 != 0u && ((priority & 64u) != 0u || pf1 == 0u);
        index = choose2 ? pf2 + 8u : pf1;
      } else if (((control >> 12u) & 7u) == 6u) {
        halfbrite = (raw & 32u) != 0u; index &= 31u;
      }
      uvec3 rgb = paletteRgb(index, line);
      if (halfbrite) rgb = ((rgb / 17u) >> 1u) * 17u;
      for (int pair = 0; pair < 4; pair++) {
        uint a = spriteValue(pair * 2, x, line), b = spriteValue(pair * 2 + 1, x, line);
        bool attached = (texelFetch(sprites, ivec2(pair * 2 + 1, line), 0).a & 1u) != 0u;
        uint value = attached ? a | (b << 2u) : a != 0u ? a : b;
        if (value == 0u) continue;
        bool blocked = dual ? (((raw & 21u) != 0u && uint(pair) >= (priority & 7u)) ||
          ((raw & 42u) != 0u && uint(pair) >= ((priority >> 3u) & 7u))) :
          (raw != 0u && uint(pair) >= ((priority >> 3u) & 7u));
        if (!blocked) rgb = paletteRgb(16u + (attached ? value : uint(pair) * 4u + value), line);
        break;
      }
      colour = vec4(vec3(rgb) / 255.0, 1.0);
    }
  `;
  return Object.freeze({ decode, resolve });
}

if (typeof module === 'object' && module.exports) module.exports = createShaderSources;
else globalThis.AMOS_WEBGL_SHADER_SOURCES = createShaderSources;
