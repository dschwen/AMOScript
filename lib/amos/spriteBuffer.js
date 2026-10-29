/* jshint esversion: 6 */
'use strict';

// Owned native-format direct-sprite columns. The snapshot publisher consumes
// their words; it does not bypass the pool with indexed/RGBA image overlays.
function createSpriteBuffer() {
  let storage, rows, physical = 0, logic = 1, inter = 2, generation = 0;
  let published = new Map(), pointerVisible = true;
  const layout = () => Object.freeze({ rows, lineLimit: rows - 2, columnBytes: rows * 4,
    frameBytes: rows * 32, allocationBytes: storage.length, physical, logic, inter, generation });
  function allocate(nextRows) {
    try { return new Uint8Array(nextRows * 96); }
    catch (_) { throw new Error('Unable to allocate Sprite buffer'); }
  }
  // HsInit passes 128 directly to HsRBuf; SBufHs adds two to its argument.
  rows = 128; storage = allocate(rows); generation++;
  function resize(lines) {
    if (!Number.isInteger(lines) || lines < 16 || lines > 4094) throw new Error('Unsupported Set Sprite Buffer size (expected 16..4094)');
    if (rows === lines + 2) return false;
    const next = allocate(lines + 2); // preflight before replacing the live pool
    rows = lines + 2; storage = next; physical = 0; logic = 1; inter = 2;
    published = new Map(); generation++;
    return true;
  }
  function clear() { storage.fill(0); published = new Map(); }
  const writeWord = (at, value) => { storage[at] = value >>> 8; storage[at + 1] = value & 255; };
  const readWord = at => storage[at] * 256 + storage[at + 1];
  function pack(slot) {
    const frameBytes = rows * 32, columnBytes = rows * 4;
    const base = slot * frameBytes;
    storage.fill(0, base, base + frameBytes);
    for (let channel = 0; channel < 8; channel++) {
      if (channel === 0 && pointerVisible) continue;
      const sprite = published.get(channel);
      if (!sprite) continue;
      const attached = sprite.depth >= 4;
      if (attached && (channel & 1)) channel++;
      if (channel >= 8) break;
      const end = (sprite.y + sprite.height) & 511;
      const pos = ((sprite.y & 255) << 8) | ((sprite.x >> 1) & 255);
      const ctl = ((end & 255) << 8) | ((sprite.y & 256) >> 6) | ((end & 256) >> 7) | (sprite.x & 1);
      const count = attached ? 2 : 1;
      for (let part = 0; part < count && channel + part < 8; part++) {
        const at = base + (channel + part) * columnBytes;
        writeWord(at, pos); writeWord(at + 2, ctl | (part ? 128 : 0));
        for (let y = 0; y < sprite.height; y++) {
          let a = 0, b = 0;
          for (let x = 0; x < 16; x++) {
            const bits = sprite.pixels[y * 16 + x] >> (part * 2);
            a |= (bits & 1) << (15 - x); b |= ((bits >> 1) & 1) << (15 - x);
          }
          writeWord(at + 4 + y * 4, a); writeWord(at + 6 + y * 4, b);
        }
        // The zero control terminator and right/unused space are owned padding.
      }
      if (attached) channel++;
    }
  }
  function update(frames) {
    for (const sprite of frames.values()) {
      if (sprite.width !== 16 || !Number.isInteger(sprite.height) || sprite.height < 1 || sprite.height + 1 >= rows - 2 ||
          !Number.isInteger(sprite.depth) || sprite.depth < 1 || sprite.depth > 6 || !sprite.pixels || Object.prototype.toString.call(sprite.pixels) !== '[object Uint8Array]' || sprite.pixels.length !== sprite.height * 16) throw new Error('Invalid direct Sprite buffer image');
    }
    published = frames; pack(logic);
    const old = physical; physical = logic; logic = inter; inter = old;
  }
  function setPointerVisible(visible) {
    if (pointerVisible === visible) return;
    pointerVisible = visible;
    // Preserve the established pointer-reservation behavior using frozen
    // published records, never pending logical Sprite commands.
    for (let slot = 0; slot < 3; slot++) pack(slot);
  }
  function publish(frame) {
    const base = physical * rows * 32;
    for (let channel = 0; channel < 8; channel++) {
      const column = base + channel * rows * 4;
      const pos = readWord(column), ctl = readWord(column + 2);
      const x = ((pos & 255) << 1) | (ctl & 1);
      const y = (pos >>> 8) | ((ctl & 4) << 6);
      const end = (ctl >>> 8) | ((ctl & 2) << 7), height = (end - y + 512) & 511;
      if (!height) continue;
      const left = (x - frame.origin.x) * frame.samplesPerLowresPixel;
      for (let line = 0; line < frame.lines; line++) {
        const sourceY = frame.origin.y + line - y;
        if (sourceY < 0 || sourceY >= height) continue;
        const at = line * 32 + channel * 4;
        frame.lineSprites[at] = left >>> 0;
        frame.lineSprites[at + 1] = readWord(column + 4 + sourceY * 4);
        frame.lineSprites[at + 2] = readWord(column + 6 + sourceY * 4);
        frame.lineSprites[at + 3] = 0x80000000 | (ctl & 128 ? 1 : 0);
        frame.lineRegs[line * 32 + 16] |= 4;
      }
    }
  }
  return { resize, clear, update, setPointerVisible, publish, layout,
    snapshot: () => ({ ...layout(), bytes: storage.slice() }) };
}
if (typeof module === 'object' && module.exports) module.exports = createSpriteBuffer;
else globalThis.AMOS_SPRITE_BUFFER = createSpriteBuffer;
