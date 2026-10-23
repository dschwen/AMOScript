/* jshint esversion: 6 */
'use strict';

const fontFactory = typeof module === 'object' && module.exports ? require('./font') : globalThis.AMOS_FONT;

// Indexed pixels are authoritative for both graphics and rasterized text.
function createDisplay(options = {}) {
  const font = options.font || fontFactory();
  const screens = new Map();
  const listeners = new Set();
  let current = null;
  let version = 0;
  let drawingHooks = null;
  let compositor = null;
  const palette = [0x000, 0xf80, 0xfff, 0x00f, 0xf00, 0x0f0, 0x080, 0xff0, 0x888, 0x444, 0xaaa, 0x666, 0x0ff, 0xf0f, 0x800, 0x008];

  function changed() { version++; listeners.forEach(listener => listener(version)); }
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
    if (!Number.isInteger(value) || value < 0 || value > 31) throw new Error('Invalid colour index');
    return value;
  }
  function open(id, width, height, colours, mode) {
    if (!Number.isInteger(id) || id < 0 || id > 7) throw new Error('Invalid screen number');
    if (!Number.isInteger(width) || width < 1 || width > 1024 || !Number.isInteger(height) || height < 1 || height > 1023) throw new Error('Invalid screen dimensions');
    if (![2, 4, 8, 16, 32].includes(colours)) throw new Error('Unsupported screen colour mode');
    if (mode !== 0 && mode !== 0x8000) throw new Error('Unsupported screen resolution mode');
    const paper = colours === 2 ? 0 : 1;
    const next = {
      id, width, height, colours, mode,
      pixels: new Uint8Array(width * height),
      physicalPixels: null, doubleBuffered: false, autoback: 0,
      palette: Array.from({ length: 32 }, (_, i) => palette[i] == null ? 0 : palette[i]),
      hardwareX: 128, hardwareY: 50, spritePriority: 4,
      pen: colours === 2 ? 1 : 2, paper, ink: colours === 2 ? 1 : 2,
      inkBackground: 0, inkBorder: 0, x: 0, y: 0, gx: 0, gy: 0, tabSize: 4,
      columns: Math.floor(width / 8), rows: Math.floor(height / 8)
    };
    next.pixels.fill(paper);
    next.physicalPixels = next.pixels;
    screens.set(id, next);
    current = id;
    changed();
    return next;
  }
  function select(id) { screen(id); current = id; changed(); }
  function close(id) {
    screen(id);
    screens.delete(id);
    if (current === id) current = screens.size ? screens.keys().next().value : null;
    changed();
  }
  function doubleBuffer() {
    const target = screen();
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
  function drawing(painter, args) {
    const target = screen();
    const synchronise = target.autoback === 2 && drawingHooks;
    if (synchronise) drawingHooks.before(target);
    const fields = ['x', 'y', 'gx', 'gy', 'ink'];
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
    registerIndex(index);
    if (!Number.isInteger(rgb) || rgb < 0 || rgb > 0xfff) throw new Error('Invalid 12-bit palette colour');
    target.palette[index] = rgb;
    changed();
  }
  function setPalette(...values) {
    const target = screen();
    if (values.length > 32) throw new Error('Too many palette colours');
    values.forEach((rgb, index) => { if (rgb != null) setColour(index, rgb); });
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

  // Clip before stepping, so even very distant coordinates take bounded work.
  function line(target, x1, y1, x2, y2, colour) {
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
    if (code < 32 || code > 127) code = 63;
    for (let row = 0; row < 8; row++) {
      const bits = font[code * 8 + row];
      for (let col = 0; col < 8; col++) {
        if (bits & (1 << col)) pixel(target, x + col, y + row, foreground);
        else if (background != null) pixel(target, x + col, y + row, background);
      }
    }
  }
  function scroll(target) {
    if (target.y < target.rows) return;
    target.pixels.copyWithin(0, target.width * 8);
    target.pixels.fill(target.paper, (target.rows - 1) * 8 * target.width);
    target.y = target.rows - 1;
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
      glyph(target, code, target.x * 8, target.y * 8, target.pen, target.paper);
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
    return word(horizontal && target.mode === 0x8000 ? offset * 2 : offset);
  }
  function rgba(id = current) {
    const target = screen(id);
    const result = new Uint8ClampedArray(target.width * target.height * 4);
    for (let i = 0; i < target.physicalPixels.length; i++) {
      const rgb = target.palette[target.physicalPixels[i]];
      result[i * 4] = ((rgb >> 8) & 15) * 17;
      result[i * 4 + 1] = ((rgb >> 4) & 15) * 17;
      result[i * 4 + 2] = (rgb & 15) * 17;
      result[i * 4 + 3] = 255;
    }
    if (compositor) compositor(result, target);
    return result;
  }
  open(0, 320, 200, 16, 0);
  return {
    screens, screen, open, select, close, setColour, setPalette,
    ink, point, grLocate, locate, home, pen, paper, setTab, info, rgba, coordinate,
    paste, bankPalette, capture, restore, doubleBuffer, swap, autoback, withPhysical,
    clear: (...args) => drawing(clear, args), clearRect: (...args) => drawing(clearRect, args),
    plot: (...args) => drawing(plot, args), draw: (...args) => drawing(draw, args),
    drawTo: (...args) => drawing(drawTo, args), box: (...args) => drawing(box, args),
    bar: (...args) => drawing(bar, args), write: (...args) => drawing(write, args),
    text: (...args) => drawing(text, args), centre: (...args) => drawing(centre, args),
    pasteGraphic: (...args) => drawing(paste, args),
    setDrawingHooks(hooks) { drawingHooks = hooks; },
    setCompositor(fn) { compositor = fn; changed(); },
    invalidate: changed,
    get current() { return current; }, get version() { return version; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  };
}

if (typeof module === 'object' && module.exports) module.exports = createDisplay;
else globalThis.AMOS_DISPLAY = createDisplay;
