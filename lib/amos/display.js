/* jshint esversion: 6 */
'use strict';

const fontFactory = typeof module === 'object' && module.exports ? require('./font') : globalThis.AMOS_FONT;
const chipMemoryClass = typeof module === 'object' && module.exports ? require('../display/model/ChipMemory') : globalThis.AMOS_CHIP_MEMORY;
const frameStateModel = typeof module === 'object' && module.exports ? require('../display/model/frameState') : globalThis.AMOS_FRAME_STATE;
const staticFrameFactory = typeof module === 'object' && module.exports ? require('../display/model/staticFrame') : globalThis.AMOS_STATIC_FRAME;
const planarBridgeFactory = typeof module === 'object' && module.exports ? require('../display/model/physicalBridge') : globalThis.AMOS_PLANAR_BRIDGE;
const referenceRenderer = typeof module === 'object' && module.exports ? require('../display/reference/render') : globalThis.AMOS_REFERENCE_RENDERER;
const colorModel = typeof module === 'object' && module.exports ? require('../display/model/color') : globalThis.AMOS_COLOR_MODEL;
const spriteModel = typeof module === 'object' && module.exports ? require('../display/reference/sprites') : globalThis.AMOS_SPRITE_MODEL;
const copperBuilder = typeof module === 'object' && module.exports ? require('../display/copper/builder') : globalThis.AMOS_COPPER_BUILDER;
const copperInterpreter = typeof module === 'object' && module.exports ? require('../display/copper/interpreter') : globalThis.AMOS_COPPER_INTERPRETER;

// Indexed pixels are authoritative for both graphics and rasterized text.
function createDisplay(options = {}) {
  const font = options.font || fontFactory();
  const screens = new Map();
  const listeners = new Set();
  const screenListeners = new Set();
  let current = null;
  let version = 0;
  let drawingHooks = null;
  // The native window writer patches one shared mode/parts pair. Only windows
  // with their Writing flag set use it; opening a window resets the pair.
  let writingMode = 0, writingParts = 0;
  let spriteWriter = null;
  let planarBridge = null;
  let autoView = true, presented = null, presentedHardware = null;
  let presentedWindows = null;
  let priorityOrder = [], priorityEnabled = false;
  const rainbows = new Map();
  const palette = [0x000, 0xf80, 0xfff, 0x00f, 0xf00, 0x0f0, 0x080, 0xff0, 0x888, 0x444, 0xaaa, 0x666, 0x0ff, 0xf0f, 0x800, 0x008];

  function changed(viewChange = false) {
    version++;
    if (planarBridge) planarBridge.prune();
    if (viewChange) {
      if (!autoView) return;
      presented = visibleScreen();
      commitWindows();
    }
    listeners.forEach(listener => listener(version));
  }
  function whole(value) {
    if (!Number.isSafeInteger(value)) throw new Error('Display argument must be a safe integer');
    return value;
  }
  function screen(id = current) {
    const result = screens.get(id);
    if (!result) throw new Error(`Screen ${id} is not open`);
    return result;
  }
  function colourIndex(value, target = screen()) {
    if (!Number.isInteger(value) || value < 0 || value >= target.colours) throw new Error('Invalid colour index');
    return value;
  }
  function registerIndex(value) {
    return whole(value) & 31;
  }
  function visibleScreen() {
    if (priorityEnabled) return priorityOrder.map(id => screens.get(id)).find(target => target && !target.hidden) || null;
    const selected = screens.get(current);
    return selected && !selected.hidden ? selected : Array.from(screens.values()).find(target => !target.hidden) || null;
  }
  function checkClones(target) {
    if (target && Array.from(screens.values()).some(other => other.cloneOwner === target)) throw new Error('Close screen clones before replacing or closing their owner');
  }
  function open(id, width, height, colours, mode) {
    if (!Number.isInteger(id) || id < 0 || id > 7) throw new Error('Invalid screen number');
    if (!Number.isInteger(width) || width < 1 || width > 1024 || !Number.isInteger(height) || height < 1 || height > 1023) throw new Error('Invalid screen dimensions');
    if (![2, 4, 8, 16, 32, 64, 4096].includes(colours)) throw new Error('Unsupported screen colour mode');
    if (mode !== 0 && mode !== 0x8000) throw new Error('Unsupported screen resolution mode');
    if (mode === 0x8000 && colours > 16) throw new Error('Hires screens support at most 16 colours');
    checkClones(screens.get(id));
    const ham = colours === 4096;
    colours = ham ? 64 : colours;
    const paper = colours === 2 ? 0 : 1;
    const next = {
      id, width, height, colours, mode, ham, zones: null, hidden: false, cloneOwner: null,
      pixels: new Uint8Array(width * height),
      physicalPixels: null, doubleBuffered: false, autoback: 0,
      palette: Array.from({ length: 32 }, (_, i) => palette[i] == null ? 0 : palette[i]),
      hardwareX: 128, hardwareY: 50, spritePriority: 4,
      windowWidth: width, windowHeight: height, offsetX: 0, offsetY: 0, windowed: false,
      pen: colours === 2 ? 1 : 2, paper, ink: colours === 2 ? 1 : 2,
      inkBackground: 0, inkBorder: 0, linePattern: 65535, linePhase: 15, writingActive: false, x: 0, y: 0, gx: 0, gy: 0, tabSize: 4,
      columns: Math.floor(width / 8), rows: Math.floor(height / 8), cursorVisible: true
    };
    next.pixels.fill(paper);
    next.physicalPixels = next.pixels;
    screens.set(id, next);
    priorityOrder = [id, ...priorityOrder.filter(other => other !== id)];
    current = id;
    writingMode = writingParts = 0;
    screenListeners.forEach(listener => listener());
    changed(true);
    return next;
  }
  function select(id) { if (screen(id).cloneOwner) throw new Error('Cannot select a cloned screen'); current = id; changed(true); }
  function close(id) {
    checkClones(screen(id));
    screens.delete(id);
    priorityOrder = priorityOrder.filter(other => other !== id);
    if (current === id) { const next = Array.from(screens.values()).find(target => !target.cloneOwner); current = next ? next.id : null; }
    screenListeners.forEach(listener => listener());
    changed(true);
  }
  function commitWindows() {
    presentedHardware = presented ? { x: presented.hardwareX, y: presented.hardwareY,
      width: presented.width, height: presented.height, mode: presented.mode } : null;
    const targets = priorityEnabled ? priorityOrder.map(id => screens.get(id)).filter(target => target && !target.hidden) :
      priorityOrder.map(id => screens.get(id)).filter(target => target && target.windowed && !target.hidden);
    presentedWindows = targets.length ? targets.map(target => ({ target, x: target.hardwareX, y: target.hardwareY,
      width: target.windowWidth, height: target.windowHeight, offsetX: target.offsetX, offsetY: target.offsetY,
      priority: priorityEnabled })) : null;
  }
  function screenToFront(id = current) {
    screen(whole(id));
    priorityOrder = [id, ...priorityOrder.filter(other => other !== id)];
    priorityEnabled = true;
    changed(true);
  }
  function windowGeometry(windows = presentedWindows, standard = options.snapshotStandard) {
    const end = standard === 'NTSC' ? 260 : 310;
    const visible = windows.filter(window => window.y < end);
    const left = Math.min(...windows.map(window => window.x));
    const right = Math.max(...windows.map(window => window.x + window.width / (window.target.mode === 0x8000 ? 2 : 1)));
    const top = visible.length ? Math.min(...visible.map(window => window.y)) : 0;
    const bottom = visible.length ? Math.min(end, Math.max(...visible.map(window => window.y + window.height))) : end;
    return { left, top, right, bottom, end };
  }
  function view() { presented = visibleScreen(); commitWindows(); changed(); }
  function hideScreen(id = current) { screen(whole(id)).hidden = true; changed(true); }
  function showScreen(id = current) { screen(whole(id)).hidden = false; changed(true); }
  function clone(id) {
    whole(id);
    if (id < 0 || id > 7 || screens.has(id)) throw new Error('Invalid or already open clone screen');
    const owner = screen();
    if (owner.doubleBuffered || owner.cloneOwner) throw new Error('Cloning double-buffered screens or clones is not implemented');
    // Static bitmap aliases, with independent display state/palette. A clone is
    // not selectable; drawing continues on the original owner.
    const target = { ...owner, id, cloneOwner: owner, palette: owner.palette.slice(), zones: null };
    screens.set(id, target);
    priorityOrder = [id, ...priorityOrder.filter(other => other !== id)];
    screenListeners.forEach(listener => listener()); changed(true); return target;
  }
  function setAutoView(enabled) { autoView = enabled; if (enabled) view(); }
  function screenDisplay(id, x = null, y = null, width = null, height = null) {
    const target = screen(whole(id));
    [x, y, width, height].filter(value => value != null).forEach(whole);
    // The current OCS builder supports aligned windows at x=128 only.
    if (x != null && (x & 0xfffffff0) !== 128) throw new Error('Screen Display horizontal placement is not implemented');
    if (y != null && (y < 0 || y > 28671)) throw new Error('Unsupported Screen Display vertical placement');
    if ((width != null && (width < 0 || width > 65535)) || (height != null && (height < 0 || height > 65535))) throw new Error('Invalid Screen Display size');
    const hires = target.mode === 0x8000;
    const nextWidth = width == null || !(width & 0xfff0) ? target.windowWidth : Math.min(width & 0xfff0, target.width / (hires ? 2 : 1)) * (hires ? 2 : 1);
    const nextHeight = height == null || height === 0 ? target.windowHeight : Math.min(height, target.height);
    const bottom = (y == null ? target.hardwareY : y) + nextHeight;
    if (nextWidth / (hires ? 2 : 1) < 128 || nextWidth / (hires ? 2 : 1) > 320 || bottom < 128 ||
        bottom > 28671) throw new Error('Unsupported Screen Display window');
    target.hardwareX = 128;
    if (y != null) target.hardwareY = y;
    target.windowWidth = nextWidth; target.windowHeight = nextHeight; target.windowed = true;
    changed(true);
  }
  function screenOffset(id, x = null, y = null) {
    const target = screen(whole(id));
    [x, y].filter(value => value != null).forEach(whole);
    if ((x != null && (x < 0 || x >= target.width)) || (y != null && (y < 0 || y >= target.height))) throw new Error('Unsupported Screen Offset outside bitmap');
    if (target.ham && x != null && (x & 15)) throw new Error('HAM fine Screen Offset is not implemented');
    if (x != null) target.offsetX = target.mode === 0x8000 ? x & ~1 : x;
    if (y != null) target.offsetY = y;
    target.windowed = true;
    changed(true);
  }
  function validateAmosScreen(width, height, mode, placement) {
    const limit = options.snapshotStandard === 'NTSC' ? 262 : 312;
    if (mode !== 0 || placement.flags !== 0 || placement.offsetX !== 0 || placement.offsetY !== 0 ||
        (placement.x & ~15) !== 128 || placement.y > 255 || placement.width !== width || placement.height !== height ||
        width < 128 || width > 320 || (width & 15) || height < 1 || height > 256 || placement.y + height < 128 || placement.y + height > limit) {
      throw new Error('Load Iff AMSC placement is not implemented for these fields');
    }
  }
  function defaultIffWindow(id) {
    const target = screen(id);
    if (target.mode !== 0 || target.width !== 320 || target.height <= 256) throw new Error('Unsupported tall IFF window');
    // Existing portable default Y=50, native DefWY2=DefWY-8, and native
    // nonlaced PAL/NTSC exclusive end rows 310/260.
    const y = 42, end = options.snapshotStandard === 'NTSC' ? 260 : 310;
    screenDisplay(id, 128, y, 320, Math.min(target.height, end - y));
  }
  function setRainbow(number, colour, length, red, green, blue, start = 0) {
    [number, colour, length, start].forEach(whole);
    if (number < 0 || number > 3 || colour < 0 || (colour & 31) > 15 || length < 16 || length >= 32700) throw new Error('Invalid Set Rainbow arguments');
    if ([red, green, blue].some(pattern => pattern !== '')) throw new Error('Rainbow pattern strings are not implemented');
    const colours = new Uint16Array(length); colours.fill(start & 0xfff);
    rainbows.set(number, { colour: colour & 31, colours, base: 0, y: 28, height: 0 }); changed();
  }
  function rainbow(number, base = null, y = null, height = null) {
    const table = rainbows.get(whole(number));
    if (!table) throw new Error('Rainbow is not defined');
    [base, y, height].filter(value => value != null).forEach(whole);
    if ((base != null && base < 0) || (y != null && (y < 0 || y > 65535)) ||
        (height != null && (height < 0 || height > 312))) throw new Error('Unsupported Rainbow placement');
    // Native RainDo stores a word Y; RainA1 clamps it to 28 without a PAL
    // field-end clamp. Parked ranges such as Roller II's Y=380 stay invisible.
    // Wrapped end rows remain outside this bounded profile.
    if (Math.max(28, y == null ? table.y : y) + (height == null ? table.height : height) > 65535) throw new Error('Wrapped Rainbow placement is not implemented');
    if ((height == null ? table.height : height) && options.snapshotStandard === 'NTSC') throw new Error('NTSC rainbow presentation is not implemented');
    if (base != null && base < table.colours.length) table.base = base;
    if (y != null) table.y = Math.max(28, y);
    if (height != null) table.height = height;
    changed();
  }
  function rainbowDel(number = -1) {
    whole(number);
    if (number > 3) throw new Error('Unsupported Rainbow Del number (expected negative or 0..3)');
    if (number < 0) {
      if (!rainbows.size) return;
      rainbows.clear();
    } else if (!rainbows.delete(number)) return;
    changed();
  }
  function rainColour(number, line) {
    const table = rainbows.get(whole(number));
    if (!table || !Number.isInteger(line) || line < 0 || line >= table.colours.length) throw new Error('Rain index out of bounds');
    return table.colours[line];
  }
  function setRain(number, line, rgb) { rainColour(number, line); rainbows.get(number).colours[line] = whole(rgb) & 0xfff; changed(); }
  function activeRainbow(y) {
    for (let number = 0; number < 4; number++) {
      const table = rainbows.get(number);
      if (table && y >= table.y && y < table.y + table.height) return table;
    }
    return null;
  }
  function paletteRows(views) {
    const rows = []; let previous = null;
    const ordered = views.slice().sort((a, b) => a.y - b.y);
    for (let y = 0; y < 312; y++) {
      const view = ordered.slice().reverse().find(view => view.y <= y) || ordered[0], table = activeRainbow(y);
      if (previous && (!table || previous.colour !== table.colour)) rows.push({ y, index: previous.colour, rgb: view.palette[previous.colour] || 0 });
      if (table) rows.push({ y, index: table.colour, rgb: table.colours[(table.base + y - table.y) % table.colours.length] });
      previous = table;
    }
    return rows;
  }
  function doubleBuffer() {
    const target = screen();
    checkClones(target);
    if (target.doubleBuffered) throw new Error('Screen is already double buffered');
    target.pixels = Uint8Array.from(target.physicalPixels);
    target.doubleBuffered = true;
    target.autoback = 2;
    changed();
  }
  function swap(id = null) {
    const targets = id == null ? Array.from(screens.values()) : [screen(id)];
    targets.forEach(target => {
      if (!target.doubleBuffered) return;
      const previous = target.pixels;
      target.pixels = target.physicalPixels;
      target.physicalPixels = previous;
    });
    changed();
  }
  function autoback(mode) {
    if (!Number.isInteger(mode) || mode < 0 || mode > 2) throw new Error('Invalid Autoback mode');
    screen().autoback = mode;
  }
  function withPhysical(target, action) {
    const logical = target.pixels;
    target.pixels = target.physicalPixels;
    try { return action(); } finally { target.pixels = logical; }
  }
  function bufferSelector(kind, id = null) {
    if (kind !== 'Logic' && kind !== 'Physic') throw new Error('Unknown buffer selector');
    if (id == null) return kind === 'Logic' ? ~0x40000000 : -1;
    whole(id);
    return kind === 'Logic' ? (id | 0x80000000) & ~0x40000000 : id | 0xc0000000;
  }
  function resolveBuffer(value) {
    whole(value);
    if (value < -2147483648 || value > 2147483647 || value >= 8) throw new Error('Invalid screen selector');
    const word = (value << 16) >> 16;
    const id = value >= 0 ? value : word < 0 ? current : value & 65535;
    if (id != null && (id < 0 || id > 7)) throw new Error('Invalid screen selector');
    const target = screen(id);
    return { target, pixels: value < 0 && (value & 0x40000000) ? target.physicalPixels : target.pixels };
  }
  function copyScreen(from, to) {
    // GetEc resolves the destination first. These integer selectors are buffer
    // choices, not chip-memory or bank addresses, and never select a screen.
    const destination = resolveBuffer(to), source = resolveBuffer(from);
    if (destination.pixels === source.pixels) return;
    const width = Math.min(source.target.width, destination.target.width);
    const height = Math.min(source.target.height, destination.target.height);
    const planes = Math.min(source.target.colours - 1, destination.target.colours - 1);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const at = y * destination.target.width + x;
      destination.pixels[at] = (destination.pixels[at] & ~planes) | (source.pixels[y * source.target.width + x] & planes);
    }
    changed();
  }
  function copyScreenRectangle(from, x1, y1, xEnd, yEnd, to, x2, y2) {
    const destination = resolveBuffer(to), source = resolveBuffer(from);
    const coordinates = [x1, y1, xEnd, yEnd, x2, y2];
    coordinates.forEach(whole);
    if (coordinates.some(value => value < -32768 || value > 32767)) throw new Error('Screen Copy rectangle coordinates require signed words');
    // Sco0 clips the origins first, then subtracts the adjusted source origin
    // from the exclusive end. Negative destination coordinates thus consume
    // source pixels; negative source coordinates shift the destination.
    if (x1 < 0) { x2 -= x1; x1 = 0; }
    if (y1 < 0) { y2 -= y1; y1 = 0; }
    if (x2 < 0) { x1 -= x2; x2 = 0; }
    if (y2 < 0) { y1 -= y2; y2 = 0; }
    if ([x1, y1, x2, y2].some(value => value > 32767)) throw new Error('Wrapped Screen Copy clipping is not implemented');
    const sw = source.target.width, sh = source.target.height, dw = destination.target.width, dh = destination.target.height;
    const width = Math.min(xEnd, sw) - x1, height = Math.min(yEnd, sh) - y1;
    if (x1 >= sw || y1 >= sh || x2 >= dw || y2 >= dh || width <= 0 || height <= 0) return;
    const columns = Math.min(width, dw - x2), rows = Math.min(height, dh - y2);
    if (source.pixels === destination.pixels && x1 === x2 && y1 === y2) return;
    // Snapshot raw codes before any write, including aliased clone/self copies.
    // This gives overlap-safe copies without exposing traversal to the host.
    const captured = new Uint8Array(columns * rows);
    for (let y = 0; y < rows; y++) captured.set(source.pixels.subarray((y1 + y) * sw + x1, (y1 + y) * sw + x1 + columns), y * columns);
    const planes = Math.min(source.target.colours - 1, destination.target.colours - 1);
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const at = (y2 + y) * dw + x2 + x;
      destination.pixels[at] = (destination.pixels[at] & ~planes) | (captured[y * columns + x] & planes);
    }
    changed();
  }
  function drawing(painter, args) {
    const target = screen();
    const synchronise = target.autoback === 2 && drawingHooks;
    if (synchronise) drawingHooks.before(target);
    const fields = ['x', 'y', 'gx', 'gy', 'ink', 'linePhase'];
    const before = fields.map(field => target[field]);
    const result = painter(...args);
    if (target.doubleBuffered && target.autoback !== 0) {
      const after = fields.map(field => target[field]);
      fields.forEach((field, i) => { target[field] = before[i]; });
      try { withPhysical(target, () => painter(...args)); }
      finally { fields.forEach((field, i) => { target[field] = after[i]; }); }
    }
    if (synchronise) drawingHooks.after(target);
    return result;
  }
  function setColour(index, rgb) {
    const target = screen();
    index = registerIndex(index);
    rgb = whole(rgb) & 0xfff;
    target.palette[index] = rgb;
    changed();
  }
  function setPalette(...values) {
    const target = screen();
    if (values.length > 32) throw new Error('Too many palette colours');
    values.forEach((rgb, index) => { if (rgb != null && ((whole(rgb) << 16) >> 16) >= 0) setColour(index, rgb); });
  }
  function pixel(target, x, y, colour) {
    if (x >= 0 && y >= 0 && x < target.width && y < target.height) target.pixels[y * target.width + x] = colour;
  }
  function clear(colour = 0) {
    const target = screen();
    target.pixels.fill(colourIndex(colour, target));
    target.x = target.y = 0;
    changed();
  }
  function clearRect(colour, x1, y1, x2, y2) {
    const target = screen();
    rectangle(target, x1, y1, x2, y2, colourIndex(colour, target), true);
    changed();
  }
  function ink(colour, background = null, border = null) {
    const target = screen();
    target.ink = colourIndex(colour, target);
    if (background != null) target.inkBackground = colourIndex(background, target);
    if (border != null) target.inkBorder = colourIndex(border, target);
  }
  function setLine(pattern) { screen().linePattern = whole(pattern) & 65535; }
  function plot(x, y, colour = null) {
    const target = screen();
    x = x == null ? target.gx : whole(x);
    y = y == null ? target.gy : whole(y);
    if (colour != null) target.ink = colourIndex(colour, target);
    pixel(target, x, y, target.ink);
    target.gx = x; target.gy = y;
    changed();
  }
  function point(x, y) {
    const target = screen();
    whole(x); whole(y);
    return x < 0 || y < 0 || x >= target.width || y >= target.height ? -1 : target.pixels[y * target.width + x];
  }

  function paste(image, x, y, transparent, id = current, settings = {}) {
    const target = screen(id);
    whole(x); whole(y);
    // BobCalc copies only min(image planes, screen planes); upper screen
    // planes remain intact. A mask still includes every source bitplane.
    const planeMask = Math.min((1 << image.depth) - 1, target.colours - 1) & (settings.planes == null ? -1 : settings.planes);
    const clip = settings.limit || { left: 0, top: 0, right: target.width, bottom: target.height };
    const minterm = settings.minterm == null || settings.minterm === 0 ? 0xca : settings.minterm & 255;
    const left = Math.max(0, x, clip.left), top = Math.max(0, y, clip.top);
    const right = Math.min(target.width, x + image.width, clip.right), bottom = Math.min(target.height, y + image.height, clip.bottom);
    for (let row = top; row < bottom; row++) {
      for (let column = left; column < right; column++) {
        const source = (row - y) * image.width + column - x;
        const value = image.pixels[source];
        const mask = !transparent || (image.mask ? image.mask[source] : value !== 0) ? 1 : 0;
        const destination = row * target.width + column;
        if (minterm === 0xca) {
          if (!mask) continue;
          target.pixels[destination] = (target.pixels[destination] & ~planeMask) | (value & planeMask);
        } else {
          let result = target.pixels[destination];
          for (let bit = 1; bit <= planeMask; bit <<= 1) {
            if (!(planeMask & bit)) continue;
            // Amiga function generator: A=mask, B=image, C=destination.
            const input = mask * 4 + (value & bit ? 2 : 0) + (result & bit ? 1 : 0);
            if (minterm & (1 << input)) result |= bit;
            else result &= ~bit;
          }
          target.pixels[destination] = result;
        }
      }
    }
    changed();
  }

  function capture(x, y, width, height, id = current, clip = null, copy = true) {
    const target = screen(id);
    const bounds = clip || { left: 0, top: 0, right: target.width, bottom: target.height };
    const left = Math.max(0, x, bounds.left), top = Math.max(0, y, bounds.top);
    const right = Math.min(target.width, x + width, bounds.right), bottom = Math.min(target.height, y + height, bounds.bottom);
    if (right <= left || bottom <= top) return null;
    const pixels = copy ? new Uint8Array((right - left) * (bottom - top)) : null;
    if (pixels) for (let row = top; row < bottom; row++) pixels.set(target.pixels.subarray(row * target.width + left, row * target.width + right), (row - top) * (right - left));
    return { screen: target, buffer: target.pixels, x: left, y: top, width: right - left, height: bottom - top, pixels };
  }
  function restore(saved) {
    if (!saved || screens.get(saved.screen.id) !== saved.screen) return;
    if (saved.buffer !== saved.screen.pixels && saved.buffer !== saved.screen.physicalPixels) return;
    const planes = saved.planes == null ? saved.screen.colours - 1 : saved.planes;
    for (let row = 0; row < saved.height; row++) {
      if (!saved.background && planes === saved.screen.colours - 1) {
        saved.buffer.set(saved.pixels.subarray(row * saved.width, (row + 1) * saved.width), (saved.y + row) * saved.screen.width + saved.x);
      } else for (let column = 0; column < saved.width; column++) {
        const destination = (saved.y + row) * saved.screen.width + saved.x + column;
        const colour = saved.background > 0 ? saved.background - 1 : saved.pixels[row * saved.width + column];
        saved.buffer[destination] = (saved.buffer[destination] & ~planes) | (colour & planes);
      }
    }
    changed();
  }

  function bankPalette(values, mask = -1) {
    const target = screen();
    // AMOS keeps all 32 colour registers, also on lower-depth screens.
    for (let i = 0; i < 32; i++) if (mask & (1 << i)) target.palette[i] = values[i];
    changed();
  }
  function getPalette(from, mask = -1) {
    bankPalette(resolveBuffer(from).target.palette.slice(), whole(mask));
  }

  function validatePattern(values) {
    const target = screen();
    if (target.linePattern === 65535) return;
    const points = coordinates(target, Array.from({ length: 4 }, (_, index) => values[index]));
    if (points.some(value => value < -32768 || value > 32767)) throw new Error('Patterned line coordinates require signed words');
  }
  function patternedLine(target, x1, y1, x2, y2, colour, phase) {
    const dx = Math.abs(x2 - x1), dy = -Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
    let error = dx + dy, step = 0;
    // Preserve off-screen phase before clipping writes; signed-word endpoints
    // bound the walk to 65,536 pixels. Pattern zero uses the opaque background.
    while (true) {
      pixel(target, x1, y1, target.linePattern & (1 << ((phase - step) & 15)) ? colour : target.inkBackground);
      if (x1 === x2 && y1 === y2) break;
      const doubled = 2 * error;
      if (doubled >= dy) { error += dy; x1 += sx; }
      if (doubled <= dx) { error += dx; y1 += sy; }
      step++;
    }
  }
  // Clip solid lines before stepping, preserving bounded large-coordinate work.
  function line(target, x1, y1, x2, y2, colour) {
    const phase = target.linePhase, distance = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    target.linePhase = (phase - distance) & 15;
    if (target.linePattern !== 65535) { patternedLine(target, x1, y1, x2, y2, colour, phase); return; }
    const code = (x, y) => (x < 0 ? 1 : x >= target.width ? 2 : 0) | (y < 0 ? 4 : y >= target.height ? 8 : 0);
    let a = code(x1, y1), b = code(x2, y2);
    for (let i = 0; i < 8 && (a || b); i++) {
      if (a & b) return;
      const out = a || b;
      let x, y;
      if (out & 8) { y = target.height - 1; x = x1 + (x2 - x1) * (y - y1) / (y2 - y1); }
      else if (out & 4) { y = 0; x = x1 + (x2 - x1) * -y1 / (y2 - y1); }
      else if (out & 2) { x = target.width - 1; y = y1 + (y2 - y1) * (x - x1) / (x2 - x1); }
      else { x = 0; y = y1 + (y2 - y1) * -x1 / (x2 - x1); }
      if (out === a) { x1 = x; y1 = y; a = code(x1, y1); }
      else { x2 = x; y2 = y; b = code(x2, y2); }
    }
    if (a || b) return;
    x1 = Math.round(x1); y1 = Math.round(y1); x2 = Math.round(x2); y2 = Math.round(y2);
    const dx = Math.abs(x2 - x1), dy = -Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
    let error = dx + dy;
    while (true) {
      pixel(target, x1, y1, colour);
      if (x1 === x2 && y1 === y2) break;
      const doubled = 2 * error;
      if (doubled >= dy) { error += dy; x1 += sx; }
      if (doubled <= dx) { error += dx; y1 += sy; }
    }
  }
  function coordinates(target, values) {
    return values.map((value, index) => value == null ? (index % 2 ? target.gy : target.gx) : whole(value));
  }
  function draw(x1, y1, x2, y2) {
    const target = screen();
    [x1, y1, x2, y2] = coordinates(target, [x1, y1, x2, y2]);
    line(target, x1, y1, x2, y2, target.ink);
    target.gx = x2; target.gy = y2;
    changed();
  }
  function drawTo(x, y) { const target = screen(); draw(target.gx, target.gy, x, y); }
  function rectangle(target, x1, y1, x2, y2, colour, fill) {
    [x1, y1, x2, y2] = coordinates(target, [x1, y1, x2, y2]);
    const left = Math.min(x1, x2), right = Math.max(x1, x2);
    const top = Math.min(y1, y2), bottom = Math.max(y1, y2);
    if (fill) {
      for (let y = Math.max(0, top); y <= Math.min(target.height - 1, bottom); y++) {
        if (left < target.width && right >= 0) target.pixels.fill(colour, y * target.width + Math.max(0, left), y * target.width + Math.min(target.width - 1, right) + 1);
      }
    } else if (target.linePattern !== 65535) {
      // Original Box uses PolyDraw: down the first side, across the bottom,
      // back up, then across the top. Keep caller endpoint order and phase.
      line(target, x1, y1, x1, y2, colour); line(target, x1, y2, x2, y2, colour);
      line(target, x2, y2, x2, y1, colour); line(target, x2, y1, x1, y1, colour);
    } else {
      line(target, left, top, right, top, colour); line(target, right, top, right, bottom, colour);
      line(target, right, bottom, left, bottom, colour); line(target, left, bottom, left, top, colour);
    }
    target.gx = x2; target.gy = y2;
  }
  function bar(...values) { const target = screen(); rectangle(target, ...values, target.ink, true); changed(); }
  function box(...values) { const target = screen(); rectangle(target, ...values, target.ink, false); changed(); }
  function locate(x, y) {
    const target = screen();
    x = x == null ? target.x : whole(x); y = y == null ? target.y : whole(y);
    if (x < 0 || y < 0 || x >= target.columns || y >= target.rows) throw new Error('Text cursor out of bounds');
    target.x = x; target.y = y;
  }
  function grLocate(x, y) { const target = screen(); [target.gx, target.gy] = coordinates(target, [x, y]); }
  function home() { locate(0, 0); }
  function pen(index) { screen().pen = colourIndex(index); }
  function paper(index) { screen().paper = colourIndex(index); }
  function setTab(size) {
    if (!Number.isInteger(size) || size < 1 || size > 255) throw new Error('Invalid tab size');
    screen().tabSize = size;
  }
  function glyph(target, code, x, y, foreground, background = null) {
    if (code < 32 || (code > 127 && code < 160) || code > 255 || code * 8 + 7 >= font.length) code = 63;
    for (let row = 0; row < 8; row++) {
      const bits = font[code * 8 + row];
      for (let col = 0; col < 8; col++) {
        if (bits & (1 << col)) pixel(target, x + col, y + row, foreground);
        else if (background != null) pixel(target, x + col, y + row, background);
      }
    }
  }
  function writing(mode, parts = 0) {
    whole(mode); whole(parts);
    if (mode < 0 || mode > 4 || parts < 0 || parts > 2) throw new Error('Invalid Writing mode/parts');
    const target = screen();
    writingMode = mode; writingParts = parts;
    target.writingActive = mode !== 0 || parts !== 0;
  }
  function printGlyph(target, code, x, y) {
    if (!target.writingActive) { glyph(target, code, x, y, target.pen, target.paper); return; }
    if (writingMode === 4) return;
    if (code < 32 || (code > 127 && code < 160) || code > 255 || code * 8 + 7 >= font.length) code = 63;
    for (let row = 0; row < 8; row++) {
      const bits = font[code * 8 + row];
      for (let col = 0; col < 8; col++) {
        const px = x + col, py = y + row;
        if (px < 0 || py < 0 || px >= target.width || py >= target.height) continue;
        const foreground = !!(bits & (1 << col));
        const value = foreground ? (writingParts === 1 ? 0 : target.pen) : (writingParts === 2 ? 0 : target.paper);
        const at = py * target.width + px, previous = target.pixels[at];
        target.pixels[at] = (writingMode === 0 ? value : writingMode === 1 ? previous | value :
          writingMode === 2 ? previous ^ value : previous & value) & (target.colours - 1);
      }
    }
  }
  function scroll(target) {
    if (target.y < target.rows) return;
    target.pixels.copyWithin(0, target.width * 8);
    target.pixels.fill(target.paper, (target.rows - 1) * 8 * target.width);
    target.y = target.rows - 1;
  }
  function clearLine() {
    const target = screen();
    if (!target.columns || !target.rows) throw new Error('Screen is too small for text');
    const first = target.y * 8, end = Math.min(first + 8, target.height);
    for (let y = first; y < end; y++) target.pixels.fill(target.paper, y * target.width, y * target.width + target.columns * 8);
    changed();
  }
  function write(text) {
    const target = screen();
    if (!target.columns || !target.rows) throw new Error('Screen is too small for text');
    for (const character of text) {
      const code = character.charCodeAt(0);
      if (code === 13) { target.x = 0; continue; }
      if (code === 10) { target.x = 0; target.y++; scroll(target); continue; }
      if (code === 8) { target.x = Math.max(0, target.x - 1); continue; }
      if (code === 9) {
        const spaces = target.tabSize - target.x % target.tabSize;
        for (let i = 0; i < spaces; i++) put(32);
      } else if (code >= 32) put(code);
    }
    changed();
    function put(code) {
      if (target.x >= target.columns) { target.x = 0; target.y++; scroll(target); }
      printGlyph(target, code, target.x * 8, target.y * 8);
      target.x++;
    }
  }
  function text(x, baseline, value) {
    const target = screen(); whole(x); whole(baseline);
    for (let i = 0; i < value.length; i++) glyph(target, value.charCodeAt(i), x + i * 8, baseline - 7, target.ink);
    changed();
  }
  function centre(value) {
    locate(Math.max(0, Math.floor((screen().columns - value.length) / 2)), null);
    write(value + '\n');
  }
  function info(name, ...args) {
    if (name === 'Screen Number') return current == null ? -1 : current;
    if (name === 'Colour Value') { const target = screen(); return target.palette[registerIndex(args[0])]; }
    const target = screen(args[0] == null ? current : args[0]);
    if (name.startsWith('Screen Width')) return target.width;
    if (name.startsWith('Screen Height')) return target.height;
    if (name === 'X Curs') return target.x;
    if (name === 'Y Curs') return target.y;
    throw new Error(`Unsupported display query ${name}`);
  }
  function coordinate(name, ...args) {
    const target = screen(args.length === 2 ? args[0] : current);
    const value = whole(args[args.length - 1]);
    const word = value => (value << 16) >> 16;
    const horizontal = name.startsWith('X');
    const origin = horizontal ? target.hardwareX : target.hardwareY;
    if (name.endsWith('Hard')) return word((horizontal && target.mode === 0x8000 ? word(value) >> 1 : word(value)) + origin);
    const offset = word(value - origin);
    return word((horizontal && target.mode === 0x8000 ? offset * 2 : offset) + (horizontal ? target.offsetX : target.offsetY));
  }
  function reserveZones(count = 0) {
    whole(count);
    if (count < 0 || count > 65535) throw new Error('Unsupported zone count (expected 0..65535)');
    const target = screen();
    target.zones = count ? new Uint16Array(count * 4) : null;
  }
  function zoneIndex(number, target, allowZero = false) {
    whole(number);
    if (!target.zones) throw new Error('Zones are not reserved');
    if (number < (allowZero ? 0 : 1) || number > target.zones.length / 4) throw new Error('Invalid zone number');
    return (number - 1) * 4;
  }
  function resetZone(number = 0) {
    const target = screen(), at = zoneIndex(number, target, true);
    if (number === 0) target.zones.fill(0);
    else target.zones.fill(0, at, at + 4);
  }
  function setZone(number, x1, y1, x2, y2) {
    const target = screen(), at = zoneIndex(number, target);
    // Original Set Zone stores unsigned words. It does not clip to the bitmap
    // or normalize reversed endpoints; queries use the same word coordinates.
    [x1, y1, x2, y2].forEach(whole);
    x1 &= 65535; y1 &= 65535; x2 &= 65535; y2 &= 65535;
    if (x1 >= x2 || y1 >= y2) throw new Error('Invalid zone rectangle');
    target.zones.set([x1, y1, x2, y2], at);
  }
  function zone(...args) {
    screen(); // The original requires a current screen even with an explicit id.
    let id = args.length === 3 ? whole(args[0]) : current;
    if (id === -1) id = current;
    if (id < 0 || id > 7) throw new Error('Unsupported zone screen (expected -1..7)');
    const target = screen(id), x = whole(args[args.length - 2]) & 65535, y = whole(args[args.length - 1]) & 65535;
    if (!target.zones) return 0;
    for (let at = 0; at < target.zones.length; at += 4) {
      const [x1, y1, x2, y2] = target.zones.subarray(at, at + 4);
      if ((x2 || y2) && x >= x1 && x <= x2 && y >= y1 && y <= y2) return at / 4 + 1;
    }
    return 0;
  }
  function screenIn(...args) {
    screen(); // Like Zone, the language function first requires a current screen.
    const from = args.length === 3 ? whole(args[0]) : -1;
    if (from < -1 || from > 7) throw new Error('Unsupported Scin start screen (expected -1..7)');
    if (from !== -1) screen(from);
    const x = whole(args[args.length - 2]) & 65535, y = whole(args[args.length - 1]) & 65535;
    // The optional screen starts a priority-list scan; it is not a screen filter.
    const first = from === -1 ? 0 : priorityOrder.indexOf(from);
    for (let index = Math.max(first, 0); index < priorityOrder.length; index++) {
      const target = screens.get(priorityOrder[index]);
      if (!target || target.hidden) continue;
      const width = target.windowWidth / (target.mode === 0x8000 ? 2 : 1);
      if (x >= target.hardwareX && x < target.hardwareX + width &&
          y >= target.hardwareY && y < target.hardwareY + target.windowHeight) return target.id;
    }
    return -2147483648;
  }
  function mouseZone(x, y) {
    const target = screen(), scale = target.mode === 0x8000 ? 2 : 1;
    x = (whole(x) & 65535) - target.hardwareX;
    y = (whole(y) & 65535) - target.hardwareY;
    if (x < 0 || x >= target.windowWidth / scale || y < 0 || y >= target.windowHeight) return 0;
    // The language function uses ZoHd on the current screen, not SyMouZ's
    // separate priority-list scan. Geometry is live even before View.
    return zone(x * scale + target.offsetX, y + target.offsetY);
  }
  function rgba(id = current) {
    const target = typeof id === 'object' ? id : screen(id);
    const result = new Uint8ClampedArray(target.width * target.height * 4);
    let spriteFrame = null, spriteRows = null;
    const samples = target.mode === 0x8000 ? 1 : 2;
    if (spriteWriter) {
      if (!spriteModel) throw new Error('Sprite helpers are not loaded');
      spriteFrame = { origin: { x: target.hardwareX, y: target.hardwareY }, lines: target.height,
        samplesPerLowresPixel: 2, lineRegs: new Uint32Array(target.height * 32), lineSprites: new Uint32Array(target.height * 32) };
      spriteRows = new Uint8Array(target.height);
      const control = (Math.log2(target.colours) << 12) | target.mode | (target.ham ? 0x800 : 0);
      for (let y = 0; y < target.height; y++) {
        spriteFrame.lineRegs[y * 32 + 8] = control;
        spriteFrame.lineRegs[y * 32 + 10] = target.spritePriority | (target.spritePriority << 3);
      }
      spriteWriter(spriteFrame);
      for (let y = 0; y < target.height; y++) spriteRows[y] = spriteModel.validate(spriteFrame, y) ? 1 : 0;
    }
    const colourAt = (index, y) => {
      const table = activeRainbow(target.hardwareY + y);
      return table && table.colour === index ? table.colours[(table.base + target.hardwareY + y - table.y) % table.colours.length] : target.palette[index];
    };
    let previous = target.palette[0];
    for (let i = 0; i < target.physicalPixels.length; i++) {
      const index = target.physicalPixels[i];
      const line = Math.floor(i / target.width);
      let rgb = colourAt(target.colours === 64 ? index & 31 : index, line);
      if (target.ham) {
        if (!colorModel) throw new Error('HAM colour helpers are not loaded');
        if (index > 63) throw new Error('Invalid HAM pixel code');
        if (i % target.width === 0) previous = colourAt(0, line);
        rgb = colorModel.hamWord(index, previous, colourAt(index & 15, line));
        previous = rgb;
      } else if (target.colours === 64 && (index & 32)) rgb = (rgb >> 1) & 0x777;
      const y = Math.floor(i / target.width);
      if (spriteFrame && spriteRows[y]) {
        const sprite = spriteModel.sample(spriteFrame, y, (i % target.width) * samples, index);
        if (sprite && sprite.visible) rgb = colourAt(sprite.paletteIndex, line);
      }
      result[i * 4] = ((rgb >> 8) & 15) * 17;
      result[i * 4 + 1] = ((rgb >> 4) & 15) * 17;
      result[i * 4 + 2] = (rgb & 15) * 17;
      result[i * 4 + 3] = 255;
    }
    return result;
  }
  function getPlanarBridge() {
    if (!planarBridge) {
      if (!planarBridgeFactory || !chipMemoryClass || !frameStateModel || !staticFrameFactory) throw new Error('Planar snapshot helpers are not loaded');
      planarBridge = planarBridgeFactory({ screens, paletteRows, windowGeometry, isPresented: target => presented === target || !!(presentedWindows && presentedWindows.some(window => window.target === target)),
        writeSprites: frame => { if (spriteWriter) spriteWriter(frame); } }, options, chipMemoryClass, frameStateModel, staticFrameFactory, copperBuilder, copperInterpreter);
    }
    return planarBridge;
  }
  function snapshotPlayfield(id = current) { return getPlanarBridge().snapshot(screen(id)); }
  function renderPlayfield(id = current) {
    if (!referenceRenderer) throw new Error('Planar reference renderer is not loaded');
    const snapshot = snapshotPlayfield(id);
    return referenceRenderer.render(snapshot.chip, snapshot.frame);
  }
  function snapshotDisplay(ids = null, geometry = {}) {
    if (!copperBuilder || !copperInterpreter) throw new Error('Copper helpers are not loaded');
    const windows = ids == null ? presentedWindows : null;
    const targets = windows ? windows.map(window => window.target) : ids == null ? (presented ? [presented] : []) : (Array.isArray(ids) ? ids : [ids]).map(id => screen(id));
    return getPlanarBridge().snapshotDisplay(targets, geometry, windows);
  }
  function renderDisplay(ids = null, geometry = {}) {
    if (!referenceRenderer) throw new Error('Planar reference renderer is not loaded');
    const snapshot = snapshotDisplay(ids, geometry);
    return referenceRenderer.render(snapshot.chip, snapshot.frame);
  }
  function canvasFrame() {
    if (!presentedWindows) return presented ? { width: presented.width, height: presented.height, rgba: rgba(presented) } : null;
    const snapshot = snapshotDisplay(), frame = snapshot.frame;
    const source = referenceRenderer.render(snapshot.chip, frame);
    const scale = presentedWindows.some(window => window.target.mode === 0x8000) ? 1 : 2;
    const width = frame.outputWidth / scale, height = frame.lines;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) pixels.set(source.subarray(i * scale * 4, i * scale * 4 + 4), i * 4);
    return { width, height, rgba: pixels };
  }
  function pointerHardwarePosition(x, y, width, height) {
    if (presentedWindows) {
      const { left, top, right, bottom } = windowGeometry();
      return [left + Math.floor(x * (right - left) / width), top + Math.floor(y * (bottom - top) / height)];
    }
    const target = presentedHardware;
    if (!target) throw new Error('No physical display for hardware mouse coordinates');
    return [target.x + Math.floor(x * target.width / width / (target.mode === 0x8000 ? 2 : 1)),
      target.y + Math.floor(y * target.height / height)];
  }
  function pointerPosition(x, y, width, height) {
    const target = presentedWindows ? screen() : presented || screen();
    if (!presentedWindows) return [Math.max(0, Math.min(target.width - 1, Math.floor(x * target.width / width))),
      Math.max(0, Math.min(target.height - 1, Math.floor(y * target.height / height)))];
    const { top, bottom } = windowGeometry();
    const view = presentedWindows.find(window => window.target === target);
    const right = Math.max(...presentedWindows.map(window => window.width * (window.target.mode === 0x8000 ? 1 : 2)));
    return [Math.floor(x * right / width / (target.mode === 0x8000 ? 1 : 2)) + (view ? view.offsetX : target.offsetX),
      Math.floor(y * (bottom - top) / height + top - (view ? view.y : target.hardwareY)) + (view ? view.offsetY : target.offsetY)];
  }
  open(0, 320, 200, 16, 0);
  return {
    screens, screen, open, select, close, clone, hideScreen, showScreen, screenToFront, getPalette, setColour, setPalette, screenDisplay, screenOffset, validateAmosScreen, defaultIffWindow, canvasFrame, pointerPosition, pointerHardwarePosition,
    reserveZones, resetZone, setZone, zone, mouseZone, screenIn,
    rainbows, setRainbow, rainbow, rainbowDel, rainColour, setRain, view, setAutoView,
    autoViewOn: () => setAutoView(true), autoViewOff: () => setAutoView(false),
    presentedScreen: () => presented,
    get autoView() { return autoView; },
    cursOff() { screen().cursorVisible = false; },
    ink, setLine, writing, point, grLocate, locate, home, pen, paper, setTab, info, rgba, coordinate, snapshotPlayfield, renderPlayfield, snapshotDisplay, renderDisplay,
    paste, bankPalette, capture, restore, doubleBuffer, swap, autoback, withPhysical, bufferSelector, copyScreen, copyScreenRectangle,
    clear: (...args) => drawing(clear, args), clearRect: (...args) => drawing(clearRect, args),
    plot: (...args) => drawing(plot, args), draw: (...args) => { validatePattern(args); return drawing(draw, args); },
    drawTo: (...args) => { const target = screen(); validatePattern([target.gx, target.gy, ...args]); return drawing(drawTo, args); },
    box: (...args) => { validatePattern(args); return drawing(box, args); },
    bar: (...args) => drawing(bar, args), write: (...args) => drawing(write, args), clearLine: () => drawing(clearLine, []),
    text: (...args) => drawing(text, args), centre: (...args) => drawing(centre, args),
    pasteGraphic: (...args) => drawing(paste, args),
    setDrawingHooks(hooks) { drawingHooks = hooks; },
    setSpriteWriter(fn) { spriteWriter = fn; changed(); },
    invalidate: changed,
    get current() { return current; }, get version() { return version; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    subscribeScreens(listener) { screenListeners.add(listener); return () => screenListeners.delete(listener); }
  };
}

if (typeof module === 'object' && module.exports) module.exports = createDisplay;
else globalThis.AMOS_DISPLAY = createDisplay;
