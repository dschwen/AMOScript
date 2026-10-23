/* jshint esversion: 6 */
'use strict';

function presentationLayout(frame, viewportWidth, viewportHeight, options = {}) {
  const fail = message => { throw new Error(`Display presentation: ${message}`); };
  if (!frame || !Number.isInteger(frame.outputWidth) || frame.outputWidth < 1 || frame.outputWidth > 4096 ||
      !Number.isInteger(frame.lines) || frame.lines < 0 || frame.lines > 2048) fail('invalid field dimensions');
  if (![viewportWidth, viewportHeight].every(value => Number.isInteger(value) && value >= 1 && value <= 16384)) fail('invalid viewport dimensions');
  if (options.integerScale != null && typeof options.integerScale !== 'boolean') fail('invalid integer scale option');
  const aspect = options.pixelAspect || frame.pixelAspect;
  if (!aspect || ![aspect.numerator, aspect.denominator].every(value => Number.isInteger(value) && value > 0 && value <= 1000000)) fail('invalid pixel aspect');
  const gcd = (a, b) => { while (b) { const remainder = a % b; a = b; b = remainder; } return a; };
  const divisor = gcd(aspect.numerator, aspect.denominator);
  const numerator = aspect.numerator / divisor, denominator = aspect.denominator / divisor;
  if (!frame.lines) return Object.freeze({ x: 0, y: 0, width: 0, height: 0, viewportWidth, viewportHeight,
    scale: 0, integerScale: false, pixelAspect: Object.freeze({ numerator, denominator }) });
  // Exact aspect-corrected integer cells. A 1/2 native pixel uses 1x2
  // framebuffer pixels, preserving hires detail on a shared native grid.
  const baseWidth = frame.outputWidth * numerator, baseHeight = frame.lines * denominator;
  let scale = Math.min(viewportWidth / baseWidth, viewportHeight / baseHeight);
  if (options.integerScale !== false && scale >= 1) scale = Math.floor(scale);
  const width = Math.max(1, Math.min(viewportWidth, Math.round(baseWidth * scale)));
  const height = Math.max(1, Math.min(viewportHeight, Math.round(baseHeight * scale)));
  return Object.freeze({ x: Math.floor((viewportWidth - width) / 2), y: Math.floor((viewportHeight - height) / 2),
    width, height, viewportWidth, viewportHeight, scale, integerScale: Number.isInteger(scale),
    pixelAspect: Object.freeze({ numerator, denominator }) });
}

if (typeof module === 'object' && module.exports) module.exports = presentationLayout;
else globalThis.AMOS_PRESENTATION_LAYOUT = presentationLayout;
