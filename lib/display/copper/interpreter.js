/* jshint esversion: 6 */
'use strict';

function createCopperInterpreter(snapshotModel, registerModel, spriteDmaFactory) {
  const { R, fetchBytes, dataFetchPosition, fetchOffset } = registerModel;
  return function interpret(chip, options = {}) {
    let line = 0, horizontal = 0, elapsed = 0, pc = options.address, instructions = 0;
    const fail = message => { throw new Error(`Copper: ${message} at byte ${pc}, beam ${line}:${horizontal}`); };
    if (!ArrayBuffer.isView(chip) || Object.prototype.toString.call(chip) !== '[object Uint8Array]' ||
        ![524288, 1048576, 2097152].includes(chip.length)) fail('invalid chip memory');
    const standard = options.standard || 'PAL';
    if (!['PAL', 'NTSC'].includes(standard)) fail('unsupported video standard');
    const fieldLines = standard === 'PAL' ? 312 : 262;
    const origin = options.origin || { x: 128, y: 50 };
    const width = options.outputWidth == null ? 640 : options.outputWidth;
    const lines = options.lines == null ? 200 : options.lines;
    if (!Number.isInteger(origin.x) || origin.x < 0 || !Number.isInteger(origin.y) || origin.y < 0 ||
        !Number.isInteger(width) || width < 1 || origin.x * 2 + width > 908 ||
        !Number.isInteger(lines) || lines < 1 || origin.y + lines > fieldLines) fail('invalid physical crop');
    const maxInstructions = options.maxInstructions == null ? 65536 : options.maxInstructions;
    const maxEvents = options.maxEvents == null ? 32 : options.maxEvents;
    const maxTotalEvents = options.maxTotalEvents == null ? 65536 : options.maxTotalEvents;
    const busyUntil = options.blitterBusyUntil == null ? 0 : options.blitterBusyUntil;
    if (!Number.isInteger(maxInstructions) || maxInstructions < 1 || maxInstructions > 1000000 ||
        !Number.isInteger(maxEvents) || maxEvents < 1 || maxEvents > 256 ||
        !Number.isInteger(maxTotalEvents) || maxTotalEvents < 0 || maxTotalEvents > 65536 ||
        !Number.isSafeInteger(busyUntil) || busyUntil < 0) fail('invalid resource/timing limit');
    const registers = new Uint16Array(256);
    if (options.initialRegisters) {
      if (!ArrayBuffer.isView(options.initialRegisters) || Object.prototype.toString.call(options.initialRegisters) !== '[object Uint16Array]' ||
          options.initialRegisters.length !== 256) fail('invalid initial register table');
      registers.set(options.initialRegisters);
    } else registers[R.DMACON / 2] = 0x380;
    function checkPc(address) {
      if (!Number.isSafeInteger(address) || address < 0 || address % 2 || address > chip.length - 4) fail('invalid instruction pointer');
    }
    checkPc(pc);
    registers[R.COP1LCH / 2] = pc >>> 16; registers[R.COP1LCL / 2] = pc & 65535;
    const frame = { schemaVersion: 1, revision: options.revision == null ? 0 : options.revision,
      chipset: 'OCS', samplesPerLowresPixel: 2, outputWidth: width, outputHeight: lines, lines,
      interlaceField: null, maxEvents, origin: { ...origin },
      videoRate: options.videoRate || { numerator: standard === 'PAL' ? 50 : 60, denominator: 1 },
      pixelAspect: options.pixelAspect || { numerator: 1, denominator: 2 },
      lineRegs: new Uint32Array(lines * 32), linePal: new Uint8Array(lines * 1024),
      lineSprites: new Uint32Array(lines * 32), lineEvents: new Uint32Array(lines * maxEvents * 4),
      eventOffsets: new Uint32Array(lines + 1), overflowEvents: new Uint32Array(0) };
    const events = Array.from({ length: lines }, () => []);
    let totalEvents = 0, fetched = null, captured = false, halted = false;
    const get = reg => registers[reg / 2];
    const set = (reg, value) => { registers[reg / 2] = value; };
    const pointer = reg => get(reg) * 65536 + (get(reg + 2) & 0xfffe);
    const setPointer = (reg, value) => {
      if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff || value % 2) fail('bitplane pointer arithmetic overflow');
      set(reg, value >>> 16); set(reg + 2, value & 65535);
    };
    const verticalWindow = () => {
      const start = get(R.DIWSTRT) >> 8, low = get(R.DIWSTOP) >> 8;
      return line >= start && line < (low | (low & 128 ? 0 : 256));
    };
    const dma = () => (get(R.DMACON) & 0x300) === 0x300;
    const spriteDma = spriteDmaFactory(chip, registers, { ...options, standard }, fail, event,
      () => !!(fetched && !fetched.finished));
    function saveFetch() {
      const outputLine = line - origin.y;
      if (!fetched || outputLine < 0 || outputLine >= lines) return;
      const row = outputLine * 32;
      for (let plane = 0; plane < fetched.pointers.length; plane++) frame.lineRegs[row + plane] = fetched.pointers[plane];
      frame.lineRegs[row + 16] |= 2;
      const offset = fetchOffset(fetched.control, fetched.start);
      frame.lineRegs[row + 15] = offset >>> 0;
      const start = frame.lineRegs[row + 13] | 0, stop = frame.lineRegs[row + 14] | 0;
      if (verticalWindow() && Math.min(width, stop) > Math.max(0, start)) {
        const samples = fetched.control & 0x8000 ? 1 : 2;
        for (let plane = 0; plane < fetched.pointers.length; plane++) {
          const delay = ((get(R.BPLCON1) >> (plane % 2 ? 4 : 0)) & 15) * (fetched.control & 0x8000 ? 2 : 1);
          if (Math.floor((Math.min(width, stop) - 1 - start) / samples) + offset - delay >= fetched.bytes * 8) fail('visible window exceeds fetched data');
        }
      }
    }
    function capture() {
      captured = true;
      const outputLine = line - origin.y;
      if (outputLine < 0 || outputLine >= lines) return;
      const row = outputLine * 32;
      frame.lineRegs[row + 8] = fetched ? fetched.control : get(R.BPLCON0);
      frame.lineRegs[row + 9] = get(R.BPLCON1); frame.lineRegs[row + 10] = get(R.BPLCON2);
      const start = ((get(R.DIWSTRT) & 255) - origin.x) * 2;
      const stop = (((get(R.DIWSTOP) & 255) | 256) - origin.x) * 2;
      frame.lineRegs[row + 13] = start >>> 0; frame.lineRegs[row + 14] = stop >>> 0;
      frame.lineRegs[row + 16] = (verticalWindow() ? 1 : 0) | (fetched ? 2 : 0) |
        ((get(R.DMACON) & 0x220) === 0x220 ? 4 : 0);
      spriteDma.capture(frame, outputLine);
      saveFetch();
      for (let colour = 0; colour < 256; colour++) {
        const value = colour < 32 ? get(R.COLOR00 + colour * 2) : 0, at = outputLine * 1024 + colour * 4;
        frame.linePal[at] = ((value >> 8) & 15) * 17; frame.linePal[at + 1] = ((value >> 4) & 15) * 17;
        frame.linePal[at + 2] = (value & 15) * 17; frame.linePal[at + 3] = 255;
      }
    }
    function tick() {
      spriteDma.tick(line, horizontal);
      if (!fetched && horizontal === dataFetchPosition(get(R.BPLCON0), get(R.DDFSTRT)) && verticalWindow() && dma()) {
        const control = get(R.BPLCON0), count = (control >> 12) & 7;
        if (control & ~0xfe00 || count > 6 || (control & 0x8000 && count > 4)) fail('unsupported OCS bitplane mode');
        if (count) {
          let length;
          try { length = fetchBytes(control, get(R.DDFSTRT), get(R.DDFSTOP)); } catch (error) { fail(error.message); }
          const pointers = Array.from({ length: count }, (_, plane) => pointer(R.BPL1PTH + plane * 4));
          for (const address of pointers) if (address % 2 || address > chip.length - length) fail('bitplane fetch out of bounds');
          fetched = { pointers, control, bytes: length, start: dataFetchPosition(control, get(R.DDFSTRT)),
            end: dataFetchPosition(control, get(R.DDFSTOP)) + 8, finished: false };
          if (captured) saveFetch();
        }
      }
      if (fetched && !fetched.finished && horizontal >= fetched.end) {
        for (let plane = 0; plane < fetched.pointers.length; plane++) {
          const mod = (get(plane % 2 ? R.BPL2MOD : R.BPL1MOD) & 0xfffe) << 16 >> 16;
          setPointer(R.BPL1PTH + plane * 4, fetched.pointers[plane] + fetched.bytes + mod);
        }
        fetched.finished = true;
      }
      if (!captured && horizontal * 2 >= origin.x) capture();
    }
    function advance(clocks) {
      for (let i = 0; i < clocks && line < fieldLines; i++) {
        horizontal++; elapsed++;
        const length = standard === 'NTSC' && line % 2 ? 228 : 227;
        if (horizontal >= length) {
          if (!captured) capture();
          line++; horizontal = 0; fetched = null; captured = false;
        }
        if (line < fieldLines) tick();
      }
    }
    function compare(first, second) {
      const mask = (second & 0x7ffe) | 0x8000;
      const beam = ((line & 255) << 8) | (horizontal & 0xfe);
      return (beam & mask) >= (first & mask) && ((second & 0x8000) || elapsed >= busyUntil);
    }
    function event(reg, value) {
      const outputLine = line - origin.y, x = horizontal * 4 - origin.x * 2;
      if (outputLine < 0 || outputLine >= lines || x >= width) return;
      const mode = [R.BPLCON0, R.BPLCON1, R.BPLCON2].includes(reg);
      if (x < 0 && !(mode && fetched)) return;
      if (++totalEvents > maxTotalEvents) fail('event storage limit exceeded');
      events[outputLine].push(x >>> 0, reg, value, 0);
    }
    function move(reg, value) {
      const palette = reg >= R.COLOR00 && reg <= R.COLOR00 + 62;
      const bitplanePointer = reg >= R.BPL1PTH && reg < R.BPL1PTH + 32;
      if (reg === R.NOOP) return;
      const spriteRegister = spriteDma.handles(reg);
      const supported = palette || bitplanePointer || spriteRegister || Object.values(R).includes(reg);
      if (reg < 0x80 || !supported) fail(`unsupported/protected register $${reg.toString(16)}`);
      if (fetched && !fetched.finished && (bitplanePointer ||
          [R.DIWSTRT, R.DIWSTOP, R.DDFSTRT, R.DDFSTOP, R.DMACON].includes(reg) ||
          (reg === R.BPLCON0 && ((get(reg) ^ value) & 0xf000)))) fail('DMA configuration writes during active fetch are not implemented');
      if (palette || (spriteRegister && reg >= R.SPR0POS) || [R.BPLCON0, R.BPLCON1, R.BPLCON2, R.DIWSTRT, R.DIWSTOP, R.DDFSTRT, R.DDFSTOP, R.DMACON].includes(reg)) event(reg, value);
      if (reg === R.DMACON) set(reg, value & 0x8000 ? get(reg) | (value & 0x7fff) : get(reg) & ~value);
      else if (spriteRegister) spriteDma.write(reg, value, line);
      else set(reg, value);
      if (reg === R.COPJMP1 || reg === R.COPJMP2) { pc = pointer(reg === R.COPJMP1 ? R.COP1LCH : R.COP2LCH); checkPc(pc); }
    }
    tick();
    while (line < fieldLines) {
      if (halted || (get(R.DMACON) & 0x280) !== 0x280) { advance(1); continue; }
      if (++instructions > maxInstructions) fail('instruction budget exceeded');
      checkPc(pc);
      const first = chip[pc] * 256 + chip[pc + 1], second = chip[pc + 2] * 256 + chip[pc + 3];
      pc += 4; advance(4);
      if (line >= fieldLines) break;
      if (!(first & 1)) {
        if (first > 0x1fe) fail('invalid MOVE register address');
        move(first, second);
      } else if (second & 1) {
        if (compare(first, second)) pc += 4;
      } else {
        if (first === 0xffff && second === 0xfffe) { halted = true; continue; }
        while (line < fieldLines && !compare(first, second)) advance(1);
        advance(2); // WAIT wake-up; MOVE/SKIP use four colour clocks, WAIT six.
      }
    }
    const overflow = [];
    for (let y = 0; y < lines; y++) {
      const words = events[y], count = words.length / 4;
      frame.lineRegs[y * 32 + 17] = count;
      frame.lineEvents.set(words.slice(0, maxEvents * 4), y * maxEvents * 4);
      frame.eventOffsets[y] = overflow.length / 4;
      if (count > maxEvents) for (const word of words) overflow.push(word);
    }
    frame.eventOffsets[lines] = overflow.length / 4;
    frame.overflowEvents = Uint32Array.from(overflow);
    return { snapshot: snapshotModel.createSnapshot({ chip, frame }),
      diagnostics: { instructions, pc, elapsed, stopped: halted, registers: registers.slice(), spriteWords: spriteDma.words } };
  };
}

module.exports = createCopperInterpreter(require('../model/frameState'), require('../model/registers'), require('./spriteDma'));
module.exports.createCopperInterpreter = createCopperInterpreter;
