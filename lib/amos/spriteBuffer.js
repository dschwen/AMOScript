/* jshint esversion: 6 */
'use strict';

// Owned native-format direct/computed sprite columns. The snapshot publisher consumes
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
    // HsPosition: a direct object (or mouse) reserves its entire channel.
    const available = Array(8).fill(true), used = Array(8).fill(0), bottom = Array(8).fill(0);
    if (pointerVisible) available[0] = false;
    function append(channel, sprite, strip, part) {
      const at = base + channel * columnBytes + used[channel] * 4;
      // Native control-word addition advances each 16-pixel strip by eight
      // horizontal words, carrying in the complete packed long.
      const end = (sprite.y + sprite.height) & 511;
      const pos = ((sprite.y & 255) << 8) | ((sprite.x >> 1) & 255);
      const ctl = ((end & 255) << 8) | ((sprite.y & 256) >> 6) | ((end & 256) >> 7) | (sprite.x & 1);
      const control = ((((pos << 16) | ctl) >>> 0) + strip * 0x80000) >>> 0;
      writeWord(at, control >>> 16); writeWord(at + 2, (control & 65535) | (part ? 128 : 0));
      for (let y = 0; y < sprite.height; y++) {
        let a = 0, b = 0;
        for (let x = 0; x < 16; x++) {
          const bits = sprite.pixels[y * sprite.width + strip * 16 + x] >> (part * 2);
          a |= (bits & 1) << (15 - x); b |= ((bits >> 1) & 1) << (15 - x);
        }
        writeWord(at + 4 + y * 4, a); writeWord(at + 6 + y * 4, b);
      }
      used[channel] += sprite.height + 1;
      bottom[channel] = sprite.y + sprite.height + 1;
      // The next zero control long remains the terminator until reuse.
    }
    for (let channel = 0; channel < 8; channel++) {
      if (!available[channel]) continue;
      const sprite = published.get(channel);
      if (!sprite) continue;
      const count = sprite.depth >= 4 ? 2 : 1;
      if (count === 2 && (channel & 1)) { available[channel++] = false; }
      for (let strip = 0; strip < sprite.width / 16 && channel < 8; strip++) {
        for (let part = 0; part < count && channel < 8; part++, channel++) {
          available[channel] = false; append(channel, sprite, strip, part);
        }
      }
      channel--;
    }
    if (!available.some(Boolean)) return;
    // Hss20 sorts shared objects by unwrapped top, breaking ties by number.
    const computed = [...published.values()].filter(s => s.number >= 8).sort((a,b) => a.y-b.y || a.number-b.number);
    let cursor = available.indexOf(true);
    function nextFree(start) {
      for (let n = 0; n < 8; n++) { const c = (start+n)%8; if (available[c]) return c; }
      return -1;
    }
    for (const sprite of computed) {
      cursor = nextFree(cursor);
      const count = sprite.depth >= 4 ? 2 : 1;
      if (count === 2 && (cursor & 1)) cursor = (cursor+1)%8;
      for (let strip = 0; strip < sprite.width / 16; strip++) {
        let found = false;
        for (let attempt = 0; attempt < 8/count; attempt++) {
          const channels = Array.from({length:count}, (_,i)=>cursor+i);
          if (channels.every(c => available[c] && sprite.y >= bottom[c] && used[c]+sprite.height+1 < rows-2)) {
            for (let part = 0; part < count; part++) append(cursor+part, sprite, strip, part);
            found = true; break;
          }
          if (attempt < 8/count-1) cursor = (cursor+count)%8;
        }
        if (!found) break; // HsA4a: drop the unallocated remainder, no spill.
        if (count === 1 || strip === sprite.width/16-1) cursor = (cursor+count)%8;
      }
    }
  }

  function update(frames) {
    for (const sprite of frames.values()) {
      if (!Number.isInteger(sprite.width) || sprite.width < 16 || sprite.width % 16 !== 0 || !Number.isInteger(sprite.height) || sprite.height < 1 || (sprite.number < 8 && sprite.height + 1 >= rows - 2) ||
          !Number.isInteger(sprite.depth) || sprite.depth < 1 || sprite.depth > 6 || !sprite.pixels || Object.prototype.toString.call(sprite.pixels) !== '[object Uint8Array]' || sprite.pixels.length !== sprite.height * sprite.width) throw new Error('Invalid direct Sprite buffer image');
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
      for (let row = 0; row < rows-1;) {
        const record = column + row*4, pos = readWord(record), ctl = readWord(record+2);
        if (pos === 0 && ctl === 0) break;
        const x = ((pos & 255) << 1) | (ctl & 1);
        const y = (pos >>> 8) | ((ctl & 4) << 6);
        const end = (ctl >>> 8) | ((ctl & 2) << 7), height = (end-y+512)&511;
        if (!height || row+height+1 >= rows) break;
        const left = (x-frame.origin.x)*frame.samplesPerLowresPixel;
        for (let line = 0; line < frame.lines; line++) {
          const sourceY = frame.origin.y+line-y;
          if (sourceY < 0 || sourceY >= height) continue;
          const at = line*32+channel*4;
          frame.lineSprites[at] = left >>> 0;
          frame.lineSprites[at+1] = readWord(record+4+sourceY*4);
          frame.lineSprites[at+2] = readWord(record+6+sourceY*4);
          frame.lineSprites[at+3] = 0x80000000 | (ctl&128 ? 1 : 0);
          frame.lineRegs[line*32+16] |= 4;
        }
        row += height+1;
      }
    }
  }
  return { resize, clear, update, setPointerVisible, publish, layout,
    snapshot: () => ({ ...layout(), bytes: storage.slice() }) };
}
if (typeof module === 'object' && module.exports) module.exports = createSpriteBuffer;
else globalThis.AMOS_SPRITE_BUFFER = createSpriteBuffer;
