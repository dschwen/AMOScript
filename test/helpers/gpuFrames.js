/* jshint esversion: 6 */
'use strict';

function createGpuFrames(staticFrame, build, interpret, registers) {
  const palette = Array.from({ length: 32 }, (_, i) => ((i & 15) << 8) | (((i * 3 + 1 + (i >> 4) * 7) & 15) << 4) | ((i * 7 + 5) & 15));
  function blank(width, height, depth = 2, hires = false, stride = null) {
    const rowBytes = stride || Math.ceil(width / 16) * 2;
    const chip = new Uint8Array(524288), frame = staticFrame({ width, height, depth, hires, rowBytes,
      pointers: Array.from({ length: depth }, (_, plane) => plane * rowBytes * height), palette });
    return { chip, frame };
  }
  function put(frame, line, channel, start, a, b, attached = false) {
    frame.lineSprites.set([start >>> 0, a, b, 0x80000000 | (attached ? 1 : 0)], line * 32 + channel * 4);
  }
  function named() {
    const cases = [];
    for (const hires of [false, true]) {
      const snapshot = blank(47, 1, hires ? 4 : 6, hires), { chip, frame } = snapshot;
      const pointers = [2046, 4094, chip.length - 6, 8190, 16382, 65534];
      for (let plane = 0; plane < (hires ? 4 : 6); plane++) {
        frame.lineRegs[plane] = pointers[plane];
        chip.set([0x81, 0x7e, 0xa5, 0x3c, 0xf0, 0x55].map(value => value ^ (plane * 51)), pointers[plane]);
      }
      cases.push({ name: `chip-row-boundaries-${hires}`, snapshot });
    }
    const extreme = blank(17, 1, 1, true);
    extreme.frame.lineRegs[8] = 0x8000; extreme.frame.lineRegs[13] = 0x80000000;
    put(extreme.frame, 0, 0, -2147483648, 0xffff, 0xffff); put(extreme.frame, 0, 1, 2147483647, 0xffff, 0xffff);
    cases.push({ name: 'signed-window-zero-planes', snapshot: extreme });
    for (const hires of [false, true]) for (const offset of [0, hires ? 32 : 16, -7]) {
      const snapshot = blank(49, 256, hires ? 4 : 6, hires, 12), { chip, frame } = snapshot;
      for (let i = 0; i < 12 * 256 * (hires ? 4 : 6); i++) chip[i] = (i * 37 + (i >> 3) * 11) & 255;
      for (let line = 0; line < 256; line++) {
        const row = line * 32;
        frame.lineRegs[row + 9] = line; frame.lineRegs[row + 15] = offset >>> 0;
        frame.lineRegs[row + 13] = (-3) >>> 0; frame.lineRegs[row + 14] = frame.outputWidth - 5;
        if (line % 17 === 0) frame.lineRegs[row + 16] &= ~2;
        if (line % 19 === 0) frame.lineRegs[row + 16] &= ~1;
        if (line % 23 === 0) frame.lineRegs[row + 8] &= 0x8fff;
      }
      cases.push({ name: `scroll-${hires ? 'hi' : 'lo'}-${offset}`, snapshot });
    }
    for (const depth of [2, 4, 6]) for (const front of [false, true]) {
      const snapshot = blank(64, 2, depth), { chip, frame } = snapshot;
      for (let y = 0; y < 2; y++) for (let x = 0; x < 64; x++) for (let plane = 0; plane < depth; plane++) {
        if (((x + y) & ((1 << depth) - 1)) & (1 << plane)) chip[plane * 16 + y * 8 + (x >> 3)] |= 0x80 >> (x & 7);
      }
      for (let y = 0; y < 2; y++) { frame.lineRegs[y * 32 + 8] |= 0x400; frame.lineRegs[y * 32 + 10] = front ? 64 : 0; }
      cases.push({ name: `dpf-${depth}-${front}`, snapshot });
    }
    const priority = blank(32, 880), { chip, frame } = priority;
    let line = 0;
    for (const front of [false, true]) for (let p1 = 0; p1 < 5; p1++) for (let p2 = 0; p2 < 5; p2++) {
      for (let raw = 0; raw < 4; raw++) for (let pair = 0; pair < 4; pair++, line++) {
        if (raw & 1) chip[line * 4] = 0x80;
        if (raw & 2) chip[880 * 4 + line * 4] = 0x80;
        frame.lineRegs[line * 32 + 8] |= 0x400;
        frame.lineRegs[line * 32 + 10] = p1 | (p2 << 3) | (front ? 64 : 0);
        put(frame, line, pair * 2, 0, 0x8000, 0);
      }
    }
    for (let p = 0; p < 5; p++) for (let pair = 0; pair < 4; pair++) for (let raw = 0; raw < 4; raw++, line++) {
      if (raw & 1) chip[line * 4] = 0x80;
      if (raw & 2) chip[880 * 4 + line * 4] = 0x80;
      frame.lineRegs[line * 32 + 10] = (p << 3) | (4 - p);
      put(frame, line, pair * 2 + (raw & 1), 0, 0x8000, 0);
    }
    cases.push({ name: 'sprite-priority-matrix', snapshot: priority });
    for (const hires of [false, true]) for (const samples of [2, 4]) {
      const snapshot = blank(128, 36, 2, hires), { frame } = snapshot;
      if (samples === 4) { frame.chipset = 'ECS'; frame.samplesPerLowresPixel = 4; }
      for (let y = 0; y < 36; y++) frame.lineRegs[y * 32 + 10] = 0x24;
      let y = 0;
      for (let channel = 0; channel < 8; channel++) for (const x of [-1, 1, frame.outputWidth - 3]) put(frame, y++, channel, x, 0xa001, 0x6001);
      for (let pair = 0; pair < 4; pair++, y++) {
        put(frame, y, pair * 2, 0, 0x5555, 0x3333); put(frame, y, pair * 2 + 1, 0, 0x0f0f, 0x00ff, true);
      }
      for (let pair = 0; pair < 4; pair++, y++) {
        put(frame, y, pair * 2, -1, 0x8001, 0); put(frame, y, pair * 2 + 1, 1, 0x8001, 0, true);
      }
      // Lower-numbered overlap wins; sprite DMA need not be enabled for arming.
      for (let channel = 7; channel >= 0; channel--) put(frame, 32, channel, 0, 0xffff, channel & 1 ? 0xffff : 0);
      cases.push({ name: `sprites-${hires}-${samples}`, snapshot });
    }
    const scene = new Uint8Array(524288), view = new DataView(scene.buffer);
    const write = (at, words) => words.forEach((word, i) => view.setUint16(at + i * 2, word, false));
    for (let i = 0x1000; i < 0x4000; i++) scene[i] = (i * 13 + (i >> 5)) & 255;
    write(0x5000, [0x7a41, 0x7c00, 0x8000, 0, 0x4000, 0, 0x7e4b, 0x7f01, 0, 0x8000, 0, 0]);
    write(0x5040, [0x8241, 0x8300, 0x8000, 0, 0, 0]);
    const compiled = build([
      { x: 128, y: 120, width: 320, height: 8, depth: 1, pointers: [0x1000], rowBytes: 40, palette, bplcon2: 0x24 },
      { x: 128, y: 128, width: 640, height: 8, depth: 2, hires: true, pointers: [0x2000, 0x3000], rowBytes: 80, palette, bplcon2: 0x24 }
    ], { origin: { x: 128, y: 120 }, lines: 16, spritePointers: [0x5000, 0x6000, 0x5040, ...new Array(5).fill(0x6000)] });
    scene.set(compiled.bytes, 0x7000);
    cases.push({ name: 'copper-stack-dma', snapshot: interpret(scene, { ...compiled.interpretOptions,
      initialRegisters: compiled.initialRegisters, address: 0x7000 }).snapshot });
    const initial = new Uint16Array(256), { R } = registers;
    initial[R.DMACON / 2] = 0x380; initial[R.DIWSTRT / 2] = 0x80; initial[R.DIWSTOP / 2] = 0x8000;
    initial[R.BPLCON0 / 2] = 0x2000; initial[(R.BPL1PTH + 2) / 2] = 0x1000;
    initial[(R.BPL1PTH + 6) / 2] = 0x2000; initial[R.BPL1MOD / 2] = 0xfffe;
    initial[R.DDFSTRT / 2] = 0x38; initial[R.DDFSTOP / 2] = 0x38;
    initial[(R.COLOR00 + 2) / 2] = 0xf00; initial[(R.COLOR00 + 4) / 2] = 0x0f0;
    write(0, [0x0101, 0xfffe, 0x180, 0x123, 0x0201, 0xfffe, 0x180, 0x456, 0xffff, 0xfffe]);
    cases.push({ name: 'copper-modulo-palette', snapshot: interpret(scene, { initialRegisters: initial, address: 0,
      origin: { x: 128, y: 0 }, lines: 4, outputWidth: 16 }).snapshot });
    return cases;
  }
  function random(seed) {
    let value = seed >>> 0;
    const next = maximum => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value % maximum; };
    const width = 1 + next(79), height = 1 + next(12), depth = 1 + next(6), hires = depth <= 4 && !!next(2);
    const snapshot = blank(width, height, depth, hires, Math.max(16, Math.ceil(width / 16) * 2));
    const size = [524288, 1048576, 2097152][next(3)]; snapshot.chip = new Uint8Array(size);
    const { chip, frame } = snapshot;
    if (next(2)) { frame.chipset = 'ECS'; frame.samplesPerLowresPixel = 4; }
    for (let plane = 0; plane < depth; plane++) for (let i = 0; i < 256; i++) chip[size - 4096 + plane * 256 + i] = next(256);
    for (let line = 0; line < height; line++) {
      const row = line * 32, dual = !!next(2);
      for (let plane = 0; plane < depth; plane++) frame.lineRegs[row + plane] = size - 4096 + plane * 256 + next(12) * 16;
      frame.lineRegs[row + 8] = (next(depth + 1) << 12) | (hires ? 0x8000 : 0) | (dual ? 0x400 : 0);
      frame.lineRegs[row + 9] = next(256); frame.lineRegs[row + 10] = next(5) | (next(5) << 3) | (next(2) << 6);
      const start = next(41) - 20;
      frame.lineRegs[row + 13] = start >>> 0; frame.lineRegs[row + 14] = (start + 1 + next(frame.outputWidth + 20)) >>> 0;
      frame.lineRegs[row + 15] = (next(44) - 12) >>> 0; frame.lineRegs[row + 16] = next(8);
      for (let i = 0; i < 32; i++) {
        const rgb = next(4096), at = line * 1024 + i * 4;
        frame.linePal.set([((rgb >> 8) & 15) * 17, ((rgb >> 4) & 15) * 17, (rgb & 15) * 17, 255], at);
      }
      const channels = next(9);
      for (let channel = 0; channel < channels; channel++) put(frame, line, channel,
        next(frame.outputWidth + 64) - 32, next(65536), next(65536), !!((channel & 1) && next(2)));
    }
    return snapshot;
  }
  return { named, random };
}

module.exports = createGpuFrames;
