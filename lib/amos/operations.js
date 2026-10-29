/* jshint esversion: 6 */
'use strict';

const displayFactory = typeof module === 'object' && module.exports ? require('./display') : globalThis.AMOS_DISPLAY;
const bankReaderFactory = typeof module === 'object' && module.exports ? require('../BankReader') : globalThis.AMOS_BANK_READER;
const bankWriterFactory = typeof module === 'object' && module.exports ? require('../BankWriter') : globalThis.AMOS_BANK_WRITER;
const spriteBufferFactory = typeof module === 'object' && module.exports ? require('./spriteBuffer') : globalThis.AMOS_SPRITE_BUFFER;
const audioFactory = typeof module === 'object' && module.exports ? require('./audio') : globalThis.AMOS_AUDIO;
const modReaderFactory = typeof module === 'object' && module.exports ? require('./mod') : globalThis.AMOS_MOD;
const trackerFactory = typeof module === 'object' && module.exports ? require('./tracker') : globalThis.AMOS_TRACKER;
const musicReaderFactory = typeof module === 'object' && module.exports ? require('./musicBank') : globalThis.AMOS_MUSIC_BANK;
const musicFactory = typeof module === 'object' && module.exports ? require('./music') : globalThis.AMOS_MUSIC;
const bankMemoryFactory = typeof module === 'object' && module.exports ? require('./bankMemory') : globalThis.AMOS_BANK_MEMORY;
const ilbmReaderFactory = typeof module === 'object' && module.exports ? require('../display/model/ilbm') : globalThis.AMOS_ILBM;
const ilbmWriterFactory = typeof module === 'object' && module.exports ? require('../display/model/ilbmWriter') : globalThis.AMOS_ILBM_WRITER;
const packedPictureReader = typeof module === 'object' && module.exports ? require('./packedPicture') : globalThis.AMOS_PACKED_PICTURE;
const animReaderFactory = typeof module === 'object' && module.exports ? require('./anim') : globalThis.AMOS_ANIM;

// Pure JS runtime operations. Embedded alongside the scheduler in generated modules.
function createOperations(state, options) {
  const display = options.display || displayFactory(options.displayOptions);
  if (options.tabSize != null) display.setTab(options.tabSize);
  function mutableBank(bank) {
    return { ...bank,
      ...(bank.images ? { images: bank.images.map(image => image && { ...image, pixels: Uint8Array.from(image.pixels), orientation: 0, masked: bank.number === 1, mask: null }), palette: bank.palette.slice() } : { data: Uint8Array.from(bank.data) })
    };
  }
  const amalRegisters = new Int16Array(26);
  function amregIndex(index) {
    index = integer(index);
    if (index < 0 || index >= 26) throw new Error('Invalid global AMAL register');
    return index;
  }
  const banks = new Map((options.banks || []).map(bank => [bank.number, mutableBank(bank)]));
  const animations = new WeakMap();
  let tracker = null, trackerBank = null, trackerNext = null, trackerLocation = null;
  let music = null, musicBank = null, musicNext = null, musicLocation = null;
  const bankMemory = bankMemoryFactory(banks, { beforeWrite(bank) {
    if (animations.has(bank)) throw new Error('Writing a Frame Load animation bank is not implemented');
    if (bank === musicBank) throw new Error('Writing an active Music bank is not implemented; Music Off first');
    if (bank === trackerBank) throw new Error('Writing an active Tracker bank is not implemented; Track Stop first');
  } });
  const audio = audioFactory(banks, { host: options.audio, standard: options.audioStandard,
    reservedVoices: () => music ? 15 : 0,
    fieldTime: options.audioFieldTime, vblHz: options.audioVblHz, noiseSeed: options.audioNoiseSeed, noiseBeam: options.audioNoiseBeam });
  state.audio = audio.state;
  state.tracker = { bank: null, loop: false, playing: false, paused: false, position: null };
  function trackStop() {
    const previous = tracker;
    tracker = null; trackerBank = null; trackerNext = null;
    state.tracker.playing = false; state.tracker.paused = false;
    try { if (previous) previous.stop(); }
    finally { if (options.requestTrackerWake) options.requestTrackerWake(); }
  }
  function trackPlay(number = state.tracker.bank, pattern = null) {
    if (music) throw new Error('Track Play during Music is not implemented; Music Off first');
    // Native Track Play evaluates but ignores its optional pattern argument.
    if (pattern != null) integer(pattern);
    number = integer(number);
    if (number < 1 || number >= 65536) throw new Error('Invalid Track Play bank number');
    const bank = banks.get(number);
    if (!bank || bank.type !== 'data' || bank.memory !== 'chip' || bank.name !== 'Tracker ') throw new Error('Tracker bank not found');
    if (!options.vblNow || !options.requestTrackerWake) throw new Error('Track Play requires the runtime VBL clock');
    if (state.halted) throw new Error('Cannot start tracker in a halted program');
    // This bounded bank form is Track Load's exact MOD plus 32 workspace bytes.
    const module = modReaderFactory(bank.data.subarray(0, -32));
    const next = trackerFactory(module, { standard: options.audioStandard, loop: state.tracker.loop,
      filterEnabled: audio.state.filterEnabled, host: { command(event) {
        if (event.type === 'filter') audio.filter(event.enabled);
        else audio.command(event.type === 'play' ? { ...event, filterEnabled: audio.state.filterEnabled } : event);
      } } });
    // Validate before mutating banks or silencing the current song.
    const now = options.vblNow();
    trackStop(); audio.stop();
    for (const sample of module.samples) {
      bank.data.fill(0, sample.offset, sample.offset + 4);
      bank.data[44 + (sample.number - 1) * 30] = 0;
    }
    tracker = next; trackerBank = bank; trackerNext = now + 1;
    trackerLocation = state.location && { ...state.location };
    state.tracker.position = next.state; state.tracker.playing = true;
    state.tracker.paused = state.stopped;
    options.requestTrackerWake();
  }
  function advanceTracker(vbl) {
    if (!tracker || state.tracker.paused) return;
    if (vbl - trackerNext >= 250) throw new Error('Tracker field catch-up exceeds 250 fields');
    while (tracker && trackerNext <= vbl) {
      trackerNext++;
      tracker.state.loop = state.tracker.loop;
      tracker.state.filterEnabled = audio.state.filterEnabled;
      tracker.tick();
      if (!tracker.state.playing) { tracker = null; trackerBank = null; trackerNext = null; state.tracker.playing = false; }
    }
  }
  function pauseTracker() { if (tracker) state.tracker.paused = true; }
  function resumeTracker() {
    if (tracker && state.tracker.paused) {
      trackerNext = options.vblNow() + 1; state.tracker.paused = false;
    }
  }
  state.music = { bank: null, volume: 56, playing: false, paused: false, position: null };
  function musicOff() {
    const previous = music;
    music = null; musicBank = null; musicNext = null;
    state.music.playing = false; state.music.paused = false;
    try { if (previous) previous.stop(); else audio.stop(); }
    finally { if (options.requestMusicWake) options.requestMusicWake(); }
  }
  // Terminal cleanup must not silence another controller through an inactive
  // Music Off. The explicit AMOS command, however, stops all four channels.
  function cancelMusic() { if (music) musicOff(); }
  function musicVolume(level) {
    level = integer(level);
    if (level < 0 || level >= 64) throw new Error('Invalid Mvolume level');
    state.music.volume = level;
    if (music) music.setVolume(level);
  }
  function musicPlay(number) {
    number = integer(number);
    if (number < 1 || number > 65535) throw new Error('Unsupported Music song number');
    if (music || tracker) throw new Error('Overlapping Music songs/tracker are not implemented; stop music first');
    const bank = banks.get(3);
    if (!bank || bank.type !== 'data' || bank.memory !== 'chip' || bank.name.slice(0, 4) !== 'Musi') throw new Error('Music bank 3 not found');
    if (state.halted) throw new Error('Cannot start Music in a halted program');
    if (!options.vblNow || !options.requestMusicWake) throw new Error('Music requires the runtime VBL clock');
    const module = musicReaderFactory(bank.data);
    let committed = false;
    const next = musicFactory(module, { song: number, volume: state.music.volume, standard: options.audioStandard,
      host: { command(event) {
        // Construction validates the complete profile before affecting voices.
        if (committed) audio.command(event.type === 'play' ? { ...event, filterEnabled: audio.state.filterEnabled } : event);
      } } });
    const now = options.vblNow();
    audio.stop(); committed = true;
    music = next; musicBank = bank; musicNext = now + 1;
    musicLocation = state.location && { ...state.location };
    state.music.bank = 3; state.music.position = next.state;
    state.music.playing = true; state.music.paused = state.stopped;
    options.requestMusicWake();
  }
  function advanceMusic(vbl) {
    if (!music || state.music.paused) return;
    if (vbl - musicNext >= 250) throw new Error('Music field catch-up exceeds 250 fields');
    while (music && musicNext <= vbl) {
      musicNext++;
      music.tick();
      if (!music.state.playing) { music = null; musicBank = null; musicNext = null; state.music.playing = false; }
    }
  }
  function pauseMusic() { if (music) state.music.paused = true; }
  function resumeMusic() {
    if (music && state.music.paused) { musicNext = options.vblNow() + 1; state.music.paused = false; }
  }
  function sampleDuringMusic() {
    if (music) throw new Error('Sample/effect voice stealing during Music is not implemented; Music Off first');
  }
  let bankOrder = Array.from(banks.keys()).reverse();
  const bobs = new Map();
  const sprites = new Map();
  let spriteFrames = new Map();
  const spriteBuffer = spriteBufferFactory();
  function publishSpriteBuffer() { state.spriteBuffer = spriteBuffer.layout(); }
  publishSpriteBuffer();
  let spritesDirty = false;
  let automaticSprites = true;
  let pointerVisible = true;
  let pointerCount = 0;
  // No explicit shape initially: the browser host retains its owner's cursor.
  let pointerShape = null;
  function changeMouse(shape) {
    shape = integer(shape);
    if (shape < 1 || shape > 3) throw new Error('Unsupported Change Mouse shape (expected built-in 1..3)');
    pointerShape = shape;
    display.invalidate();
  }
  function setPointerCount(count) {
    pointerCount = (count << 16) >> 16;
    pointerVisible = pointerCount >= 0; spriteBuffer.setPointerVisible(pointerVisible); display.invalidate();
  }
  let drawnBobs = [];
  let bobsDirty = false;
  let automaticBobs = true;
  let priorityScreen = null;
  let reversePriority = false;
  const maxBobs = options.maxBobs == null ? 64 : options.maxBobs;
  if (!Number.isInteger(maxBobs) || maxBobs < 1 || maxBobs > 256) throw new Error('maxBobs must be an integer in 1..256');
  const collisionHits = new Uint8Array(256);
  let degrees = false;
  if (options.readRandomBeam != null && typeof options.readRandomBeam !== 'function') throw new Error('readRandomBeam must be a synchronous function');
  let randomSeed = 0, previousRandom = 0;
  function publishRandom() { state.random = Object.freeze({ seed: randomSeed, last: previousRandom }); }
  function randomize(seed) { randomSeed = integer(seed) >>> 0; publishRandom(); }
  function rnd(bound) {
    bound = integer(bound);
    if (bound === 0) return previousRandom;
    const maximum = Math.abs(bound);
    let mask = 0xffffff, carry = 0;
    for (let bit = 0; bit < 24; bit++) {
      carry = mask & 1; mask >>>= 1;
      if (mask < maximum) break;
    }
    mask = (mask << 1) | carry;
    const swap = value => ((value << 16) | (value >>> 16)) >>> 0;
    try {
      // The original Mulu32 swaps whole cross products, retaining their high
      // halves in the low word. Math.imul(seed, constant) is not equivalent.
      for (let attempt = 0; attempt < 4096; attempt++) {
        const low = randomSeed & 65535, high = randomSeed >>> 16;
        randomSeed = (low * 0xe62d + swap(high * 0xe62d) + swap(low * 0xbb40) + 1) >>> 0;
        let value = randomSeed >>> 8;
        if (bound > 0 && options.readRandomBeam) {
          const beam = options.readRandomBeam();
          if (!Number.isInteger(beam) || beam < 0 || beam > 65535) throw new Error('Random beam reader must return a 16-bit word synchronously');
          value = (value & 0xffff0000) | ((value + beam) & 65535);
        }
        value &= mask;
        if (value <= maximum) { previousRandom = value; return value; }
      }
      throw new Error('Rnd rejection budget exhausted');
    } finally { publishRandom(); }
  }
  publishRandom();
  let joystickBinding = null;
  let fading = null;
  const flashes = [];
  let paletteWrites = null;
  function writePalette(target, colour, rgb, vbl, priority, location) {
    if (!paletteWrites) { target.palette[colour] = rgb; return; }
    if (!paletteWrites.has(target)) paletteWrites.set(target, new Map());
    const entries = paletteWrites.get(target), previous = entries.get(colour);
    if (!previous || vbl > previous.vbl || (vbl === previous.vbl && priority >= previous.priority)) {
      entries.set(colour, { rgb, vbl, priority, location });
    }
  }
  function paletteError(error, location) {
    if (location && !error.message.includes(' at line ')) error.message += ` at line ${location.line}, byte ${location.offset}`;
    throw error;
  }
  function publishFlash(notify = true) {
    state.flashes = Object.freeze(flashes.map(job => Object.freeze({ screen: job.target.id,
      colour: job.colour, position: job.position, nextVbl: job.nextVbl })));
    if (notify && options.requestPaletteWake) options.requestPaletteWake();
  }
  function parseFlash(pattern) {
    if (typeof pattern !== 'string') throw new Error('Flash pattern must be a string');
    if (!pattern) return [];
    const steps = [], piece = /\( *([0-9a-f]) *([0-9a-f]) *([0-9a-f]), *((?:[0-9] *)+)\)/igy;
    let at = 0;
    while (at < pattern.length) {
      piece.lastIndex = at;
      const match = piece.exec(pattern);
      if (!match || steps.length === 16) throw new Error('Unsupported Flash pattern');
      const speed = Number(match[4].replace(/ /g, ''));
      if (!Number.isInteger(speed) || speed < 1 || speed > 32767) throw new Error('Unsupported Flash speed (expected 1..32767)');
      steps.push({ rgb: parseInt(match[1] + match[2] + match[3], 16), speed });
      at = piece.lastIndex;
    }
    return steps;
  }
  function flash(colour, pattern) {
    const target = display.screen();
    colour = integer(colour);
    if (colour < 0 || colour > 31) throw new Error('Unsupported Flash colour (expected 0..31)');
    if (!options.vblNow || !options.requestPaletteWake) throw new Error('Flash requires the runtime VBL clock');
    advancePalette(options.vblNow());
    // The original tests global capacity before searching for an existing entry.
    if (flashes.length === 16) throw new Error('Too many flashing colours');
    const steps = parseFlash(pattern), previous = flashes.findIndex(job => job.target === target && job.colour === colour);
    if (previous !== -1) flashes.splice(previous, 1);
    if (steps.length) flashes.push({ target, colour, steps, cycle: steps.reduce((sum, step) => sum + step.speed, 0),
      position: 0, nextVbl: options.vblNow() + 1, location: state.location && { ...state.location } });
    publishFlash();
  }
  function flashOff() {
    const target = display.screen();
    for (let i = flashes.length - 1; i >= 0; i--) if (flashes[i].target === target) flashes.splice(i, 1);
    publishFlash();
  }
  function advanceFlash(vbl) {
    let changed = false;
    for (const job of flashes) {
      if (vbl < job.nextVbl) continue;
      try {
        // Skip whole cycles, then visit at most sixteen entries. Reconciliation
        // stays bounded after Stop or a delayed host callback.
        job.nextVbl += Math.floor((vbl - job.nextVbl) / job.cycle) * job.cycle;
        do {
          const step = job.steps[job.position];
          writePalette(job.target, job.colour, step.rgb, job.nextVbl, 0, job.location);
          job.nextVbl += step.speed;
          job.position = (job.position + 1) % job.steps.length;
        } while (job.nextVbl <= vbl);
        changed = true; if (!paletteWrites) display.invalidate();
      } catch (error) { paletteError(error, job.location); }
    }
    if (changed) publishFlash();
  }
  function nextPaletteJob() {
    return flashes.reduce((earliest, job) => !earliest || job.nextVbl <= earliest.nextVbl ? job : earliest, fading);
  }
  function advancePalette(vbl) {
    // Reduce bounded catch-up by last write time. On the same original field,
    // Flash precedes Fade; later Flash writes still win after Fade completes.
    const writes = new Map(); paletteWrites = writes;
    try {
      advanceFlash(vbl);
      const location = fading && fading.location;
      try { advanceFade(vbl); } catch (error) { paletteError(error, location); }
    } finally { paletteWrites = null; }
    for (const [target, entries] of writes) {
      let location = null;
      try {
        for (const [colour, entry] of entries) { target.palette[colour] = entry.rgb; location = entry.location; }
        display.invalidate();
      } catch (error) { paletteError(error, location); }
    }
  }
  function cancelPaletteEffects() {
    flashes.length = 0; publishFlash(false); cancelFade();
  }
  publishFlash(false);
  function publishFade(notify = true) {
    state.fade = Object.freeze({ active: !!fading, screen: fading ? fading.target.id : null,
      speed: fading ? fading.speed : 0, nextVbl: fading ? fading.nextVbl : null });
    if (notify && options.requestPaletteWake) options.requestPaletteWake();
  }
  function cancelFade() { fading = null; publishFade(); }
  function advanceFade(vbl) {
    if (!fading || vbl < fading.nextVbl) return;
    const job = fading;
    if (display.screens.get(job.target.id) !== job.target) { cancelFade(); return; }
    // At most fifteen component steps and one completion check remain. Clock
    // catch-up is bounded independently of the number of missed fields.
    const steps = Math.min(16, Math.floor((vbl - job.nextVbl) / job.speed) + 1);
    let changed = false;
    for (let step = 0; step < steps && fading; step++) {
      let moving = false;
      for (const entry of job.entries) {
        if (entry.rgb === entry.to) continue;
        const rgb = entry.rgb;
        const move = shift => { const from = (rgb >> shift) & 15, to = (entry.to >> shift) & 15; return from + Math.sign(to - from); };
        entry.rgb = move(8) * 256 + move(4) * 16 + move(0);
        writePalette(job.target, entry.index, entry.rgb, job.nextVbl, 1, job.location);
        moving = true; changed = true;
      }
      job.nextVbl += job.speed;
      if (!moving) fading = null;
    }
    publishFade();
    if (changed && !paletteWrites) display.invalidate();
  }
  function beginFade(speed, destination) {
    speed = integer(speed);
    if (speed < 1 || speed > 32767) throw new Error('Unsupported Fade speed (expected 1..32767)');
    if (!options.vblNow || !options.requestPaletteWake) throw new Error('Fade requires the runtime VBL clock');
    const target = display.screen(), vbl = options.vblNow();
    advancePalette(vbl);
    const palette = typeof destination === 'function' ? destination() : destination;
    const entries = target.palette.map((rgb, index) => ({ index, rgb: rgb & 0xfff, to: palette[index] == null ? null : palette[index] & 0xfff })).filter(entry => entry.to != null && entry.rgb !== entry.to);
    fading = entries.length ? { target, entries, speed, nextVbl: vbl + 1, location: state.location && { ...state.location } } : null;
    publishFade();
  }
  function fade(speed, source = null) {
    if (source != null) {
      source = integer(source);
      if (source < 0 || source > 7) throw new Error('Unsupported Fade To screen (expected 0..7)');
      display.screen(source);
    }
    beginFade(speed, () => source == null ? Array(32).fill(0) : display.screen(source).palette.slice());
  }
  function fadeColours(speed, colours) {
    if (!Array.isArray(colours) || !colours.length || colours.length > 32) throw new Error('Unsupported Fade colour count');
    // Original FDZ supplies all 32 registers. Preserve omitted/negative entries
    // and reject float bit-pattern quirks rather than silently coercing them.
    const palette = colours.map(entry => {
      if (entry == null) return null;
      const type = entry.type === 'dynamic' ? entry.value && entry.value.numericType : entry.type;
      if (type !== 'integer') throw new Error('Explicit Fade colours require integer values');
      const rgb = integer(entry.value); return rgb < 0 ? null : rgb & 0xfff;
    });
    beginFade(speed, palette);
  }
  publishFade(false);
  (display.subscribeScreens || display.subscribe).call(display, () => {
    if (fading && display.screens.get(fading.target.id) !== fading.target) cancelFade();
    let removed = false;
    for (let i = flashes.length - 1; i >= 0; i--) if (display.screens.get(flashes[i].target.id) !== flashes[i].target) {
      flashes.splice(i, 1); removed = true;
    }
    if (removed) publishFlash();
  });
  function joystickPort(port) {
    if (!Number.isInteger(port) || port < 0 || port > 1) throw new Error('Invalid joystick port');
    return port;
  }
  function setJoystick(port, mask) {
    joystickPort(port);
    if (!Number.isInteger(mask) || mask < 0 || mask > 31) throw new Error('Invalid joystick mask');
    state.input.joysticks[port] = mask;
  }
  function joystickInfo(name, port) {
    port = joystickPort(integer(port));
    if (joystickBinding && joystickBinding.reader) {
      const mask = joystickBinding.reader(port);
      if (mask != null) setJoystick(port, mask);
    }
    const mask = state.input.joysticks[port];
    if (name === 'Joy') return mask;
    const bit = { Jup: 1, Jdown: 2, Jleft: 4, Jright: 8, Fire: 16 }[name];
    if (!bit) throw new Error('Unknown joystick query');
    return mask & bit ? -1 : 0;
  }
  state.system = { amosLocked: false, amosFront: true, editorOpen: false };
  state.breakEnabled = true;
  function systemCommand(name) {
    if (options.system != null) {
      if (typeof options.system.command !== 'function') throw new Error('System host requires a synchronous command method');
      const result = options.system.command(name);
      if (result && typeof result.then === 'function') throw new Error('System host commands must complete synchronously');
    }
    if (name === 'Amos Lock') { state.system.amosLocked = true; state.system.amosFront = true; }
    if (name === 'Close Editor') state.system.editorOpen = false;
    if (name === 'Break Off') state.breakEnabled = false;
  }

  function spriteNumber(number) {
    number = integer(number);
    if (number < 0 || number > 63) throw new Error('Invalid Sprite number');
    return number;
  }
  function setSprite(number, x, y, image) {
    number = spriteNumber(number);
    if (number >= 8) throw new Error('Computed Sprite allocation is not implemented');
    const old = sprites.get(number) || { number, x: 0, y: 0, image: 0 };
    // HsNxya cannot reuse a zero coordinate, even on an existing Sprite.
    if ((x == null && old.x === 0) || (y == null && old.y === 0)) throw new Error('Missing Sprite coordinate');
    sprites.set(number, { number, x: x == null ? old.x : (integer(x) << 16) >> 16,
      y: y == null ? old.y : (integer(y) << 16) >> 16, image: image == null ? old.image : integer(image) & 65535 });
    spritesDirty = true;
  }
  function spriteInfo(name, number) {
    const sprite = sprites.get(spriteNumber(number)) || { x: 0, y: 0, image: 0 };
    return name === 'X Sprite' ? sprite.x : name === 'Y Sprite' ? sprite.y : (sprite.image << 16) >> 16;
  }
  function spriteOff(number = null) {
    if (number != null) number = spriteNumber(number);
    if (number == null) for (const sprite of sprites.values()) sprite.image = 0;
    else {
      const sprite = sprites.get(number);
      if (sprite) sprite.image = 0;
    }
    // Off explicitly clears the presented object at the next update.
    for (const [id, frame] of spriteFrames) if (number == null || id === number) frame.off = true;
    spritesDirty = true;
  }
  function setSpriteBuffer(lines) {
    if (!spriteBuffer.resize(integer(lines))) return;
    for (const sprite of sprites.values()) sprite.image = 0;
    spriteFrames.clear(); spritesDirty = false;
    publishSpriteBuffer(); setPointerCount(0);
  }
  function updateSprites() {
    const bank = banks.get(1);
    const frames = new Map(), lineLimit = spriteBuffer.layout().lineLimit;
    for (const [number, sprite] of sprites) {
      const previous = spriteFrames.get(number);
      const image = bank && bank.type === 'sprites' && bank.images[(sprite.image & 0x3fff) - 1];
      // HsAct leaves an existing presentation unchanged for an invalid image.
      if (!image) { if (previous && !previous.off && bank && bank.type === 'sprites') frames.set(number, previous); continue; }
      if (image.width !== 16) throw new Error('Wide hardware Sprites are not implemented');
      // HsAd3/HsAd4 consumes the first four planes for attached hardware
      // sprites even when the original image contains five or six planes.
      if (image.depth < 1 || image.depth > 6) throw new Error('Unsupported Sprite image depth');
      if (image.height > 270) throw new Error('Unsupported Sprite height');
      // HsDm ignores an oversized new image, retaining an old presentation.
      if (image.height + 1 >= lineLimit) {
        if (previous && !previous.off) frames.set(number, previous);
        continue;
      }
      const word = value => (value << 16) >> 16;
      frames.set(number, { number, image,
        pixels: previous && !previous.off && previous.image === image ? previous.pixels : Uint8Array.from(image.pixels),
        width: image.width, height: image.height, depth: image.depth,
        x: Math.max(0, word(sprite.x - image.hotspotX)) & 511,
        y: Math.max(0, word(sprite.y - image.hotspotY)) & 511 });
    }
    spriteBuffer.update(frames); spriteFrames = frames; publishSpriteBuffer();
    spritesDirty = false;
    display.invalidate();
  }
  function spritePriority(priority) {
    priority = integer(priority);
    if (priority < 0 || priority > 4) throw new Error('Invalid Sprite priority');
    display.screen().spritePriority = priority;
    display.invalidate();
  }
  display.setSpriteWriter(frame => spriteBuffer.publish(frame));

  function pruneBobs() {
    for (const [id, bob] of bobs) if (display.screens.get(bob.screen.id) !== bob.screen) bobs.delete(id);
    drawnBobs = drawnBobs.filter(saved => display.screens.get(saved.screen.id) === saved.screen);
    if (priorityScreen && display.screens.get(priorityScreen.id) !== priorityScreen) priorityScreen = null;
  }
  display.subscribe(pruneBobs);
  display.setDrawingHooks({
    before: target => clearBobs(target, true),
    after: target => drawBothBuffers(target)
  });
  function bobNumber(number) {
    if (!Number.isInteger(number) || number < 0 || number >= maxBobs) throw new Error('Invalid Bob number');
    return number;
  }
  function newBob(number, screen) {
    return { number, screen, x: 0, y: 0, image: 0, background: 0, planes: 0xffff, minterm: 0, limit: { left: 0, top: 0, right: screen.width, bottom: screen.height } };
  }
  function configureBob(number, background = null, planes = null, minterm = null) {
    bobNumber(number);
    const current = display.screen();
    const settings = {
      background: background == null ? 0 : (integer(background) << 16) >> 16,
      planes: planes == null ? 0xffff : integer(planes) & 0xffff,
      minterm: minterm == null ? 0 : integer(minterm) & 255
    };
    // The original BobSet/ResBOB path installs drawing options on creation.
    // Reissuing Set Bob for an existing object does not replace those fields.
    if (!bobs.has(number)) bobs.set(number, { ...newBob(number, current), ...settings });
    bobsDirty = true;
  }
  function setBob(number, x, y, image) {
    bobNumber(number);
    const current = display.screen();
    const previous = bobs.get(number);
    const next = previous ? { ...previous } : newBob(number, current);
    if (x != null) next.x = (integer(x) << 16) >> 16;
    if (y != null) next.y = (integer(y) << 16) >> 16;
    if (image != null) {
      const value = integer(image);
      if (value < 0) throw new Error('Invalid image number');
      next.image = value & 0xffff;
      if (next.image & 0x3fff) bankImage(1, next.image);
    }
    bobs.set(number, next);
    bobsDirty = true;
  }
  function setBobLimit(number, x1, y1, x2, y2) {
    if (number != null) bobNumber(number);
    if (!bobs.size) return;
    const current = display.screen();
    const left = (x1 == null ? 0 : integer(x1)) & 0xfff0;
    const right = (x2 == null ? current.width : integer(x2)) & 0xfff0;
    const top = y1 == null ? 0 : (integer(y1) << 16) >> 16;
    const bottom = (y2 == null ? current.height : integer(y2)) & 0xffff;
    // BobLim compares the bottom against the aligned left coordinate.
    // Preserve this source-derived guard, including its unusual rejection.
    if (right <= left || bottom <= left || right > current.width || bottom > current.height) throw new Error('Invalid Bob limit rectangle');
    for (const bob of bobs.values()) {
      if (bob.screen !== current || (number != null && bob.number !== number)) continue;
      bob.limit = { left, top, right, bottom };
      bobsDirty = true;
    }
  }
  function bobInfo(name, number) {
    bobNumber(number);
    const bob = bobs.get(number);
    if (!bob) throw new Error(`Bob ${number} is not defined`);
    return name === 'X Bob' ? bob.x : name === 'Y Bob' ? bob.y : (bob.image << 16) >> 16;
  }
  function collisionShape(bob) {
    const bank = banks.get(1);
    if (!bob || !bank || bank.type !== 'sprites' || !(bob.image & 0x3fff)) return null;
    const image = bank.images[(bob.image & 0x3fff) - 1];
    // BbColl/ColRout require an existing mask and use its stored orientation.
    // Collision queries do not generate masks or apply pending flip flags.
    if (!image || !image.masked || !image.mask) return null;
    const x = ((bob.x - image.hotspotX) << 16) >> 16;
    const y = ((bob.y - image.hotspotY) << 16) >> 16;
    return { image, x, y, right: ((x + image.width) << 16) >> 16, bottom: ((y + image.height) << 16) >> 16 };
  }
  function masksIntersect(a, b) {
    const left = Math.max(a.x, b.x), top = Math.max(a.y, b.y);
    const right = Math.min(a.right, b.right), bottom = Math.min(a.bottom, b.bottom);
    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        if (a.image.mask[(y - a.y) * a.image.width + x - a.x] && b.image.mask[(y - b.y) * b.image.width + x - b.x]) return true;
      }
    }
    return false;
  }
  function bobCollision(number, first = 0, last = 10000) {
    const values = [number, first, last].map(integer);
    if (values.some(value => value < 0)) throw new Error('Invalid Bob collision argument');
    [number, first, last] = values.map(value => value & 0xffff);
    collisionHits.fill(0);
    const source = bobs.get(number);
    const shape = collisionShape(source);
    if (!shape) return 0;
    let hit = false;
    for (const target of bobs.values()) {
      if (target.number === number || target.number < first || target.number > last || target.screen !== source.screen) continue;
      const other = collisionShape(target);
      if (other && masksIntersect(shape, other)) { collisionHits[target.number] = 1; hit = true; }
    }
    return hit ? -1 : 0;
  }
  function collisionInfo(number) {
    number = integer(number);
    if (number >= 0) return collisionHits[number & 255] ? -1 : 0;
    const start = -number;
    if (start >= 255) return 0;
    for (let id = start; id < 256; id++) if (collisionHits[id]) return id;
    return 0;
  }
  function bobOff(number = null) {
    if (number == null) bobs.clear();
    else bobs.delete(bobNumber(number));
    bobsDirty = true;
  }
  function clearBobs(target = null, bothBuffers = false) {
    const selected = item => (target == null || item.screen === target) && (bothBuffers || item.buffer === item.screen.pixels);
    const saved = drawnBobs.filter(selected);
    drawnBobs = drawnBobs.filter(item => !selected(item));
    saved.sort((a, b) => a.bobNumber - b.bobNumber);
    for (const item of saved) display.restore(item);
  }
  function drawBobs(target = null) {
    const images = banks.get(1);
    const ordered = Array.from(bobs.values()).filter(bob => (target == null || bob.screen === target) &&
      images && images.type === 'sprites' && images.images[(bob.image & 0x3fff) - 1]);
    ordered.sort((a, b) => {
      const aPriority = a.screen === priorityScreen, bPriority = b.screen === priorityScreen;
      if (aPriority !== bPriority) return aPriority ? 1 : -1;
      return aPriority ? a.y - b.y || a.x - b.x || a.number - b.number : a.number - b.number;
    });
    if (reversePriority) ordered.reverse();
    const frames = [];
    for (const bob of ordered) {
      const image = bankImage(1, bob.image);
      orientImage(image, bob.image);
      if (image.masked && !image.mask) makeImageMask(image);
      const x = bob.x - image.hotspotX, y = bob.y - image.hotspotY;
      const planes = bob.planes & Math.min((1 << image.depth) - 1, bob.screen.colours - 1);
      if (bob.background >= 0 && planes) {
        const left = Math.floor(Math.max(x, bob.limit.left) / 16) * 16;
        const right = Math.ceil(Math.min(x + image.width, bob.limit.right) / 16) * 16;
        const saved = display.capture(left, y, right - left, image.height, bob.screen.id, bob.limit, bob.background === 0);
        if (saved) drawnBobs.push({ ...saved, bobNumber: bob.number, planes, background: bob.background });
      }
      frames.push({ bob, image, x, y });
    }
    // Capture every background before rendering any Bob, as BobAff does.
    for (const { bob, image, x, y } of frames) {
      orientImage(image, bob.image);
      display.paste(image, x, y, image.masked, bob.screen.id, bob);
    }
  }
  function drawBothBuffers(target) {
    drawBobs(target);
    if (target.doubleBuffered) display.withPhysical(target, () => drawBobs(target));
  }
  function doubleBuffer() {
    const target = display.screen();
    if (target.doubleBuffered) throw new Error('Screen is already double buffered');
    clearBobs(target, true);
    display.doubleBuffer();
    drawBothBuffers(target);
  }
  function updateBobs() { clearBobs(); drawBobs(); display.swap(); bobsDirty = false; }
  function flushBobs() {
    if (automaticBobs && bobsDirty) updateBobs();
    if (automaticSprites && spritesDirty) updateSprites();
  }
  function imageBobsChanged() { if (bobs.size || drawnBobs.length) bobsDirty = true; }
  function hotSpot(number, x, y) {
    const image = bankImage(1, number);
    image.hotspotX = (integer(x) << 18) >> 18;
    image.hotspotY = (integer(y) << 16) >> 16;
    imageBobsChanged();
  }
  function hotSpotPreset(number, preset) {
    const image = bankImage(1, number);
    const code = integer(preset) & 0x77;
    const x = (code >> 4) & 3, y = code & 3;
    hotSpot(number, x === 0 ? 0 : x === 1 ? Math.floor(image.width / 2) : image.width, y === 0 ? 0 : y === 1 ? Math.floor(image.height / 2) : image.height);
  }

  let directory = '';
  function checkDirectoryPath(path) {
    if (!path || path.includes('\0') || path.startsWith('/') || path.startsWith(':') ||
        /(^|[:/])\.{1,2}(\/|$)|\/\//.test(path) || (path.match(/:/g) || []).length > 1) throw new Error('Unsupported directory path');
  }
  function resolveFileName(name) {
    if (typeof name !== 'string') throw new Error('Filename must be a string');
    if (!directory) return name;
    checkDirectoryPath(name);
    return name.includes(':') ? name : directory + name;
  }
  function setDirectory(name) {
    if (typeof name !== 'string') throw new Error('Dir$ requires a string');
    checkDirectoryPath(name);
    const path = resolveFileName(name), target = /[:/]$/.test(path) ? path : `${path}/`;
    if (!options.files || typeof options.files.isDirectory !== 'function') throw new Error('Dir$ requires a synchronous files.isDirectory adapter');
    const exists = options.files.isDirectory(target);
    if (typeof exists !== 'boolean') throw new Error('Files isDirectory must return a boolean synchronously');
    if (!exists) throw new Error(`Directory not found: ${target}`);
    directory = target;
  }
  function fileExists(name) {
    if (typeof name !== 'string') throw new Error('Exist requires a string');
    if (!name) return 0;
    if (!options.files || typeof options.files.exists !== 'function') throw new Error('Exist requires a synchronous files.exists adapter');
    const exists = options.files.exists(resolveFileName(name));
    if (typeof exists !== 'boolean') throw new Error('Files exists must return a boolean synchronously');
    return exists ? -1 : 0;
  }
  function fileSelector(path, defaultName = '', title1 = '', title2 = '') {
    const valid = value => typeof value === 'string' && value.length <= 255 && !/[^\x01-\xff]/.test(value);
    if (![path, defaultName, title1, title2].every(valid)) throw new Error('Fsel$ requires NUL-free byte strings of at most 255 bytes');
    if (!options.files || typeof options.files.select !== 'function') throw new Error('Fsel$ requires a synchronous files.select adapter');
    const result = options.files.select(Object.freeze({ path, defaultName, title1, title2 }));
    if (!valid(result)) throw new Error('Files selector must return a byte-string path synchronously (empty means cancel)');
    return result;
  }
  function bload(filename, destination) {
    const address = bankMemory.address(integer(destination));
    if (!options.files || typeof options.files.read !== 'function') throw new Error('Bload requires a files host adapter');
    const contents = options.files.read(resolveFileName(filename));
    if (typeof contents !== 'string' || /[^\x00-\xff]/.test(contents)) throw new Error('Files host must return raw bytes synchronously');
    bankMemory.checkRange(address, contents.length);
    bankMemory.write(address, Uint8Array.from(contents, char => char.charCodeAt(0)));
  }
  function bsave(filename, start, end) {
    const address = bankMemory.address(integer(start)), stop = integer(end) >>> 0;
    if (stop <= address) throw new Error('Invalid Bsave range (end must follow start)');
    const bytes = bankMemory.read(address, stop - address);
    if (!options.files || typeof options.files.write !== 'function') throw new Error('Bsave requires a files host adapter');
    const path = resolveFileName(filename);
    let contents = '';
    for (let at = 0; at < bytes.length; at += 8192) contents += String.fromCharCode(...bytes.subarray(at, at + 8192));
    const write = text => {
      const result = options.files.write(path, text);
      if (result && typeof result.then === 'function') throw new Error('Files host must write raw bytes synchronously');
    };
    write(''); write(contents);
  }
  function loadBanks(filename, destination = null) {
    if (destination != null) destination = integer(destination);
    if (destination != null && destination >= 65536) throw new Error('Invalid bank number');
    if (!options.files || typeof options.files.read !== 'function') throw new Error('Bank loading requires a files host adapter');
    if (typeof bankReaderFactory !== 'function') throw new Error('Bank loading requires the BankReader runtime');
    const contents = options.files.read(resolveFileName(filename));
    if (typeof contents !== 'string' || /[^\x00-\xff]/.test(contents)) throw new Error('Files host must return a bank byte string synchronously');
    const decoded = bankReaderFactory.readFile(Uint8Array.from(contents, char => char.charCodeAt(0)));
    const loaded = decoded.banks.map(bank => {
      if (bank.type === 'data' && !decoded.grouped && destination != null && destination >= 0) bank.number = destination;
      const next = mutableBank(bank);
      const previous = banks.get(next.number);
      // LB_Multiples ignores the override; image banks always stay at 1/2.
      // LB_Sprites/LB_Icons use a nonzero low word as the append flag.
      if (!decoded.grouped && next.images && destination != null && (destination & 65535) && previous && previous.type === next.type) {
        if (previous.images.length + next.images.length > 65535) throw new Error('Too many bank images');
        next.images = previous.images.concat(next.images);
      }
      return next;
    });
    installBanks(loaded, [], decoded.grouped);
  }

  function trackLoad(filename, number) {
    number = integer(number);
    if (number < 1 || number >= 65536) throw new Error('Invalid Track Load bank number');
    if (!options.files || typeof options.files.read !== 'function') throw new Error('Track Load requires a files host adapter');
    const contents = options.files.read(resolveFileName(filename));
    if (typeof contents !== 'string' || /[^\x00-\xff]/.test(contents)) throw new Error('Files host must return tracker bytes synchronously');
    if (contents.length > 16 * 1024 * 1024) throw new Error('Tracker file exceeds 16 MiB');
    const data = new Uint8Array(contents.length + 32);
    for (let i = 0; i < contents.length; i++) data[i] = contents.charCodeAt(i);
    // Track Load stores raw bytes plus 32 bytes of workspace; parsing belongs
    // to the subsequent player/inspector, not to this synchronous file command.
    installBanks([{ number, type: 'data', memory: 'chip', permanent: true, name: 'Tracker ', data }]);
    state.tracker.bank = number;
  }

  function saveIff(filename) {
    if (!options.files || typeof options.files.write !== 'function') throw new Error('Save Iff requires a files host adapter');
    if (typeof ilbmWriterFactory !== 'function') throw new Error('Save Iff requires the ILBM writer runtime');
    const path = resolveFileName(filename);
    const bytes = ilbmWriterFactory(display.screen());
    let contents = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) contents += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    const result = options.files.write(path, contents);
    if (result && typeof result.then === 'function') throw new Error('Files host must write synchronously');
  }

  function unpackScreen(selector, destination) {
    selector = integer(selector); destination = integer(destination);
    if (destination < 0 || destination > 7) throw new Error('Invalid Unpack screen number');
    const bank = banks.get(selector);
    if (!bank || bank.type !== 'data') throw new Error('Unpack requires a reserved packed-picture bank');
    if (bank.data.length > 16 * 1024 * 1024) throw new Error('Packed picture bank exceeds 16 MiB');
    const image = packedPictureReader(Uint8Array.from(bank.data));
    // Decode/validate completely before screen replacement. New-screen Unpack
    // does not use the current-screen Autoback path in the native extension.
    const target = display.open(destination, image.width, image.height, image.colours, image.mode);
    display.screenDisplay(destination, image.window.x, image.window.y, image.window.width, image.window.height);
    display.screenOffset(destination, image.window.offsetX, image.window.offsetY);
    target.pixels.set(image.pixels); target.palette = image.palette.slice(); target.cursorVisible = false;
    display.invalidate();
  }

  function loadIff(filename, destination = null) {
    if (!options.files || typeof options.files.read !== 'function') throw new Error('Load Iff requires a files host adapter');
    if (typeof ilbmReaderFactory !== 'function') throw new Error('Load Iff requires the ILBM runtime');
    const contents = options.files.read(resolveFileName(filename));
    if (typeof contents !== 'string' || /[^\x00-\xff]/.test(contents)) throw new Error('Files host must return IFF bytes synchronously');
    const { snapshot, image } = ilbmReaderFactory(Uint8Array.from(contents, character => character.charCodeAt(0)));
    const mode = image.hasMode ? image.displayMode :
      ((image.pageWidth >= 640 && image.depth <= 4 ? 0x8000 : 0) | (image.pageHeight >= 400 ? 4 : 0));
    // Transparent-colour metadata has no extra plane. Native IffBODY copies
    // these screen pixels opaquely; an actual mask plane remains unsupported.
    if (image.masking === 1 || (mode & 4)) throw new Error('Load Iff mask planes and interlace are not implemented');
    const placement = destination != null ? image.amosScreen : null;
    if (placement) display.validateAmosScreen(image.width, image.height, mode & 0x8000, placement);
    const tall = destination != null && !placement && image.height > 256 && image.width === 320 && !(mode & 0x8000);
    let target;
    if (destination != null) {
      destination = integer(destination);
      target = display.open(destination, Math.ceil(image.width / 16) * 16, image.height,
        mode & 0x800 ? 4096 : 1 << image.depth, mode & 0x8000);
      if (placement) display.screenDisplay(destination, placement.x, placement.y, placement.width, placement.height);
      else if (tall) display.defaultIffWindow(destination);
    } else target = display.screen();
    if (image.width > target.width || image.depth > Math.log2(target.colours)) throw new Error('IFF image does not fit the screen');
    clearBobs(target);
    const mask = (1 << image.depth) - 1;
    for (let y = 0; y < Math.min(image.height, target.height); y++) for (let x = 0; x < image.width; x++) {
      let index = 0;
      for (let plane = 0; plane < image.depth; plane++) {
        const address = snapshot.frame.lineRegs[plane] + y * image.rowBytes + (x >> 3);
        if (snapshot.chip[address] & (128 >> (x & 7))) index |= 1 << plane;
      }
      const at = y * target.width + x;
      target.pixels[at] = (target.pixels[at] & ~mask) | index;
    }
    if (image.hasPalette) for (let index = 0; index < Math.min(32, image.paletteSize); index++) {
      const at = index * 4;
      target.palette[index] = ((snapshot.frame.linePal[at] >> 4) << 8) |
        ((snapshot.frame.linePal[at + 1] >> 4) << 4) | (snapshot.frame.linePal[at + 2] >> 4);
    }
    target.cursorVisible = false;
    imageBobsChanged(); display.invalidate();
  }

  function installBanks(loaded, removed = [], clear = false) {
    if (musicBank && (clear || removed.includes(3) || loaded.some(bank => bank.number === 3))) musicOff();
    if (trackerBank && (clear || removed.includes(trackerBank.number) || loaded.some(bank => bank.number === trackerBank.number))) trackStop();
    const objectsChanged = (clear && banks.has(1)) || removed.includes(1) || loaded.some(bank => bank.number === 1);
    if (objectsChanged) clearBobs(null, true);
    if (clear) { for (const bank of banks.values()) bankMemory.release(bank); banks.clear(); bankOrder = []; }
    for (const number of removed) { bankMemory.release(banks.get(number)); banks.delete(number); }
    bankOrder = bankOrder.filter(number => !removed.includes(number));
    for (const bank of loaded) {
      bankMemory.release(banks.get(bank.number));
      banks.set(bank.number, bank);
      bankOrder = [bank.number, ...bankOrder.filter(number => number !== bank.number)];
    }
    if (objectsChanged) imageBobsChanged();
    if (objectsChanged) spritesDirty = true;
  }

  function reserveBank(number, length, permanent, memory) {
    number = integer(number);
    length = integer(length);
    if (number < 1 || number >= 65536) throw new Error('Invalid bank number');
    if (length <= 0) throw new Error('Invalid bank length');
    // Bnk.Reserve erases an existing bank before attempting allocation.
    eraseBank(number);
    const bank = { number, type: 'data', memory, permanent,
      name: permanent ? 'Data    ' : 'Work    ', data: new Uint8Array(length) };
    installBanks([bank]);
  }

  function eraseBank(number) {
    number = integer(number);
    if (banks.has(number)) installBanks([], [number]);
  }

  function eraseTemp() {
    installBanks([], Array.from(banks.values()).filter(bank => bank.type === 'data' && !bank.permanent).map(bank => bank.number));
  }

  function bankLength(number) {
    const bank = banks.get(integer(number));
    return !bank ? 0 : bank.images ? bank.images.length : bank.data.length;
  }

  function swapBanks(first, second) {
    first = integer(first);
    second = integer(second);
    if (first < 1 || second < 1 || first >= 65536 || second >= 65536) throw new Error('Invalid bank number');
    const a = banks.get(first), b = banks.get(second);
    // InBankSwap's two-absent path writes through a null bank pointer.
    // Explicitly reject that unsupported raw-memory behavior.
    if (!a && !b) throw new Error('Cannot swap two missing banks');
    if (first === second) return;
    if (musicBank && (first === 3 || second === 3)) musicOff();
    const objectsChanged = first === 1 || second === 1;
    if (objectsChanged) clearBobs(null, true);
    banks.delete(first);
    banks.delete(second);
    if (a) { a.number = second; banks.set(second, a); }
    if (b) { b.number = first; banks.set(first, b); }
    bankOrder = bankOrder.map(number => number === first ? second : number === second ? first : number);
    if (objectsChanged) imageBobsChanged();
    if (objectsChanged) spritesDirty = true;
  }

  function shrinkBank(number, length) {
    number = integer(number);
    length = integer(length);
    if (length <= 0) throw new Error('Invalid bank length');
    const bank = banks.get(number);
    if (!bank) throw new Error('Bank not reserved');
    if (bank.images) throw new Error('Cannot shrink an image bank');
    if (length > bank.data.length) throw new Error('Invalid bank length');
    if (length !== bank.data.length) {
      if (animations.has(bank)) throw new Error('Shrinking a Frame Load animation bank is not implemented');
      if (bank === musicBank) musicOff();
      if (bank === trackerBank) trackStop();
      bank.data = bank.data.slice(0, length);
    }
  }

  function saveBanks(filename, number = null) {
    if (!options.files || typeof options.files.write !== 'function') throw new Error('Bank saving requires a files host adapter');
    if (typeof bankWriterFactory !== 'function') throw new Error('Bank saving requires the BankWriter runtime');
    const path = resolveFileName(filename);
    const write = contents => {
      const result = options.files.write(path, contents);
      if (result && typeof result.then === 'function') throw new Error('Files host must write bank bytes synchronously');
    };
    if (number != null) number = integer(number);
    const grouped = number == null;
    // MODE_NEW opens/truncates the destination before bank lookup or UnRev.
    write('');
    if (!grouped && !banks.has(number)) {
      throw new Error('Bank not reserved');
    }
    const order = [...bankOrder.filter(key => banks.has(key)), ...Array.from(banks.keys()).filter(key => !bankOrder.includes(key))];
    const selected = grouped ? order.map(key => banks.get(key)) : [banks.get(number)];
    // Bnk.UnRev normalizes the live image and mask, not a temporary copy.
    for (const bank of selected) if (bank.images) for (const image of bank.images) if (image) orientImage(image, 0);
    write(bankWriterFactory.byteString(bankWriterFactory.write(selected, grouped)));
  }

  function imageBank(number) {
    const bank = banks.get(number);
    if (!bank || bank.type !== (number === 1 ? 'sprites' : 'icons')) throw new Error(`Image bank ${number} is not loaded`);
    return bank;
  }
  function bankImage(bankNumber, number, allowEmpty = false) {
    if (!Number.isInteger(number) || number < 1 || number > 2147483647 || !(number & 0x3fff)) throw new Error('Invalid image number');
    const bank = imageBank(bankNumber);
    const image = bank.images[(number & 0x3fff) - 1];
    if (!image && !(allowEmpty && (number & 0x3fff) <= bank.images.length)) throw new Error(`Image ${number} is missing or empty in bank ${bankNumber}`);
    return image;
  }
  function imageFlags(name, number) {
    return integer(number) | (name === 'Hrev' ? 0x8000 : name === 'Vrev' ? 0x4000 : 0xc000);
  }
  function orientImage(image, number) {
    const orientation = number & 0xc000;
    const change = orientation ^ image.orientation;
    if (!change) return;
    const flip = pixels => {
      const next = new Uint8Array(pixels.length);
      for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
          const fromX = change & 0x8000 ? image.width - 1 - x : x;
          const fromY = change & 0x4000 ? image.height - 1 - y : y;
          next[y * image.width + x] = pixels[fromY * image.width + fromX];
        }
      }
      return next;
    };
    image.pixels = flip(image.pixels);
    if (image.mask) image.mask = flip(image.mask);
    // RBobX/RBobY reflect hotspot coordinates around width/height, not
    // width-1/height-1, and retain the original word-sized signed fields.
    if (change & 0x8000) image.hotspotX = ((image.width - image.hotspotX) << 18) >> 18;
    if (change & 0x4000) image.hotspotY = ((image.height - image.hotspotY) << 16) >> 16;
    image.orientation = orientation;
  }
  function makeImageMask(image) {
    image.masked = true;
    image.mask = Uint8Array.from(image.pixels, pixel => pixel === 0 ? 0 : 1);
  }
  function setImageMask(bankNumber, masked, number = null) {
    const bank = imageBank(bankNumber);
    const images = number == null ? bank.images : [bankImage(bankNumber, number, true)];
    images.forEach(image => {
      if (!image) return;
      if (masked) makeImageMask(image);
      else { image.masked = false; image.mask = null; }
    });
    if (bankNumber === 1) imageBobsChanged();
  }
  function pasteImage(bankNumber, x, y, number) {
    const image = bankImage(bankNumber, number);
    orientImage(image, number);
    if (image.masked && !image.mask) makeImageMask(image);
    display.pasteGraphic(image, x, y, image.masked);
    if (bankNumber === 1) imageBobsChanged();
  }
  function captureImage(bankNumber, name, ...args) {
    if (args.length !== 5 && args.length !== 6) throw new Error(`Invalid ${name} argument count`);
    args = args.map(integer);
    const target = display.screen(args.length === 6 ? args.shift() : display.current);
    const [number, x1, y1, x2, y2] = args;
    if (number < 1 || number > 16383) throw new Error(`Unsupported ${name} number (expected 1..16383)`);
    if (x1 < 0 || y1 < 0 || x2 > target.width || y2 > target.height || x2 <= x1 || y2 <= y1) throw new Error(`Invalid ${name} rectangle`);
    const width = Math.ceil((x2 - x1) / 16) * 16, height = y2 - y1, depth = Math.log2(target.colours);
    if (width / 8 * height * depth >= 65536) throw new Error(`Unsupported ${name} planar payload size`);
    const old = banks.get(bankNumber);
    if (old && old.type !== (bankNumber === 1 ? 'sprites' : 'icons')) throw new Error(`${name} requires ${bankNumber === 1 ? "a sprite bank" : "an icon bank"} or empty bank ${bankNumber}`);
    // Read logical pixels as stored, including held Bobs. Capture is not a
    // drawing operation and must not restore Bobs or replay Autoback hooks.
    const pixels = new Uint8Array(width * height);
    for (let row = 0; row < height; row++) pixels.set(target.pixels.subarray((y1 + row) * target.width + x1,
      (y1 + row) * target.width + x2), row * width);
    const image = { width, height, depth, pixels, hotspotX: 0, hotspotY: 0, orientation: 0, masked: bankNumber === 1, mask: null };
    const images = old ? old.images.slice() : [];
    while (images.length < number) images.push(null);
    images[number - 1] = image;
    if (old) {
      bankMemory.release(old);
      old.images = images;
    } else {
      // Native new-bank allocation uses the selected screen's palette, even
      // when the explicit capture screen is different. Existing palettes stay.
      installBanks([{ number: bankNumber, type: bankNumber === 1 ? 'sprites' : 'icons', images, palette: display.screen().palette.slice() }]);
    }
    if (bankNumber === 1) imageBobsChanged();
  }
  let defaulting = false;
  function resetDefault() {
    if (defaulting) throw new Error('Reentrant Default is not supported');
    if (typeof display.resetDefault !== 'function') throw new Error('Display adapter does not support Default');
    if (!options.vblNow || !options.requestPaletteWake) throw new Error('Default requires the runtime VBL clock');
    // Validate the pure extension configuration before retiring display state.
    audio.prepareDefault();
    defaulting = true;
    try {
      cancelPaletteEffects(); amalRegisters.fill(0);
      bobs.clear(); drawnBobs = []; bobsDirty = false;
      priorityScreen = null; reversePriority = false;
      // ActuMask=$7100 resets automatic BOB/Sprite UPDATE bits 5/6 to off.
      automaticBobs = automaticSprites = false;
      state.breakEnabled = true;
      for (const sprite of sprites.values()) sprite.image = 0;
      spriteFrames.clear(); spritesDirty = false;
      spriteBuffer.resize(128); spriteBuffer.clear(); spriteBuffer.update(spriteFrames); publishSpriteBuffer();
      display.resetDefault();
      const limits = state.input.mouseLimits;
      if (!limits || (limits.x1 === 0 && limits.y1 === 0)) state.input.mouseLimits = Object.freeze({ x1:129, y1:50, x2:448, y2:249 });
      pointerShape = 1; setPointerCount(0);
      flash(3, '(000,2)(440,2)(880,2)(bb0,2)(dd0,2)(ee0,2)(ff2,2)(ff8,2)(ffc,2)(fff,2)(aaf,2)(88c,2)(66a,2)(226,2)(004,2)(001,2)');
      // MusDef stops owned controllers; it does not erase their banks or
      // change the LED/filter bit, directory, Timer or language random seed.
      trackStop(); state.tracker.loop = false; state.tracker.position = null;
      cancelMusic(); state.music.bank = null; state.music.position = null; state.music.volume = 56;
      audio.resetDefault();
    } finally { defaulting = false; }
  }
  function value(number) { return number && number.numericType ? number.value : number; }

  function numberFunction(name, operand, sourceType) {
    const type = sourceType === 'dynamic' ? operand.numericType : sourceType;
    const number = value(operand);
    // FnSgn/FnSgnF always return an integer. SPTst tests the FFP sign
    // before zero (the negative-zero case is library-version provisional).
    if (name === 'Sgn') return number < 0 || (type === 'float' && Object.is(number, -0)) ? -1 : number === 0 ? 0 : 1;
    // FnAbs uses NEG.L without an overflow guard; INT_MIN retains its bits.
    // FnInt is integer identity; FnIntF calls SPFloor and retains float type.
    const result = name === 'Abs' ? (type === 'integer' ? Math.abs(number) | 0 : Math.abs(number)) : type === 'integer' ? number : Math.floor(number);
    return sourceType === 'dynamic' ? { value: result, numericType: type } : result;
  }

  function integer(value) {
    const result = Math.trunc(value && value.numericType ? value.value : value);
    if (!Number.isFinite(result)) throw new Error('Invalid floating-point value');
    // FlToInt1/2 do not inspect SPFix's overflow flag. FFPFPI returns
    // the largest integer with the input's sign when it is out of range.
    return result < -2147483648 ? -2147483648 : result > 2147483647 ? 2147483647 : result === 0 ? 0 : result;
  }

  function checkedInteger(value) {
    const result = Math.trunc(value && value.numericType ? value.value : value);
    if (!Number.isFinite(result) || result < -2147483648 || result > 2147483647) throw new Error('Integer overflow');
    return result === 0 ? 0 : result;
  }

  function float(number, sourceType = 'dynamic') {
    const type = sourceType === 'dynamic' ? (number && number.numericType ? number.numericType : 'integer') : sourceType;
    const result = value(number);
    if (type === 'float') return result;
    const converted = checkedInteger(result);
    const magnitude = Math.abs(converted);
    if (magnitude === 0) return 0;
    // SPFlt normalizes a signed integer into a 24-bit FFP mantissa.
    // The first discarded bit rounds the magnitude up, including ties;
    // a carry into the next exponent must retain the normalized value.
    const quantum = Math.pow(2, Math.max(0, 8 - Math.clz32(magnitude)));
    const rounded = Math.floor(magnitude / quantum + 0.5) * quantum;
    return converted < 0 ? -rounded : rounded;
  }

  function divide(left, right) {
    if (right === 0) throw new Error('Division by zero');
    return left / right;
  }

  function floatParts(number) {
    const negative = number < 0;
    const magnitude = Math.abs(number);
    if (Number.isNaN(magnitude)) throw new Error('Invalid floating-point value');
    if (magnitude === 0 || magnitude < Math.pow(2, negative ? -65 : -64)) return null;
    const maximum = 16777215 * Math.pow(2, 39);
    if (magnitude >= maximum) return { mantissa: 16777215, exponent: 127, negative };
    let power = Math.floor(Math.log2(magnitude)) + 1;
    // Math.log2 can round to an integer at a power-of-two boundary.
    if (magnitude < Math.pow(2, power - 1)) power--;
    else if (magnitude >= Math.pow(2, power)) power++;
    let mantissa = Math.floor(magnitude / Math.pow(2, power - 24) + 0.5);
    if (mantissa === 16777216) { mantissa /= 2; power++; }
    return { mantissa, exponent: power + 64, negative };
  }

  function floatValue(mantissa, exponent, negative) {
    if (mantissa === 0 || exponent < 0 || (exponent === 0 && !negative)) return 0;
    if (exponent > 127) { mantissa = 16777215; exponent = 127; }
    const result = mantissa * Math.pow(2, exponent - 88);
    return negative ? -result : result;
  }

  function floatAdd(left, right, subtract = false) {
    const a = floatParts(left);
    const b = floatParts(subtract ? -right : right);
    if (!a) return b ? floatValue(b.mantissa, b.exponent, b.negative) : 0;
    if (!b) return floatValue(a.mantissa, a.exponent, a.negative);
    const strong = a.exponent >= b.exponent ? a : b;
    const weak = strong === a ? b : a;
    const shift = strong.exponent - weak.exponent;
    if (shift >= 24) return floatValue(strong.mantissa, strong.exponent, strong.negative);
    let exponent = strong.exponent;
    let negative = strong.negative;
    const aligned = Math.floor(weak.mantissa * 256 / Math.pow(2, shift));
    let extended;
    if (strong.negative === weak.negative) {
      // FFPADD adds the rounding byte before normalizing a carry.
      extended = strong.mantissa * 256 + aligned + 128;
      if (extended >= 4294967296) { extended = Math.floor(extended / 2); exponent++; }
    } else {
      // Equal exponents subtract exactly. Unequal exponents bias the
      // stronger operand; cancellation discards residue before shifting.
      extended = strong.mantissa * 256 - aligned + (shift ? 128 : 0);
      if (extended < 0) { extended = -extended; negative = weak.negative; }
      if (extended < 2147483648) {
        extended = Math.floor(extended / 256) * 256;
        if (extended === 0) return 0;
        while (extended < 2147483648) { extended *= 2; exponent--; }
      }
    }
    return floatValue(Math.floor(extended / 256), exponent, negative);
  }

  function floatMultiply(left, right) {
    const a = floatParts(left);
    const b = floatParts(right);
    if (!a || !b) return 0;
    const negative = a.negative !== b.negative;
    const sum = a.exponent + b.exponent;
    // FFPMUL2 tests the exponent sum before normalizing the product.
    if (sum < 64) return 0;
    if (sum >= 192) return floatValue(16777215, 128, negative);
    let exponent = sum - 64;
    // Two 24-bit mantissas multiply exactly within a JavaScript number.
    let extended = Math.floor(a.mantissa * b.mantissa / 65536);
    if (extended >= 2147483648) extended += 128;
    else {
      exponent--;
      if (exponent < 0) return 0;
      extended = (extended + 64) * 2;
      if (extended >= 4294967296) { extended = Math.floor(extended / 2); exponent++; }
    }
    return floatValue(Math.floor(extended / 256), exponent, negative);
  }

  function floatDivide(left, right) {
    const a = floatParts(left);
    const b = floatParts(right);
    if (!b) throw new Error('Division by zero');
    if (!a) return 0;
    const negative = a.negative !== b.negative;
    const difference = a.exponent - b.exponent;
    if (difference < -64) return 0;
    if (difference > 63) return floatValue(16777215, 128, negative);
    const divisorHigh = Math.floor(b.mantissa / 256);
    const shifted = Math.floor(a.mantissa / 256) >= divisorHigh;
    if (shifted && difference === 63) return floatValue(16777215, 128, negative);
    let exponent = difference + 64 + (shifted ? 1 : 0);
    const dividend = a.mantissa * (shifted ? 128 : 256);
    let high = Math.floor(dividend / divisorHigh);
    let remainder = dividend * 256 - high * b.mantissa;
    // FFPDIV corrects its first estimate once, then works with a 32-bit
    // remainder. Its second DIVU uses the divisor's high word again.
    if (remainder < 0) { remainder += b.mantissa; high--; }
    remainder &= 0xffffff;
    const estimate = Math.floor(Math.floor(remainder / 256) * 65536 / divisorHigh);
    // A 68000 DIVU overflow leaves the dividend intact; its cleared low
    // word then contributes zero to the assembled quotient.
    const low = estimate > 65535 ? 0 : estimate;
    let extended = high * 65536 + low;
    if (high < 32768) { extended *= 2; exponent--; }
    extended = (extended + 128) % 4294967296;
    return floatValue(Math.floor(extended / 256), exponent, negative);
  }

  // Inverse hyperbolic tangents in the Motorola BIN(31,29) format.
  const hyperbolicAngles = [
    0x8c9f53d0, 0x4162bbe8, 0x202b1238, 0x10055888,
    0x0800aac0, 0x04001550, 0x020002a8, 0x01000050,
    0x00800008, 0x00400000, 0x00200000, 0x00100000,
    0x00080000, 0x00040000, 0x00020000, 0x00010000,
    0x00008000, 0x00004000, 0x00002000, 0x00001000,
    0x00000800, 0x00000400, 0x00000200
  ].map(angle => angle >>> 3);
  const logTwo = 0xb17218 * Math.pow(2, -24);

  function fixedFloat(number) {
    const parts = floatParts((number | 0) / 536870912);
    return parts ? floatValue(parts.mantissa, parts.exponent, parts.negative) : 0;
  }

  function floatSqrt(number) {
    // FnSqr checks FlPos before SPSqrt. Preserve that domain check even
    // when the input is too small to survive normalization.
    if (number < 0 || Object.is(number, -0)) throw new Error('Illegal function call: Sqr');
    const parts = floatParts(number);
    if (!parts) return 0;
    // FFPSQRT's restoring recurrence generates 24 mantissa bits and then
    // rounds on the next test, without overflowing an all-ones mantissa.
    const scaled = parts.mantissa * (parts.exponent & 1 ? 1 : 2);
    let remainder = scaled - 0x800000, trial = scaled - 0x1200000;
    let mantissa = 0x800000;
    for (let bit = 22; bit >= 0; bit--) {
      if (trial >= 0) { mantissa += Math.pow(2, bit); remainder = trial; }
      remainder = (remainder * 2) | 0;
      trial = (remainder - (bit >= 2 ? Math.pow(2, bit - 2) : 0) - mantissa) | 0;
    }
    if ((remainder >>> 0) > mantissa && mantissa < 0xffffff) mantissa++;
    return floatValue(mantissa, Math.ceil(parts.exponent / 2) + 32, false);
  }

  function floatLog(number) {
    const parts = floatParts(number);
    if (!parts) return -16777215 * Math.pow(2, 39);
    const normalized = parts.mantissa / 8388608;
    const ratio = floatDivide(floatAdd(normalized, 1, true), floatAdd(normalized, 1));
    let x = Math.floor(ratio * 536870912) | 0;
    let y = 536870912;
    let z = 0;
    if (ratio) {
      for (let shift = 1; shift <= 23; shift++) {
        // Repeat an accepted rotation; advance only when X would turn
        // negative. All work registers retain signed 32-bit behavior.
        for (;;) {
          const next = (x - (y >> shift)) | 0;
          if (next < 0) break;
          y = (y - (x >> shift)) | 0;
          x = next;
          z = (z + hyperbolicAngles[shift - 1]) | 0;
        }
      }
    }
    const fraction = fixedFloat(z) * 2;
    const exponent = parts.exponent - 65;
    return exponent ? floatAdd(floatMultiply(exponent, logTwo), fraction) : fraction;
  }

  function naturalLog(number) {
    // FnLn calls FlPos before dispatching to the math library. Zero is
    // allowed through and the library returns its finite negative limit.
    if (number < 0 || Object.is(number, -0)) throw new Error('Illegal function call: Ln');
    return floatLog(number);
  }

  function floatExp(number) {
    const parts = floatParts(number);
    if (!parts) return 1;
    const magnitude = floatValue(parts.mantissa, parts.exponent, false);
    const scaled = floatMultiply(magnitude, 0xb8aa3b / 8388608);
    const maximum = 16777215 * Math.pow(2, 39);
    if (scaled >= 128) return parts.negative ? 0 : maximum;
    let multiple = Math.floor(scaled);
    const residue = multiple ? floatAdd(magnitude, floatMultiply(multiple, logTwo), true) : magnitude;
    // A negative reduction residue has no usable fixed-point bits in
    // FFPEXP's unsigned shift conversion.
    let angle = residue > 0 ? Math.floor(residue * 536870912) | 0 : 0;
    let x = 0x26a3d100;
    let y = 0;
    const shifts = [...Array.from({ length: 4 }, (_, i) => i + 1),
      ...Array.from({ length: 10 }, (_, i) => i + 4),
      ...Array.from({ length: 11 }, (_, i) => i + 13)];
    for (const shift of shifts) {
      const dx = x >> shift;
      const dy = y >> shift;
      if (angle >= 0) {
        y = (y + dx) | 0;
        x = (x + dy) | 0;
        angle = (angle - hyperbolicAngles[shift - 1]) | 0;
      } else {
        y = (y - dx) | 0;
        x = (x - dy) | 0;
        angle = (angle + hyperbolicAngles[shift - 1]) | 0;
      }
    }
    if (parts.negative) { y = -y; multiple = -multiple; }
    const result = floatParts(fixedFloat((x + y) | 0));
    const exponent = result.exponent + multiple;
    if (exponent <= 0 || exponent > 127) return parts.negative ? 0 : maximum;
    return floatValue(result.mantissa, exponent, false);
  }

  function floatPower(base, exponent) {
    return floatExp(floatMultiply(floatLog(Math.abs(base)), exponent));
  }

  const circularAngles = [
    0xc90fdaa2, 0x76b19c15, 0x3eb6ebf2, 0x1fd5ba9a,
    0x0ffaaddb, 0x07ff556e, 0x03ffeaab, 0x01fffd55,
    0x00ffffaa, 0x007ffff5, 0x003ffffe, 0x001fffff,
    0x000fffff, 0x0007ffff, 0x0003ffff, 0x0001ffff,
    0x0000ffff, 0x00007fff, 0x00003fff, 0x00001fff,
    0x00000fff, 0x000007ff, 0x000003ff, 0x000001ff
  ].map(angle => angle >>> 3);

  function trigFloat(number) {
    // FSFLOAT drops positive values <=255 and negative values >=-256
    // in the circular CORDIC's BIN(31,29) working representation.
    if (number >= -256 && number <= 255) return 0;
    return fixedFloat(number);
  }

  function floatTrig(number, kind) {
    if (degrees) number = floatMultiply(floatDivide(number, 180), 0xc90fd9 / 4194304);
    const parts = floatParts(number);
    if ((!parts || parts.exponent <= 56) && kind !== 'Cos') {
      return parts ? floatValue(parts.mantissa, parts.exponent, parts.negative) : 0;
    }
    if (parts && parts.exponent > 84) {
      // FPSCOM doubles the exponent byte before its precision check.
      // Its early return leaves that byte altered; AMOS ignores V.
      const byte = (parts.exponent * 2) & 255;
      return floatValue(parts.mantissa, byte & 127, !!(byte & 128));
    }
    let reduced = parts ? floatValue(parts.mantissa, parts.exponent, parts.negative) : 0;
    if (parts && parts.exponent > 69) {
      const cycles = Math.trunc(floatMultiply(reduced, 0xa2f983 / 67108864));
      reduced = floatAdd(reduced, floatMultiply(cycles, 0xc90fdb / 2097152), true);
    }
    const pi = 0xc90fdaa2 >>> 4;
    let angle = Math.trunc(Math.abs(reduced) * 67108864);
    if (reduced < 0) angle = -angle;
    while (angle > pi) angle -= pi * 2;
    while (angle < -pi) angle += pi * 2;
    angle = (angle * 8) | 0;
    let x = 0;
    let y = 0xec916240 | 0;
    if (angle >= 0) { y = -y; angle = (angle - (0xc90fdaa2 >>> 2)) | 0; }
    else angle = (angle + (0xc90fdaa2 >>> 2)) | 0;
    for (let shift = 0; shift < 24; shift++) {
      const dx = x >> shift;
      const dy = y >> shift;
      if (angle >= 0) {
        x = (x - dy) | 0;
        y = (y + dx) | 0;
        angle = (angle - circularAngles[shift]) | 0;
      } else {
        x = (x + dy) | 0;
        y = (y - dx) | 0;
        angle = (angle + circularAngles[shift]) | 0;
      }
    }
    const sine = trigFloat(y);
    if (kind === 'Sin') return sine;
    const cosine = trigFloat(x);
    return kind === 'Cos' ? cosine : cosine === 0 ? 16777215 * Math.pow(2, 39) : floatDivide(sine, cosine);
  }

  function integerOperation(operator, left, right) {
    // Original evaluator: Op_Plus/Op_Moins check overflow, Op_Div returns
    // the signed 32-bit quotient. Op_Modulo divides an unsigned dividend
    // by the divisor's magnitude, retaining the dividend when it is zero.
    const a = integer(left);
    const b = integer(right);
    switch (operator) {
      case '+': return checkedInteger(a + b);
      case '-': return checkedInteger(a - b);
      case '*': {
        // Op_Mult's quick MULU path uses the low 32 bits with no overflow
        // check when both magnitudes fit in 16 bits. Its slow path checks
        // the positive magnitude before restoring the result's sign.
        const magnitudeA = Math.abs(a);
        const magnitudeB = Math.abs(b);
        if (magnitudeA >= 65536 || magnitudeB >= 65536) checkedInteger(magnitudeA * magnitudeB);
        return (a * b) | 0;
      }
      case '/': return Math.trunc(divide(a, b)) | 0;
      case 'Mod': return b === 0 ? a : ((a >>> 0) % Math.abs(b)) | 0;
      default: throw new Error(`Unsupported integer operator ${operator}`);
    }
  }

  function addStrings(left, right) {
    // Op_Plus returns a nonempty operand directly when the other is empty.
    // Only concatenating two nonempty strings checks String_Max (0xffc0).
    if (!left.length) return right;
    if (!right.length) return left;
    if (left.length + right.length >= 65472) throw new Error('String too long');
    return left + right;
  }

  function subtractStrings(left, right) {
    if (!right) return left;
    while (left.includes(right)) left = left.replace(right, '');
    return left;
  }

  function dim(bounds, type) {
    if (!bounds.length || bounds.some(bound => !Number.isInteger(bound) || bound < 0 || bound > 65535)) throw new Error('Invalid array dimensions');
    const dimensions = bounds.map(bound => bound + 1);
    if (!Number.isSafeInteger(dimensions.reduce((total, size) => total * size, 1))) throw new Error('Array dimensions are too large');
    return { dimensions, values: new Map(), defaultValue: type === 'string' ? '' : 0 };
  }

  function arrayIndex(array, indices) {
    if (!array) throw new Error('Array not dimensioned');
    if (array.dimensions.length !== indices.length) throw new Error('Wrong number of array indices');
    let offset = 0;
    indices.forEach((index, i) => {
      if (!Number.isInteger(index) || index < 0 || index >= array.dimensions[i]) throw new Error('Array index out of bounds');
      offset = offset * array.dimensions[i] + index;
    });
    return offset;
  }

  function arrayTargetIndex(array, indices) {
    if (!array) throw new Error('Array not dimensioned');
    if (array.dimensions.length !== indices.length) throw new Error('Wrong number of array indices');
    let offset = 0;
    for (let dimension = 0; dimension < indices.length; dimension++) {
      const index = indices[dimension]();
      if (!Number.isInteger(index) || index < 0 || index >= array.dimensions[dimension]) throw new Error('Array index out of bounds');
      offset = offset * array.dimensions[dimension] + index;
    }
    return offset;
  }

  function arrayGet(array, indices) {
    const index = arrayIndex(array, indices);
    return array.values.has(index) ? array.values.get(index) : array.defaultValue;
  }

  function arraySet(array, indices, value) {
    const index = arrayIndex(array, indices);
    array.values.set(index, value);
  }

  function readData(type) {
    if (state.data.index >= state.data.entries.length) throw new Error('Out of Data');
    const entry = state.data.entries[state.data.index++];
    if (entry.type === 'empty') return type === 'string' ? '' : 0;
    if ((entry.type === 'string') !== (type === 'string')) throw new Error('Data type mismatch');
    const value = entry.read(state);
    return type === 'integer' ? integer(value) : type === 'float' ? float(value, entry.type) : value;
  }

  function nonnegative(value) {
    const length = integer(value);
    if (length < 0) throw new Error('Invalid string length');
    return length;
  }

  function count(value) {
    const length = nonnegative(value);
    // RString allocates using the long count but stores a word length and
    // uses word loop counters. The portable runtime has no AMOS heap model.
    return length & 65535;
  }

  function decimalFloat(text) {
    // ValRout copies at most 33 non-space bytes for a2ffp. That converter
    // accumulates digits with private FFP multiply/add routines, then
    // multiplies by a decimal scale built with repeated FFP operations.
    const match = /^([+-]?)([\d.]*)(?:[eE]([+-]?\d*))?/.exec(text.slice(0, 33));
    const digits = match[2];
    const point = digits.indexOf('.');
    const fractional = point < 0 ? 0 : digits.length - point - 1;
    let mantissa = 0;
    for (const digit of digits) if (digit !== '.') mantissa = floatAdd(floatMultiply(mantissa, 10), Number(digit));
    const exponentText = match[3] || '';
    let exponent = 0;
    for (const digit of exponentText.replace(/^[+-]/, '')) exponent = (exponent * 10 + Number(digit)) & 0xffff;
    if (exponentText[0] === '-') exponent = -exponent;
    const adjustment = ((exponent - fractional) << 16) >> 16;
    let scale = 1;
    for (let i = 0; i < Math.abs(adjustment); i++) {
      const next = adjustment < 0 ? floatDivide(scale, 10) : floatMultiply(scale, 10);
      if (next === scale) break;
      scale = next;
      if (scale === 0) break;
    }
    const result = floatMultiply(mantissa, scale);
    return result === 0 ? 0 : match[1] === '-' ? -result : result;
  }

  function parseNumber(text) {
    const leading = text.replace(/^ +/, '');
    const sign = /^([+-]?) */.exec(leading);
    const body = leading.slice(sign[0].length);
    const negative = sign[1] === '-';
    const boxed = (value, numericType = 'integer') => ({ value, numericType });
    if (body[0] === '$' || body[0] === '%') {
      const hexadecimal = body[0] === '$';
      const rest = hexadecimal ? body.slice(1) : body.slice(1).replace(/ /g, '');
      let magnitude = 0;
      if (hexadecimal) {
        const digits = /^[0-9a-f]*/i.exec(rest)[0];
        if (!digits.length || digits.length > 8) return boxed(0);
        magnitude = parseInt(digits, 16);
      } else {
        let index = 0;
        for (; index < 33 && /[01]/.test(rest[index] || 'x'); index++) {
          if (magnitude >= 2147483648) return boxed(0);
          magnitude = magnitude * 2 + Number(rest[index]);
        }
        if (!index) return boxed(0);
        // binlong branches into declong after its 33rd bit.
        if (index === 33) {
          for (; /\d/.test(rest[index] || 'x'); index++) {
            magnitude = magnitude * 10 + Number(rest[index]);
            if (magnitude > 2147483647) return boxed(0);
          }
        }
      }
      return boxed(((magnitude | 0) * (negative ? -1 : 1)) | 0);
    }
    const clean = (sign[1] + body).replace(/ /g, '');
    const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d*))([eE][+-]?\d*)?/.exec(clean);
    if (!match) return boxed(0);
    const decimal = match[3] != null || match[4] != null || /^[eE](?:[+-]|\d)/.test(match[5] || '');
    if (decimal) return boxed(decimalFloat(match[0]), 'float');
    // declong checks the positive magnitude before ValRout applies a sign.
    const magnitude = Number(match[2]);
    return boxed(magnitude > 2147483647 ? 0 : (negative ? -magnitude : magnitude) || 0);
  }

  function val(text) { return parseNumber(text); }

  function numericUnary(operator, operand) {
    const result = operator === '-' ? -operand.value : operand.value;
    return { value: operand.numericType === 'integer' ? result | 0 : result, numericType: operand.numericType };
  }

  function numericBinary(operator, left, right, leftType, rightType) {
    let a = value(left);
    let b = value(right);
    const type = (leftType === 'dynamic' ? left.numericType : leftType) === 'float' || (rightType === 'dynamic' ? right.numericType : rightType) === 'float' || operator === '^' ? 'float' : 'integer';
    if (operator === 'Mod') return integerOperation(operator, a, b);
    if (type === 'integer' && ['+', '-', '*', '/'].includes(operator)) return { value: integerOperation(operator, a, b), numericType: type };
    if (type === 'float' && !['And', 'Or', 'Xor'].includes(operator)) {
      a = float(left, leftType);
      b = float(right, rightType);
    }
    let result;
    switch (operator) {
      case '+': result = floatAdd(a, b); break;
      case '-': result = floatAdd(a, b, true); break;
      case '*': result = floatMultiply(a, b); break;
      case '/': result = floatDivide(a, b); break;
      case '^': result = floatPower(a, b); break;
      case '=': return a === b ? -1 : 0;
      case '<>': return a !== b ? -1 : 0;
      case '<': return a < b ? -1 : 0;
      case '>': return a > b ? -1 : 0;
      case '<=': case '#<=': return a <= b ? -1 : 0;
      case '>=': case '#>=': return a >= b ? -1 : 0;
      case 'And': return integer(a) & integer(b);
      case 'Or': return integer(a) | integer(b);
      case 'Xor': return integer(a) ^ integer(b);
      default: throw new Error(`Unsupported numeric operator ${operator}`);
    }
    return { value: type === 'integer' ? integer(result) : result, numericType: type };
  }

  function minimumMaximum(left, right, leftType, rightType, maximum) {
    const type = (leftType === 'dynamic' ? left.numericType : leftType) === 'float' || (rightType === 'dynamic' ? right.numericType : rightType) === 'float' ? 'float' : 'integer';
    const a = type === 'float' ? float(left, leftType) : value(left);
    const b = type === 'float' ? float(right, rightType) : value(right);
    const result = maximum ? (a > b ? a : b) : (a < b ? a : b);
    if (leftType !== 'dynamic' && rightType !== 'dynamic') return result;
    return { value: result, numericType: type };
  }

  function replaceSubstring(name, original, args, read) {
    let start = 0;
    let length = args[0];
    if (name === 'Right$') {
      // InRight rejects a negative length before reading the RHS.
      if (length < 0) throw new Error('Invalid substring length');
      start = Math.max(0, original.length - length);
    } else if (name === 'Mid$' || name === 'Mid$2') {
      start = args[0] < 0 ? args[0] : Math.max(0, args[0] - 1);
      length = name === 'Mid$2' ? 65535 : args[1];
    }
    const replacement = read();
    // RInMid2 checks the offset before length. Past-end writes do nothing,
    // even with a negative count; negative offsets always raise an error.
    if (start < 0) throw new Error('Invalid substring position');
    if (start >= original.length) return original;
    if (length < 0) throw new Error('Invalid substring length');
    const count = Math.min(length, original.length - start, replacement.length);
    return original.slice(0, start) + replacement.slice(0, count) + original.slice(start + count);
  }

  function substring(name, original, first, second) {
    let start = 0;
    let length = integer(first);
    if (name === 'Right$') {
      // FnRight checks its count even for an empty destination.
      if (length < 0) throw new Error('Invalid string length');
      start = Math.max(0, original.length - length);
      length = 65535;
    } else if (name === 'Mid$' || name === 'Mid$2') {
      start = length < 0 ? length : Math.max(0, length - 1);
      length = name === 'Mid$2' ? 65535 : integer(second);
    }
    // RFnMid checks the start before the requested length. In particular,
    // Left$("", -1) and Mid$("abc", 99, -1) return empty strings.
    if (start < 0) throw new Error('Invalid string position');
    if (start >= original.length) return '';
    if (length < 0) throw new Error('Invalid string length');
    return original.slice(start, start + length);
  }

  function atString(x = null, y = null) {
    // FnAt encodes a pure byte string; cursor movement occurs only on output.
    const coordinate = value => {
      if (value == null) return null;
      value = integer(value);
      if (value === -2147483648) return null; // EntNul
      if (value < 0 || value > 207) throw new Error('At coordinate must be in 0..207');
      return value;
    };
    y = coordinate(y); x = coordinate(x);
    return (x == null ? '' : '\x1bX' + String.fromCharCode(48 + x)) +
      (y == null ? '' : '\x1bY' + String.fromCharCode(48 + y));
  }
  function stringFunction(name, args) {
    const [a, b, c] = args;
    switch (name) {
      case 'Left$': case 'Right$': case 'Mid$': case 'Mid$2': return substring(name, a, b, c);
      case 'Flip$': return a.split('').reverse().join('');
      case 'Chr$': {
        const code = integer(a);
        if (code < 0 || code > 255) throw new Error('Invalid character code');
        return String.fromCharCode(code);
      }
      case 'Space$': return ' '.repeat(count(a));
      case 'String$': return a.length ? a[0].repeat(count(b)) : '';
      case 'Upper$': return a.replace(/[a-z]/g, value => value.toUpperCase());
      case 'Lower$': return a.replace(/[A-Z]/g, value => value.toLowerCase());
      case 'Str$': return (value(a) < 0 ? '' : ' ') + String(value(a));
      case 'Len': return a.length;
      case 'Asc': return a.length ? a.charCodeAt(0) : 0;
      case 'Instr': case 'Instr3': {
        const start = name === 'Instr3' ? integer(c) : 1;
        if (start < 0) throw new Error('Invalid string position');
        return b.length ? a.indexOf(b, Math.max(0, start - 1)) + 1 : 0;
      }
      default: throw new Error(`Unsupported string function ${name}`);
    }
  }

  function formatUsing(format, read, sourceType) {
    if (typeof format !== 'string' || /[^\x00-\xff]/.test(format)) throw new Error('Print Using requires a byte-string format');
    if (format.length >= 120) throw new Error('Print Using format must be shorter than 120 bytes');
    format = format.split('\0')[0];
    const operand = read(), type = sourceType === 'dynamic' ? operand.numericType : sourceType, item = value(operand);
    if (type === 'string') {
      if (item.length > 121) throw new Error('Long-string Print Using is not implemented');
      const chars = item.split('\0')[0]; let index = 0;
      return format.replace(/~/g, () => index < chars.length ? chars[index++] : ' ');
    }
    if (type !== 'integer') throw new Error('Floating-point Print Using is not implemented');
    if (!Number.isInteger(item) || item < -2147483648 || item > 2147483647) throw new Error('Invalid Print Using integer');
    if (/[.;^]/.test(format)) throw new Error('Decimal/exponent Print Using formats are not implemented');
    // LongToAsc's positive prefix is a space; UsingC consumes digits backwards
    // and copies that prefix only for an explicit sign field. Overflow truncates.
    const number = (item < 0 ? '-' : ' ') + String(Math.abs(item));
    let index = number.length;
    const result = Array.from(format);
    for (let at = format.length - 1; at >= 0; at--) {
      const c = format[at];
      if (c === '#') result[at] = index > 0 ? (/^[0-9]$/.test(number[--index]) ? number[index] : ' ') : ' ';
      else if (c === '-') result[at] = number[0];
      else if (c === '+') result[at] = item < 0 ? '-' : '+';
    }
    return result.join('');
  }

  const channels = new Map();
  let portsTerminated = false;
  function frameLoad(channel, number, count) {
    if (number < 1 || number >= 1024 || count < 1 || count > 32767) throw new Error('Unsupported Frame Load bank/count');
    const file = fileChannel(channel, 'read');
    if (file.contents.length > 16 * 1024 * 1024) throw new Error('ANIM file exceeds 16 MiB');
    const decoded = animReaderFactory(Uint8Array.from(file.contents, c => c.charCodeAt(0)), { position: file.position, count });
    const bank = { number, type: 'data', memory: 'fast', permanent: false, name: 'Iff     ', data: decoded.raw.slice() };
    installBanks([bank]); animations.set(bank, decoded); file.position = decoded.nextPosition;
    return decoded.frames.length;
  }
  function framePlay(selector, count) {
    if (count < 0 || count >= 32768) throw new Error('Invalid Frame Play count');
    const address = bankMemory.address(selector), access = bankMemory.locate(address), decoded = animations.get(access.bank);
    if (!decoded || access.bank.data.length !== decoded.raw.length || !access.bank.data.every((v, i) => v === decoded.raw[i])) throw new Error('Frame Play requires an unchanged Frame Load bank');
    const index = decoded.frames.findIndex(frame => frame.offset === access.offset);
    if (access.offset === decoded.sentinel) return address;
    if (index < 0) throw new Error('Frame Play address is not a frame boundary');
    const selected = decoded.frames.slice(index, index + count);
    if (!selected.length) return address;
    display.playAnimationFrames(decoded, selected);
    const next = index + selected.length;
    return bankMemory.start(access.bank.number) + (next < decoded.frames.length ? decoded.frames[next].offset : decoded.sentinel);
  }
  function fileChannel(number, mode = null) {
    if (!Number.isInteger(number) || number < 1 || number > 10) throw new Error('Invalid file channel');
    const file = channels.get(number);
    if (!file) throw new Error('File channel is not open');
    if (file.busy) throw new Error('File channel is busy in a port callback');
    if (mode && file.mode !== mode) throw new Error('Wrong file access mode');
    return file;
  }

  function fileOpen(number, name, mode) {
    if (!Number.isInteger(number) || number < 1 || number > 10) throw new Error('Invalid file channel');
    if (channels.has(number)) throw new Error('File channel is already open');
    if (mode === 'Open Port') {
      if (portsTerminated) throw new Error('Port session has terminated');
      if (typeof name !== 'string' || !name.length || /[^\x01-\xff]/.test(name)) throw new Error('Invalid port device name');
      if (!options.ports || typeof options.ports.open !== 'function') throw new Error('Open Port requires a synchronous ports host adapter');
      const entry = { mode: 'port', name, busy: true }; channels.set(number, entry);
      try {
        const handle = options.ports.open(name, Object.freeze({ channel: number }));
        if (!handle || typeof handle.then === 'function' || typeof handle.write !== 'function' || typeof handle.close !== 'function') throw new Error('Port open must return a synchronous write/close handle');
        entry.handle = handle; entry.busy = false;
        if (portsTerminated) {
          channels.delete(number);
          const result = handle.close();
          if (result && typeof result.then === 'function') throw new Error('Port close must complete synchronously');
          throw new Error('Port session terminated during open');
        }
      } catch (error) { if (channels.get(number) === entry) channels.delete(number); throw error; }
      return;
    }
    if (!options.files || typeof options.files.read !== 'function' || typeof options.files.write !== 'function') throw new Error('File I/O requires a files host adapter');
    name = resolveFileName(name);
    let contents = '';
    if (mode !== 'Open Out') {
      try { contents = options.files.read(name); }
      catch (error) { if (mode !== 'Append' || error.code !== 'ENOENT') throw error; }
    }
    if (typeof contents !== 'string' || /[^\x00-\xff]/.test(contents)) throw new Error('Files host must return a byte string synchronously');
    channels.set(number, { name, mode: mode === 'Open In' ? 'read' : 'write', contents, position: mode === 'Append' ? contents.length : 0 });
  }

  function fileClose(number = null) {
    const entries = number == null ? Array.from(channels) : [[number, fileChannel(number)]];
    for (const [value, expected] of entries) {
      if (channels.get(value) !== expected) continue;
      const file = fileChannel(value);
      if (file.mode === 'port') {
        channels.delete(value); // Consume before notifying the host, as native Close does.
        const result = file.handle.close();
        if (result && typeof result.then === 'function') throw new Error('Port close must complete synchronously');
        continue;
      }
      if (file.mode === 'write') {
        const result = options.files.write(file.name, file.contents);
        if (result && typeof result.then === 'function') throw new Error('Files host must write synchronously');
      }
      channels.delete(value);
    }
  }

  function filePrint(number, values, separators) {
    const file = fileChannel(number);
    if (!['write', 'port'].includes(file.mode)) throw new Error('Wrong file access mode');
    let text = '';
    values.forEach((entry, i) => { text += String(value(entry)); if (separators[i] === ',') text += '\t'; });
    if (!values.length || separators.length < values.length) text += '\r\n';
    if (file.mode === 'port') {
      if (/[^\x00-\xff]/.test(text)) throw new Error('Port output must contain byte characters');
      file.busy = true; let failure = null;
      try {
        const result = file.handle.write(text);
        if (result && typeof result.then === 'function') throw new Error('Port writes must complete synchronously');
      } catch (error) { failure = error; }
      finally { file.busy = false; }
      // Terminal disposal requested inside write takes effect after that callback.
      if (portsTerminated && channels.get(number) === file) {
        channels.delete(number);
        try {
          const result = file.handle.close();
          if (result && typeof result.then === 'function') throw new Error('Port close must complete synchronously');
        } catch (error) { if (!failure) failure = error; }
      }
      if (failure) throw failure;
    } else { file.contents += text; file.position = file.contents.length; }
  }

  function closePorts() {
    portsTerminated = true;
    const pending = [...channels].filter(([, entry]) => entry.mode === 'port' && !entry.busy);
    for (const [number] of pending) channels.delete(number);
    let failure = null;
    for (const [, entry] of pending) try {
      const result = entry.handle.close();
      if (result && typeof result.then === 'function') throw new Error('Port close must complete synchronously');
    } catch (error) { if (!failure) failure = error; }
    if (failure) throw failure;
  }

  function fileRead(number, type, wholeLine = false) {
    const file = fileChannel(number, 'read');
    if (file.position >= file.contents.length) throw new Error('End of file');
    let end = file.position;
    while (end < file.contents.length && file.contents[end] !== '\r' && file.contents[end] !== '\n' && (wholeLine || file.contents[end] !== ',')) end++;
    const value = file.contents.slice(file.position, end);
    file.position = end;
    if (file.contents[file.position] === ',') file.position++;
    else {
      if (file.contents[file.position] === '\r') file.position++;
      if (file.contents[file.position] === '\n') file.position++;
    }
    if (value.length > 1000) throw new Error('File input too long');
    if (type === 'string') return value;
    const result = parseNumber(value);
    return type === 'integer' ? integer(result) : float(result);
  }

  function fileInfo(name, number) {
    const file = fileChannel(number);
    if (file.mode === 'port') throw new Error('Disc information is not available for ports');
    if (name === 'Eof') return file.position >= file.contents.length ? -1 : 0;
    if (name === 'Lof') return file.contents.length;
    if (name === 'Pof') return file.position;
    throw new Error(`Unsupported file information ${name}`);
  }

  function setMouseAxis(axis, value) {
    if (axis !== 'x' && axis !== 'y') throw new Error('Invalid mouse axis');
    value = integer(value);
    if (value === -2147483648) return; // Native EntNul leaves this axis alone.
    const limits = state.input.mouseLimits;
    if (!limits) throw new Error('Mouse assignment requires explicit Limit Mouse bounds');
    // MSetAb clamps unsigned doubled words in this order, then halves. Host
    // injection intentionally retains its existing, independently bounded path.
    let position = (value << 1) & 65535;
    const low = (limits[`${axis}1`] << 1) & 65535, high = (limits[`${axis}2`] << 1) & 65535;
    if (position < low) position = low;
    if (position >= high) position = high;
    state.input.mouse[axis] = position >>> 1;
  }
  function limitMouse(x1, y1, x2, y2) {
    display.screen();
    x1 = integer(x1) & 65535; y1 = integer(y1) & 65535;
    x2 = Math.min(458, integer(x2) & 65535); y2 = Math.min(312, integer(y2) & 65535);
    if (x1 & 32768) x1 = 0;
    if (y1 & 32768) y1 = 0;
    if (x1 > x2) [x1, x2] = [x2, x1];
    if (y1 > y2) [y1, y2] = [y2, y1];
    // Like the source, defining limits does not immediately reposition the mouse.
    state.input.mouseLimits = Object.freeze({ x1, y1, x2, y2 });
  }
  function limitMouseScreen(id = null) {
    display.screen();
    if (id != null) { id = integer(id); if (id < 0 || id > 7) throw new Error('Unsupported mouse screen (expected 0..7)'); }
    const target = id == null ? display.screen() : display.screen(id);
    limitMouse(target.hardwareX, target.hardwareY,
      display.coordinate('X Hard', target.id, target.width - 1), display.coordinate('Y Hard', target.id, target.height - 1));
  }
  function inputValue(name) {
    if (name === 'Inkey$') {
      if (!state.input.keys.length) return '';
      const entry = state.input.keys.shift();
      if (entry === '' || (typeof entry === 'object' && entry.scanCode === 0 && entry.key === '\0')) return '';
      state.input.scanCode = typeof entry === 'string' ? 0 : entry.scanCode;
      return typeof entry === 'string' ? entry : entry.key;
    }
    if (name === 'Scancode') { const code = state.input.scanCode; state.input.scanCode = 0; return code; }
    if (name === 'X Mouse') return state.input.mouse.x;
    if (name === 'Y Mouse') return state.input.mouse.y;
    if (name === 'Mouse Key') return state.input.mouse.buttons;
    if (name === 'Mouse Zone') return display.mouseZone(state.input.mouse.x, state.input.mouse.y);
    if (name === 'Mouse Click') {
      const now = state.input.mouse.buttons, clicked = now & ~state.input.mouseClick;
      state.input.mouseClick = now;
      return clicked;
    }
    throw new Error(`Unsupported input query ${name}`);
  }

  return {
    setDirectory, currentDirectory: () => directory, fileExists,
    trackPlay, trackStop, advanceTracker, pauseTracker, resumeTracker,
    musicPlay, musicVolume, musicOff, cancelMusic, advanceMusic, pauseMusic, resumeMusic,
    nextMusicVbl: () => musicNext,
    musicLocation: () => musicLocation,
    nextTrackerVbl: () => trackerNext,
    trackerLocation: () => trackerLocation,
    fileSelector,
    rnd, randomize,
    bload, bsave,
    limitMouse, limitMouseScreen,
    flash, flashOff, advancePalette, cancelPaletteEffects,
    nextPaletteVbl: () => { const job = nextPaletteJob(); return job ? job.nextVbl : null; },
    paletteLocation: () => { const job = nextPaletteJob(); return job && job.location; },
    fade, fadeColours, advanceFade, cancelFade,
    nextFadeVbl: () => fading ? fading.nextVbl : null,
    fadeLocation: () => fading && fading.location,
    display, inputValue, setMouseAxis, banks, loadBanks, saveBanks, eraseBank, eraseTemp, bankLength, swapBanks, shrinkBank,
    eraseAll: () => installBanks([], [], true),
    reserveWork: (number, length) => reserveBank(number, length, false, 'fast'),
    reserveChipWork: (number, length) => reserveBank(number, length, false, 'chip'),
    reserveData: (number, length) => reserveBank(number, length, true, 'fast'),
    reserveChipData: (number, length) => reserveBank(number, length, true, 'chip'),
    sprites, setSprite, spriteInfo, spriteOff, updateSprites, spritePriority, setSpriteBuffer,
    spriteBufferSnapshot: () => spriteBuffer.snapshot(),
    spriteUpdateOn: () => { automaticSprites = true; },
    spriteUpdateOff: () => { automaticSprites = false; },
    hide: () => setPointerCount(pointerCount - 1),
    show: () => setPointerCount(pointerCount + 1),
    hideOn: () => setPointerCount(-1),
    showOn: () => setPointerCount(0),
    mouseVisible: () => pointerVisible,
    changeMouse, mouseShape: () => pointerShape,
    bobs, setBob, configureBob, bobInfo, bobOff, updateBobs, flushBobs, doubleBuffer,
    bobCollision, collisionInfo,
    limitBob: (number, x1, y1, x2, y2) => setBobLimit(number, x1, y1, x2, y2),
    limitBobs: (x1, y1, x2, y2) => setBobLimit(null, x1, y1, x2, y2),
    resetBobLimits: () => setBobLimit(null, null, null, null, null),
    bobUpdateOn: () => { automaticBobs = true; },
    bobUpdateOff: () => { automaticBobs = false; },
    bobClear: () => clearBobs(display.screen()),
    bobDraw: () => { const target = display.screen(); clearBobs(target); drawBobs(target); },
    hotSpot, hotSpotPreset,
    priorityOn: () => { priorityScreen = display.screen(); imageBobsChanged(); },
    priorityOff: () => { priorityScreen = null; imageBobsChanged(); },
    priorityReverseOn: () => { reversePriority = true; imageBobsChanged(); },
    priorityReverseOff: () => { reversePriority = false; imageBobsChanged(); },
    pasteBob: (x, y, number) => pasteImage(1, x, y, number),
    pasteIcon: (x, y, number) => pasteImage(2, x, y, number),
    spritePalette: (mask = -1) => display.bankPalette(imageBank(1).palette, mask),
    resetDefault,
    getIcon: (...args) => captureImage(2, 'Get Icon', ...args),
    getBob: (...args) => captureImage(1, 'Get Bob', ...args),
    iconPalette: (mask = -1) => display.bankPalette(imageBank(2).palette, mask),
    imageFlags,
    makeMask: (number = null) => setImageMask(1, true, number),
    noMask: (number = null) => setImageMask(1, false, number),
    makeIconMask: (number = null) => setImageMask(2, true, number),
    noIconMask: (number = null) => setImageMask(2, false, number),
    clearKeys: () => { state.input.keys.length = 0; },
    putKeys: text => {
      if (text.includes('\x01')) throw new Error('Encoded Put Key packets are not implemented');
      state.input.keys.push(...text);
    },
    integer, integerOperation, divide, addStrings, subtractStrings, dim, arrayGet, arraySet, arrayIndex, arrayTargetIndex, readData,
    addInteger(current, delta, low = null, high = null) {
      const result = (current + delta) | 0;
      return low == null ? result : result < low ? high : result > high ? low : result;
    },
    stringBranchTarget(name, labels) {
      if (typeof name !== 'string' || !name.length || name.length >= 32 || /[^\x00-\x7f]/.test(name)) throw new Error('Unsupported string label name');
      const key = name.replace(/[A-Z]/g, c => String.fromCharCode(c.charCodeAt(0) + 32));
      if (!Object.prototype.hasOwnProperty.call(labels, key)) throw new Error(`Undefined string label ${name}`);
      return labels[key];
    },
    value, numberFunction, float, floatAdd, floatMultiply, floatDivide, floatSqrt, naturalLog, floatExp, floatPower, floatTrig, val, numericUnary, numericBinary,
    degree: () => { degrees = true; },
    radian: () => { degrees = false; },
    bankStart: number => bankMemory.start(integer(number)),
    peek: address => bankMemory.peek(integer(address)),
    poke: (address, byte) => bankMemory.poke(integer(address), integer(byte)),
    fillMemory(start, end, pattern) {
      start = integer(start); end = integer(end) >>> 0; pattern = integer(pattern);
      bankMemory.fill(bankMemory.address(start), end, pattern);
    },
    copyMemory: (start, end, destination) => bankMemory.copy(integer(start), integer(end) >>> 0, integer(destination)),
    deek: address => bankMemory.deek(integer(address)),
    leek: address => bankMemory.leek(integer(address)),
    doke: (address, value) => bankMemory.doke(integer(address), integer(value)),
    loke: (address, value) => bankMemory.loke(integer(address), integer(value)),
    keySpeed(delay, interval) {
      delay = integer(delay); interval = integer(interval);
      if (delay < 0 || interval < 0) throw new Error('Invalid Key Speed');
      if (delay > 32767 || interval > 32767 || interval === 0) throw new Error('Unsupported Key Speed range (period must be 1..32767)');
      state.input.keySpeed = Object.freeze({ delay, interval, delayMs: delay * 20, intervalMs: interval * 20 });
      if (options.resetInput) options.resetInput('key-speed');
    },
    setJoystick, joystickInfo,
    keyState(code) {
      code = integer(code);
      if (code < 0 || code > 127) throw new Error('Key State code must be in 0..127');
      return state.input.rawKeys[code] ? -1 : 0;
    },
    setJoystickReader(reader) {
      if (reader != null && typeof reader !== 'function') throw new Error('Joystick reader must be a function');
      const binding = { reader }; joystickBinding = binding;
      return () => { if (joystickBinding === binding) joystickBinding = null; };
    },
    amreg: index => amalRegisters[amregIndex(index)],
    setAmreg: (index, value) => { amalRegisters[amregIndex(index)] = integer(value); },
    audio, loadIff, unpackScreen, saveIff, frameLoad, framePlay, trackLoad,
    trackLoopOn: () => { state.tracker.loop = true; },
    trackLoopOff: () => { state.tracker.loop = false; },
    samBank: number => audio.selectBank(integer(number)),
    samLoopOn: (mask = 15) => audio.loop(true, integer(mask)),
    samLoopOff: (mask = 15) => audio.loop(false, integer(mask)),
    boom: () => { sampleDuringMusic(); audio.boom(); },
    samPlay: number => { sampleDuringMusic(); audio.play(15, integer(number)); },
    samPlayVoices: (mask, number, frequency = null) => { sampleDuringMusic(); audio.play(integer(mask), integer(number), frequency == null ? null : integer(frequency)); },
    samStop: (mask = 15) => { sampleDuringMusic(); audio.stop(integer(mask)); },
    ledOn: () => audio.filter(true),
    ledOff: () => audio.filter(false),
    amosLock: () => systemCommand('Amos Lock'),
    breakOff: () => systemCommand('Break Off'),
    closeEditor: () => systemCommand('Close Editor'),
    atString, stringFunction, replaceSubstring, formatUsing, fileOpen, fileClose, closePorts, filePrint, fileRead, fileInfo,
    min: (left, right, aType, bType) => minimumMaximum(left, right, aType, bType, false),
    max: (left, right, aType, bType) => minimumMaximum(left, right, aType, bType, true)
  };
}

if (typeof module === 'object' && module.exports) module.exports = createOperations;
else globalThis.AMOS_OPERATIONS = createOperations;
