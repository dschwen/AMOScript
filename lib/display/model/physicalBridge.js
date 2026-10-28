/* jshint esversion: 6 */
'use strict';

function createPhysicalBridge(display, options, ChipMemory, snapshotModel, staticFrame, copperBuilder, copperInterpreter) {
  const memory = new ChipMemory(options.snapshotChipBytes);
  const records = new Map();
  let revision = 0;
  let copperAllocation = null;
  function prune() {
    for (const [target, buffers] of records) {
      const active = display.screens.get(target.id) === target || (display.isPresented && display.isPresented(target));
      for (const [buffer, record] of buffers) {
        if (active && (buffer === target.pixels || buffer === target.physicalPixels)) continue;
        memory.free(record.allocation); buffers.delete(buffer);
      }
      if (!active) records.delete(target);
    }
    if (!records.size && copperAllocation) { memory.free(copperAllocation); copperAllocation = null; }
  }
  function prepare(target) {
    prune();
    if (!ArrayBuffer.isView(target.physicalPixels) ||
        Object.prototype.toString.call(target.physicalPixels) !== '[object Uint8Array]' ||
        target.physicalPixels.length !== target.width * target.height) throw new Error('Invalid physical indexed buffer');
    const rowBytes = Math.ceil(target.width / 16) * 2, depth = Math.log2(target.colours);
    let buffers = records.get(target);
    if (!buffers) { buffers = new Map(); records.set(target, buffers); }
    let record = buffers.get(target.physicalPixels);
    if (!record) {
      const allocation = memory.allocate(rowBytes * target.height * depth);
      record = { allocation, packed: new Uint8Array(allocation.length) };
      buffers.set(target.physicalPixels, record);
    }
    // Repack exposed indexed arrays in full, including unannounced host writes.
    // Padding is always zero. writeBytes compares bytes and tracks only changes.
    const packed = record.packed;
    packed.fill(0);
    for (let y = 0; y < target.height; y++) for (let x = 0; x < target.width; x++) {
      const index = target.physicalPixels[y * target.width + x];
      if (index >= target.colours) throw new Error('Invalid indexed pixel in physical screen');
      for (let plane = 0; plane < depth; plane++) if (index & (1 << plane)) {
        packed[plane * rowBytes * target.height + y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
    memory.writeBytes(record.allocation.address, packed);
    const pointers = Array.from({ length: depth }, (_, plane) => record.allocation.address + plane * rowBytes * target.height);
    return { width: target.width, height: target.height, depth, pointers, rowBytes,
      palette: target.palette, hires: target.mode === 0x8000, ham: target.ham, x: target.hardwareX, y: target.hardwareY,
      bplcon2: (target.spritePriority << 3) | target.spritePriority };
  }
  function snapshot(target) {
    const { rowBytes, depth, pointers } = prepare(target);
    const frame = staticFrame({ width: target.width, height: target.height, depth, pointers, rowBytes,
      palette: target.palette, hires: target.mode === 0x8000, ham: target.ham, revision: ++revision,
      videoRate: options.snapshotVideoRate, pixelAspect: options.snapshotPixelAspect,
      origin: { x: target.hardwareX, y: target.hardwareY } });
    return snapshotModel.createSnapshot({ chip: memory.bytes, frame });
  }
  function snapshotDisplay(targets, geometry, windows = null) {
    if (!targets.length) throw new Error('Display snapshot needs at least one screen');
    let views = targets.map((target, index) => {
      const view = prepare(target), window = windows ? windows[index] : target.windowed ? {
        x: target.hardwareX, y: target.hardwareY, width: target.windowWidth, height: target.windowHeight,
        offsetX: target.offsetX, offsetY: target.offsetY } : null;
      if (!window) return view;
      const { offsetX, offsetY } = window;
      if (offsetX + window.width > target.width || offsetY + window.height > target.height) throw new Error('Screen window extends outside physical bitmap');
      const fine = offsetX & 15;
      const delay = fine ? (view.hires ? 8 - (fine >> 1) : 16 - fine) : 0;
      return { ...view, width: window.width, height: window.height, x: window.x, y: window.y,
        pointers: view.pointers.map(pointer => pointer + offsetY * view.rowBytes + (offsetX >> 4) * 2),
        scroll: delay | (delay << 4), fetchAdvance: view.hires ? 4 : 8 };
    });
    const originalViews = views;
    const bounds = windows ? display.windowGeometry(windows, geometry.standard) : null;
    if (bounds) views = views.filter(view => view.y < bounds.end && view.y + view.height > 26).map(view => {
      const top = Math.max(26, view.y), bottom = Math.min(bounds.end, view.y + view.height);
      return { ...view, y: top, height: bottom - top, dmaWindow: view.y < 26 || bottom < 128,
        pointers: view.pointers.map(pointer => pointer + (top - view.y) * view.rowBytes) };
    });
    const overlap = views.some((view, index) => views.slice(index + 1).some(other => view.y < other.y + other.height && other.y < view.y + view.height));
    if (windows && (windows.some(window => window.priority) || overlap || views.some(view => view.y > 255))) {
      // Native MkD/MkA chooses one screen for each horizontal slice. A switch
      // starts with DMA disabled on a setup row, never a software overlay.
      const hardwareWidth = views.length ? views[0].width / (views[0].hires ? 2 : 1) : 0;
      if (views.some(view => {
        const neighbours = views.filter(other => other !== view && view.y < other.y + other.height && other.y < view.y + view.height);
        return view.ham || view.scroll || view.x !== 128 || view.palette[0] !== views[0].palette[0] || view.width / (view.hires ? 2 : 1) !== hardwareWidth ||
          neighbours.some(other => view.hires || other.hires || view.width !== other.width || view.palette[0] !== other.palette[0]);
      })) {
        throw new Error('Screen priority requires equal-width lowres windows with shared background for overlaps, and aligned equal hardware widths with shared background');
      }
      const boundaries = [...new Set(views.flatMap(view => [view.y, view.y + view.height]))].sort((a, b) => a - b);
      const slices = [];
      for (let i = 0; i < boundaries.length - 1; i++) {
        const y = boundaries[i], end = boundaries[i + 1];
        const owner = views.find(view => view.y <= y && view.y + view.height > y);
        if (!owner) continue;
        const last = slices[slices.length - 1];
        if (last && last.owner === owner && last.end === y) last.end = end;
        else slices.push({ owner, y, end });
      }
      views = slices.map((slice, index) => {
        const previous = slices[index - 1], next = slices[index + 1];
        // A foreground start blanks its preceding row; resuming a lower
        // screen blanks its first row (native start/end cut boundaries).
        const resume = previous && previous.end === slice.y && slice.owner.y < slice.y;
        const y = slice.y + (resume ? 1 : 0);
        const end = slice.end - (next && next.y === slice.end && next.owner.y === next.y ? 1 : 0);
        if (end < y) throw new Error('Screen priority slice is too short for setup');
        return { ...slice.owner, y, windowY: Math.min(slice.owner.y, 255), windowEnd: slice.owner.y + slice.owner.height, height: end - y, setupOnly: end === y,
          pointers: slice.owner.pointers.map(pointer => pointer + (y - slice.owner.y) * slice.owner.rowBytes),
          blankSetup: index > 0 };
      });
    }
    views.sort((a, b) => a.y - b.y);
    views = views.map((view, index) => view.dmaWindow ? { ...view, windowY: 1,
      windowEnd: options.snapshotStandard === 'NTSC' ? 261 : 311, blankSetup: index > 0 } :
      view.y > 255 ? { ...view, windowY: 255, blankSetup: index > 0 } : view);
    const top = bounds ? bounds.top : Math.min(...views.map(view => view.y));
    const compiled = copperBuilder(views, { origin: { x: 128, y: top },
      outputWidth: bounds ? (bounds.right - bounds.left) * 2 : Math.max(...views.map(view => view.width * (view.hires ? 1 : 2))),
      lines: bounds ? bounds.bottom - top : Math.max(...views.map(view => view.y + view.height)) - top,
      backgroundPalette: originalViews[0].palette,
      standard: options.snapshotStandard, videoRate: options.snapshotVideoRate,
      paletteRows: display.paletteRows ? display.paletteRows(views.length ? views : originalViews) : [],
      pixelAspect: options.snapshotPixelAspect || { numerator: 1, denominator: views.length === 1 && views[0].hires ? 1 : 2 }, ...geometry });
    if (copperAllocation) { memory.free(copperAllocation); copperAllocation = null; }
    copperAllocation = memory.allocate(compiled.bytes.length);
    memory.writeBytes(copperAllocation.address, compiled.bytes);
    const result = copperInterpreter(memory.bytes, { ...compiled.interpretOptions, initialRegisters: compiled.initialRegisters,
      address: copperAllocation.address, revision: ++revision }).snapshot;
    if (display.writeSprites) display.writeSprites(result.frame);
    for (const view of views.filter(view => view.blankSetup)) {
      const row = view.y - 1 - result.frame.origin.y;
      const active = row >= 0 && row < result.frame.lines && result.frame.lineSprites.subarray(row * 32, (row + 1) * 32).some((value, index) => index % 4 === 3 && (value & 0x80000000));
      if (active && !compiled.spriteSafeSetupRows.includes(view.y - 1)) throw new Error('Sprite palette changes exceed screen setup capture budget');
    }
    return snapshotModel.createSnapshot(result);
  }
  return { snapshot, snapshotDisplay, prune };
}

module.exports = createPhysicalBridge;
