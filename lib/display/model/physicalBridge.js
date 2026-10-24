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
  function snapshotDisplay(targets, geometry) {
    if (!targets.length) throw new Error('Display snapshot needs at least one screen');
    const views = targets.map(prepare), top = Math.min(...views.map(view => view.y));
    const compiled = copperBuilder(views, { origin: { x: 128, y: top },
      outputWidth: Math.max(...views.map(view => view.width * (view.hires ? 1 : 2))),
      lines: Math.max(...views.map(view => view.y + view.height)) - top,
      standard: options.snapshotStandard, videoRate: options.snapshotVideoRate,
      paletteRows: display.paletteRows ? display.paletteRows(views) : [],
      pixelAspect: options.snapshotPixelAspect || { numerator: 1, denominator: views.length === 1 && views[0].hires ? 1 : 2 }, ...geometry });
    if (copperAllocation) { memory.free(copperAllocation); copperAllocation = null; }
    copperAllocation = memory.allocate(compiled.bytes.length);
    memory.writeBytes(copperAllocation.address, compiled.bytes);
    const result = copperInterpreter(memory.bytes, { ...compiled.interpretOptions, initialRegisters: compiled.initialRegisters,
      address: copperAllocation.address, revision: ++revision }).snapshot;
    if (display.writeSprites) display.writeSprites(result.frame);
    return snapshotModel.createSnapshot(result);
  }
  return { snapshot, snapshotDisplay, prune };
}

module.exports = createPhysicalBridge;
