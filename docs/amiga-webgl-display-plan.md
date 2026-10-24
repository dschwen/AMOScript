# Amiga Display Emulation for an AMOS → JavaScript Transpiler

**Implementation plan: data model, JS reference renderer, WebGL2 renderer, copper, AMOS integration**

**Repository integration:** adopted as the target display workstream in
[PLAN.md](../PLAN.md). Read [the integrated architecture](display-architecture.md)
for the mapping to current modules, storage migration, snapshot ABI, host lifecycle
and delivery gates. This document describes proposed functionality; unchecked
milestones are not implemented capabilities. Type notation below specifies data
shapes, not a prerequisite TypeScript/Vitest migration.

---

## 1. Goals and non-goals

### Goals

- Reproduce Amiga display output in the browser for transpiled AMOS programs. This covers planar bitplanes with 1–6 planes on OCS/ECS (8 on AGA), lowres/hires/superhires, interlace, EHB, HAM6/HAM8, dual playfield, hardware sprites, per-line copper effects, and mid-line copper effects.
- Be pixel-exact against a pure-JS reference renderer, and visually exact against a real emulator (WinUAE / FS-UAE) for captured test cases.
- Keep per-frame cost low enough that the main thread is free for the transpiled game logic. The target is under 2 ms of CPU-side display work per frame for typical lowres/hires games.
- Express everything as a single **data model** of chip RAM plus a per-frame display state, consumed by two interchangeable renderers:
  - **Reference renderer** (plain JS, CPU): the specification, the test oracle and the fallback.
  - **GPU renderer** (WebGL2 fragment shaders): the production path.

### Non-goals (for now)

- Cycle-exact DMA contention, blitter timing, or copper timing beyond what affects visible pixels.
- Emulating the 68000. Game logic is transpiled.
- Pixel-exact border/overscan edge cases that no AMOS game relies on. These are documented as known deviations.

---

## 2. Architecture overview

```
 ┌──────────────────────────── per frame ────────────────────────────┐
 │                                                                   │
 │  Transpiled AMOS game logic                                       │
 │        │  (Screen Open, Plot, Bob, Sprite, Rainbow, Cop Move ...)  │
 │        ▼                                                          │
 │  AMOS runtime ──► Blitter/drawing (JS) ──► chipRam: Uint8Array     │
 │        │                                     (dirty-range tracked)│
 │        ▼                                                          │
 │  Copper list builder (synthesises the list as AMOS would)          │
 │        ▼                                                          │
 │  Copper interpreter (JS) ──► FrameState                           │
 │        │   lineRegs[]   (per-scanline register snapshot)          │
 │        │   linePal[]    (per-scanline palette)                    │
 │        │   lineSprites[](per-scanline sprite data)                │
 │        │   lineEvents[] (mid-line register changes)               │
 │        ▼                                                          │
 │  ┌───────────────────────┐        ┌────────────────────────────┐  │
 │  │ Reference renderer    │   OR   │ WebGL2 renderer            │  │
 │  │ render(chip, frame)   │        │ upload → decode → resolve  │  │
 │  │  → RGBA bytes        │        │  → FBO → scale → canvas     │  │
 │  └───────────────────────┘        └────────────────────────────┘  │
 └───────────────────────────────────────────────────────────────────┘
```

Key design decisions:

1. **Chip RAM is the target source of pixel data.** Bitplanes, sprite data and bob graphics live in a `Uint8Array`: big-endian words, MSB = leftmost pixel. The current indexed buffers first feed a one-way planar bridge; planar storage becomes authoritative only after CPU parity and drawing/Bob migration. There are never two independent writable authorities.
2. **The copper is evaluated on the CPU, once per frame.** It is cheap because copper lists are short. Its output is a per-scanline snapshot of display registers. Neither renderer ever interprets copper instructions.
3. **Bitplane pointer advance (fetch width + modulo) is resolved by the copper interpreter.** Each line's table stores the pointers *at the start of that line*. Renderers never see modulos. Copper pointer rewrites, negative-modulo line repeats and split screens therefore come for free.
4. **Both renderers consume the identical `FrameState`.** This is what makes the reference renderer a usable oracle.

---

## 3. Data model specification

### 3.1 Chip RAM

```ts
interface ChipMemory {
  bytes: Uint8Array;          // 512 KB, 1 MB or 2 MB
  dirty: DirtyTracker;        // set of [startRow, endRow) in 2048-byte rows
}
```

- Layout: Amiga byte order, unchanged. Word `n` occupies `bytes[2n]` (high byte) and `bytes[2n+1]`.
- The GPU texture is `R8UI` with **2048 bytes per row**: 512 KB → 2048×256, 2 MB → 2048×1024. Address `a` maps to `(a & 2047, a >> 11)`.
- `DirtyTracker` records revisioned row ranges touched by drawing ops. Each renderer tracks its own uploaded revision; consuming one upload must not clear another consumer's dirtiness. A new/restored context or expired history requires a full upload (0.5–2 MB per frame).

### 3.2 Coordinate conventions

- **Native output buffer**: an integer grid in the finest supported resolution unit. A standard window uses 640 samples for OCS and 1280 for ECS-superhires/AGA profiles. A 640-wide buffer cannot preserve ECS superhires pixels. Cropping/overscan width is explicit, not inferred from a selected AMOS bitmap.
- Each line's **samples per playfield pixel** comes from BPLCON0 and the profile: lowres/hires = 2/1 on the OCS grid, and lowres/hires/superhires = 4/2/1 on the finer grid. This permits mixed resolution without fractional output samples.
- Frame metadata separates **field lines** (normally PAL 256, NTSC 200) from **woven output height** (normally PAL 512, NTSC 400 when interlaced). Do not double an already woven height.
- Table window bounds, sprite starts and events use **native output sample units**. Signed positions preserve left-edge clipping. Hardware-to-output conversion is done on the CPU; fetch offsets and scroll delays are separately interpreted in source-pixel units.

### 3.3 Per-line register table (`lineRegs`)

`Uint32Array`, `LINES × 32` entries. GPU texture `R32UI`, 32 wide × LINES high.

| Col  | Meaning                                                                 |
|------|--------------------------------------------------------------------------|
| 0–7  | BPL1PT … BPL8PT: byte address of the first fetched word on this line     |
| 8    | BPLCON0 (plane count, HIRES, SHRES, HAM, DPF, LACE)                     |
| 9    | BPLCON1 (PF1H/PF2H scroll delays; AGA fine scroll bits)                  |
| 10   | BPLCON2 (playfield/sprite priorities, PF2PRI)                            |
| 11   | BPLCON3 (AGA: palette bank, PF2OF, LOCT, border blank)                   |
| 12   | BPLCON4 (AGA: BPLAM xor, sprite colour banks)                            |
| 13   | Display window start x (signed native output samples)                    |
| 14   | Display window stop x (signed native output samples)                     |
| 15   | Signed source-pixel fetch offset (prefix/late fetch, see §3.7)            |
| 16   | Flags: bit0 = line inside vertical DIW, bit1 = bitplane DMA on, bit2 = sprite DMA on |
| 17   | Number of mid-line events on this line (see §3.6)                        |
| 18–31| Reserved                                                                 |

### 3.4 Per-line palette (`linePal`)

`Uint8Array`, `LINES × 256 × 4` (RGBA). GPU texture `RGBA8`, 256 × LINES. OCS/ECS uses only the first 32 entries.

- OCS 12-bit colours are stored expanded **exactly** (`c4 * 17`) so that EHB halving and HAM modifies can be reproduced bit-exactly by converting back with `round(v / 17)`.
- The palette reflects the state **at the start of the visible part of the line**. Changes later in the line go to events.

### 3.5 Per-line sprite table (`lineSprites`)

`Uint32Array`, `LINES × 8 × 4`. GPU texture `RGBA32UI`, 8 × LINES. One texel per sprite:

| Component | Meaning                                                         |
|-----------|------------------------------------------------------------------|
| r         | hstart (signed native output samples, stored as 32-bit bits)    |
| g         | DATA word (plane A); for AGA 32/64-bit sprites, see Phase 10      |
| b         | DATB word (plane B)                                              |
| a         | flags: bit31 = active, bit0 = attached to previous (odd sprite), bits 1–2 = width mode (AGA) |

The CPU computes this from sprite DMA state (VSTART/VSTOP, data pointers, reuse). For AMOS this can instead come directly from the sprite manager.
Use the active bit rather than an x sentinel: `0xFFFFFFFF` also represents a valid
signed x=-1. Logical/computed AMOS IDs are allocated to physical per-line channels
by the manager; neither renderer performs that allocation.

### 3.6 Mid-line events (`lineEvents`)

`Uint32Array`, `LINES × MAX_EVENTS × 4`. GPU texture `RGBA32UI`, MAX_EVENTS × LINES. `MAX_EVENTS` defaults to 32 and is configurable.

Entries are stably sorted by native output x: `(x, register, value, 0)`. Supported registers:

- `COLORxx`: palette change from hpos onward.
- `BPLCON1`: mid-line scroll changes (rare).
- `BPLCON0`/`BPLCON2`: optional, low priority.

Overflow policy: retain the full ordered CPU event stream. Use exact variable
segments (including decode-register state when needed), or select CPU reference
rendering for that frame. A fixed 40-segment palette is an optimization only for
scenes whose event boundaries it represents exactly; no writes may be dropped or
quantized. Bound total interpreter work/storage and diagnose exhaustion. Tests
must distinguish GPU execution from a CPU fallback, even when their pixels match.

### 3.7 Horizontal scroll and fetch alignment

Hardware scroll nibbles delay the plane data by 0–15 lowres units (more on AGA).
Convert those units to source pixels (×2 in hires). Scrolling fetches one extra
word in lowres or two in hires. The model is:

```
playfieldX(outputX, line)  = floor((outputX - diwStart) / samplesPerPlayfieldPixel)
bitX(plane)                = playfieldX + fetchOffset - delay(plane)
   delay(odd plane)  = PF1H * sourcePixelsPerLowresPixel
   delay(even plane) = PF2H * sourcePixelsPerLowresPixel
bit = (chip[ptr + (bitX >> 3)] >> (7 - (bitX & 7))) & 1     // bitX < 0 → 0
```

`fetchOffset` uses signed source-pixel bits: normally 16 for the lowres prefix or
32 for hires, and zero without an early fetch. The current x=128 profile derives
it relative to DDFSTRT $38/$3C; arbitrary DIW/DDF phases and AMOS Screen Offset
remain open. See [the implemented mode contract](display-modes.md).

### 3.8 FrameState

```ts
interface FrameState {
  schemaVersion: number;
  revision: number;
  chipset: 'OCS' | 'ECS' | 'AGA';
  samplesPerLowresPixel: 2 | 4;
  outputWidth: number;        // native output samples
  outputHeight: number;       // full presentation height, including both fields
  lines: number;              // visible lines this field
  interlaceField: 0 | 1 | null;
  maxEvents: number;
  videoRate: { numerator: number; denominator: number };
  pixelAspect: { numerator: number; denominator: number };
  origin: { x: number; y: number };
  lineRegs: Uint32Array;
  linePal: Uint8Array;
  lineSprites: Uint32Array;
  lineEvents: Uint32Array;
  eventOffsets: Uint32Array;   // ABI v1: lines+1 offsets into full overflow records
  overflowEvents: Uint32Array; // ABI v1: complete ordered streams for overflow lines
}
```

`FrameState` plus immutable chip bytes is **serialisable** (versioned JSON header
+ binary blobs, with explicit byte order, strides, lengths and bounds). Woven
fixtures also supply explicit previous-field state. The repository ABI is frozen
in P0 following [the integration contract](display-architecture.md#snapshot-and-coordinate-contract).
ABI v1 is now implemented; [the snapshot contract](display-snapshots.md) specifies
required sampling/rate/aspect/origin metadata, overflow streams and exact wire
layout. Structural validation does not implement renderer mode semantics.

---

## 4. The reference renderer (detailed)

### 4.1 Purpose

The reference renderer is a deliberate, readable, non-optimised JS implementation of the display logic. It serves four roles:

1. **Executable specification.** When there is a question about what the hardware does, the answer is encoded here first, with comments citing the Hardware Reference Manual section.
2. **Test oracle.** The GPU renderer must match it bit-for-bit on every test frame.
3. **Fallback.** It runs on devices without WebGL2, or when the context is lost, optionally in a worker with OffscreenCanvas. Cost depends on the native sampling grid, field composition and mode; the M12 frame-rate target must be measured.
4. **Debugging instrument.** It supports per-pixel introspection ("why is this pixel this colour?") that is impractical in a shader.

### 4.2 Design rules

- **Pure function:** `render(chip: Uint8Array, frame: FrameState, opts) → Uint8ClampedArray` (top-left-origin RGBA bytes for the current field). No hidden state or reads of runtime objects. Packed Uint32 values are internal only; output/fixture bytes must not depend on host endianness. A separate composer takes explicit previous output and field parity for weaving.
- **Same structure as the shader.** Mirror the GPU pass structure (decode → resolve → sprites/priority) as separate functions, so that a divergence can be bisected to a stage.
- **Integer-only math.** Colours stay as 4-bit (OCS) or 8-bit (AGA) channel integers until final packing, matching the shader's integer pipeline.
- **No optimisation tricks in the core path.** Keep a straightforward per-pixel loop. A separate "fast CPU" variant (chunky-to-planar style, word-at-a-time) can exist later for the fallback role, but it must itself be tested against the reference.

### 4.3 Module layout

```
lib/display/
  model/
    ChipMemory.js        chip bytes, allocation, revisioned dirty ranges
    frameState.js        versioned FrameState validation/(de)serialisation
    registers.js         register numbers and bit-field helpers
  copper/
    interpreter.js       copper list → FrameState
    builder.js           AMOS screen/rainbow state → copper list
  reference/
    render.js            pure current-field render()
    decode.js            planar → raw index (+ dual playfield split)
    resolve.js           index → colour (palette, EHB, HAM, events)
    sprites.js           sprite pixel + priority
    explainPixel.js      structured pixel trace
  presentation/
    composeField.js      explicit weave/line-double operation
  webgl/
    context.js           WebGL2 setup, texture allocation, uploads
    shaders/*.glsl       decode, resolve, scale
    render.js            same current-field semantics as reference
test/
  fixtures/display/      *.frame.json + binary blobs + *.png (golden)
  helpers/displayFrames.js   load/run/diff/report
```

These are planned modules. `lib/amos/display.js` remains the AMOS facade and
`lib/amos/browser.js` the host boundary; the existing runner and Playwright remain.

### 4.4 Core algorithm (reference)

```ts
for (let line = 0; line < frame.lines; line++) {
    const regs = rowView(frame.lineRegs, line);
  for (let ox = 0; ox < frame.outputWidth; ox++) {
    const active = insideDisplay(regs, ox);
    const px  = playfieldX(regs, ox);
    const raw = active ? decodeIndex(chip, regsAt(frame, line, ox), px) : 0;
    const pf  = splitPlayfields(regs, raw);
    let rgb   = active ? resolveColour(frame, line, ox, pf, hamState)
                       : colour0(frame, line, ox);
    rgb       = applySprites(frame, line, ox, pf, rgb);
    storeRGBA(out, line*frame.outputWidth + ox, rgb);
  }
}
```

- **HAM in the reference** uses a running left-to-right state per line. This is the natural hardware model. It differs on purpose from the GPU backward scan, so the two implementations cross-check each other.
- **Palette lookup with events:** `paletteAt(frame, line, ox, index)` applies events with native output `x <= ox` in order. The HAM running state picks up palette changes at the exact pixel where a palette-set occurs.
- **Decode events and border:** scroll/mode changes affect decode, not only palette resolution. Evaluate sprites outside the bitplane window wherever the video profile permits; do not skip them through a border early return. HAM advances in source-pixel order, independently of duplicated lowres output samples.

### 4.5 `explainPixel` debugging tool

`explainPixel(chip, frame, x, y)` returns a structured trace:

```json
{
  "line": 120, "outputX": 211, "playfieldX": 98, "resolution": "lowres",
  "planes": [
    {"plane": 1, "ptr": "0x01a3c0", "byteAddr": "0x01a3cc", "byte": "0x5a", "bit": 1},
    ...
  ],
  "rawIndex": 37, "mode": "EHB", "baseIndex": 5,
  "palette": {"source": "line", "value": "0x0f84"}, "halved": "0x07 0x04 0x02",
  "sprite": null, "final": "#774422"
}
```

Expose it in a dev overlay. Clicking a pixel in the running game shows the trace from both renderers side by side.

### 4.6 Validation of the reference itself

The reference is only an oracle if it is correct. Validate it against reality:

- **IFF ILBM loader** (Phase 1): load standard IFF pictures, including HAM6, HAM8, EHB, hires/interlaced and AGA 256-colour, into chip RAM and a FrameState. These are excellent, abundant test content.
- **Emulator captures:** for a set of small test programs (AMOS or assembly) run in WinUAE/FS-UAE, capture screenshots plus chip RAM and copper list dumps. Feed the dumps through copper interpreter → reference renderer and compare with the screenshots.
  - Expect occasional legitimate differences (overscan edges, emulator filtering). Document allowed regions per fixture.
- **Hand-built synthetic fixtures** for edge cases: one-plane alternating bits, scroll delay sweeps 0–15, odd/even plane delay mismatch, negative modulo, DPF priority swap, HAM with long modify runs, palette event at every 8th pixel.

---

## 5. GPU renderer design (WebGL2)

### 5.1 Requirements

- WebGL2 is required for integer textures, `texelFetch` and bitwise ops. If it is unavailable, fall back to the reference/fast CPU renderer.
- All integer textures use **`NEAREST`** min/mag filtering. With LINEAR they are incomplete and silently sample as 0.
- `gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)` for `R8UI` uploads.
- All address math is in `uint`. Never use float coordinates for memory addressing.

### 5.2 Textures

| Texture       | Format    | Size                    | Update                       |
|---------------|-----------|-------------------------|------------------------------|
| chip          | R8UI      | 2048 × (chipSize/2048)  | dirty rows via texSubImage2D |
| lineRegs      | R32UI     | 32 × LINES              | every frame                  |
| linePal       | RGBA8     | 256 × LINES             | every frame (or dirty lines) |
| lineSprites   | RGBA32UI  | 8 × LINES               | every frame                  |
| lineEvents    | RGBA32UI  | MAX_EVENTS × LINES      | every frame if any events    |
| indexBuf      | R16UI     | OUT_W × LINES (FBO)     | written by pass 1            |
| colourBuf     | RGBA8     | OUT_W × LINES (FBO)     | written by pass 2            |

`indexBuf` stores the raw plane index (8 bits) plus flag bits: the playfield split info, and an "outside window" bit.

### 5.3 Passes

1. **Decode pass**: chip + lineRegs → `indexBuf`. A per-pixel bitplane gather with scroll delays and fetch offset.
2. **Resolve pass**: `indexBuf` + palette + events + sprites → `colourBuf`.
   - Normal and EHB modes: direct lookup, with the EHB half-bright computed on 4-bit channels.
   - Dual playfield: split odd/even planes and apply PF2PRI and BPLCON2 priorities.
   - HAM: **backward scan** in `indexBuf` until R, G and B are resolved or a palette-set is hit. The line starts from COLOR00.
   - Events: `paletteAt(index, x, line)` scans the line's events for a matching COLOR register with `hpos <= x`.
   - Sprites: loop over 8 sprites, compute the sprite pixel, apply priority against the playfields.
3. **Scale pass**: `colourBuf` → canvas. Integer nearest-neighbour scaling, aspect correction (PAL ≈ 1.0/1.1 pixel aspect, configurable), and an optional CRT shader.

Passes 1 and 2 can be merged for non-HAM frames as an optimisation, but only after parity is established.

### 5.4 Reference shader core (decode + palette, from the design discussion)

The snippet illustrates the passes; it is not a complete implementation of the
snapshot ABI, bounds, coordinate transforms, mode gates or mid-line decode events.

```glsl
#version 300 es
precision highp float; precision highp int; precision highp usampler2D;

uniform usampler2D uChip;   // R8UI, 2048 bytes per row
uniform usampler2D uLine;   // R32UI, see §3.3
uniform sampler2D  uPal;    // RGBA8, see §3.4
out vec4 outColor;

uint chip(uint a)       { return texelFetch(uChip, ivec2(a & 2047u, a >> 11), 0).r; }
uint reg(int r, int y)  { return texelFetch(uLine, ivec2(r, y), 0).r; }
vec3 pal(uint i, int y) { return texelFetch(uPal, ivec2(int(i), y), 0).rgb; }

uint planeBit(uint ptr, int x) {
  if (x < 0) return 0u;
  uint b = chip(ptr + uint(x >> 3));
  return (b >> (7u - uint(x & 7))) & 1u;   // MSB = leftmost pixel
}

void main() {
  int x = int(gl_FragCoord.x);
  int y = int(gl_FragCoord.y);
  uint con0 = reg(8, y), con1 = reg(9, y), con2 = reg(10, y);
  int  nPlanes = int((con0 >> 12) & 7u);
  bool dpf = (con0 & 0x0400u) != 0u;
  int  d1 = int(con1 & 15u), d2 = int((con1 >> 4) & 15u); // PF1H odd, PF2H even
  int  fetchOff = int(reg(15, y));
  int  px = x /* convert via DIW + scale, see §3.7 */;

  uint idx = 0u;
  for (int p = 0; p < 6; p++) {
    if (p >= nPlanes) break;
    int sx = px + fetchOff - ((p & 1) == 0 ? d1 : d2);
    idx |= planeBit(reg(p, y), sx) << uint(p);
  }

  vec3 c;
  if (dpf) {
    uint pf1 = (idx & 1u) | ((idx >> 1) & 2u) | ((idx >> 2) & 4u);         // planes 1,3,5
    uint pf2 = ((idx >> 1) & 1u) | ((idx >> 2) & 2u) | ((idx >> 3) & 4u);  // planes 2,4,6
    bool pf2pri = (con2 & 0x40u) != 0u;
    uint front = pf2pri ? (pf2 != 0u ? pf2 + 8u : pf1)
                        : (pf1 != 0u ? pf1 : (pf2 != 0u ? pf2 + 8u : 0u));
    c = pal(front, y);
  } else if (nPlanes == 6 && idx >= 32u) {         // EHB (HAM handled in its own path)
    vec3 base = floor(pal(idx - 32u, y) * 15.0 + 0.5);
    c = floor(base * 0.5) / 15.0;
  } else {
    c = pal(idx, y);
  }
  outColor = vec4(c, 1.0);
}
```

### 5.5 HAM resolve (GPU)

```glsl
vec3 hamColor(int x, int y) {
  vec3 c = vec3(0.0); bvec3 got = bvec3(false);
  for (int i = x; i >= 0; --i) {
    uint v = texelFetch(uIdx, ivec2(i, y), 0).r;
    uint ctl = (v >> 4) & 3u; float d = float(v & 15u) / 15.0;
    if (ctl == 0u) return mix(paletteAt(v & 15u, i, y), c, vec3(got)); // set resolves all
    if (ctl == 1u && !got.b) { c.b = d; got.b = true; }   // 01 modify blue
    if (ctl == 2u && !got.r) { c.r = d; got.r = true; }   // 10 modify red
    if (ctl == 3u && !got.g) { c.g = d; got.g = true; }   // 11 modify green
    if (all(got)) return c;
  }
  return mix(paletteAt(0u, 0, y), c, vec3(got));          // line starts from COLOR00
}
```

Note that `paletteAt` is evaluated at the **x of the palette-set pixel** (`i`), not at `x`, so mid-line palette events behave correctly in HAM.

HAM with 5 planes: plane 6 reads as 0, so the control value is only ever 00 or 01. This falls out naturally.

Optional optimisation, only if profiling demands it: log-step pointer jumping that computes "last set position" per channel in about log2(width) passes.

### 5.6 Interlace

- Laced screens: each emulated field renders its rows. The runtime field clock, not browser requestAnimationFrame, advances `interlaceField`.
- Weave produces 512/400 output lines for standard PAL/NTSC profiles. A separate composer receives previous output and the new field explicitly. Persistent FBOs cache that result; CPU-owned history remains sufficient for fallback and context restoration.
- Optional deinterlace modes: weave (default) or line-double.

---

## 6. Copper interpreter and builder

### 6.1 Interpreter

Input: chip RAM and the copper list start address (COP1LC). Output: `FrameState`.

- Instructions: `MOVE reg,value`, `WAIT vp,hp (with masks)`, `SKIP`. Also handle `COPJMP1/2` and `COP2LC` writes.
- Beam model: a current `(vpos, hpos)`. MOVE/SKIP use four colour clocks; WAIT reads in four then uses two wake-up clocks after its masked comparison succeeds. V7 cannot be masked; BFD controls blitter completion independently. The bounded implementation and capture limits are documented in [the copper contract](copper-display.md).
- For each register write:
  - If `hpos` is before the start of the visible playfield on that line → update the **line-start state** (applies to the whole line).
  - Otherwise, for `COLORxx`/`BPLCON1`/etc. → append a **line event** with hpos converted to output space.
  - For `BPLxPT` writes after fetch → update the next fetch's pointer without changing the current line's latched base. Writes during active fetch need word-level arbitration and currently reject.
- Latch bases at DDF start, capture palette/register state at the crop's left edge, and advance pointers at fetch completion: `ptr += fetchBytes + (odd ? BPL1MOD : BPL2MOD)`, using signed 16-bit modulos. Process lines outside the crop too.
- `fetchBytes` is derived from DDFSTRT/DDFSTOP and the resolution:
  - lowres: `((DDFSTOP - DDFSTRT) / 8 + 1) * 2`
  - hires:  `((DDFSTOP - DDFSTRT) / 4 + 2) * 2`
  - AGA fetch modes (FMODE) widen this. Handle in Phase 10.
- Unsupported/protected register effects reject with PC/beam context rather than silently disappearing from scanout.
- End of list or `WAIT $FFFF,$FFFE` → hold the state to the end of the frame.

### 6.2 Builder (AMOS side)

Rather than giving AMOS screens a separate code path, the **AMOS runtime synthesises a copper list** as AMOS itself does:

- For each visible screen (sorted by display y): a WAIT at its top line, MOVEs for BPLCON0/1/2, DIW/DDF, the bitplane pointers (offset applied) and the palette.
- Rainbows: per-line `COLORxx` MOVEs.
- `Copper Off` + `Cop Move` / `Cop Wait` / `Cop Swap`: the user list replaces the generated one, or is appended to it.

This keeps a single path through the interpreter and makes AMOS copper semantics match real hardware.

---

## 7. Implementation phases and milestones

Each milestone has **acceptance tests** that must pass in CI before moving on. "Parity" means pixel-exact equality (tolerance 0) between the reference and GPU output.

### Phase 0: Foundations and test harness

**Work**
- Repo structure as in §4.3, using JavaScript and the current `test/run.js` runner. Retain Playwright for browser/GPU tests; no compiler/toolchain rewrite is required.
- Baseline restored locally: refreshed demos and 332 passing tests including ABI, planar/ILBM and copper/screen-stack checks. Chromium covers sprite/cursor, native planar/copper pixels and integer WebGL2 readback. Hosted execution remains pending.
- FrameState + chip snapshot serialisation format (`.frame.json` + `.chip.bin`).
- Golden-image harness: render → PNG → compare with golden, produce a diff image (mismatches in magenta), and report the first N mismatching pixels.
- Test-pattern generator utilities (fill planes with patterns, build simple FrameStates by hand).

**Milestone M0**
- [x] `test/helpers/displayFrames.js` can load a fixture, call a renderer stub, and produce a pass/fail report plus a diff PNG (local suite; hosted execution pending).
- [ ] Playwright runs headless Chromium with WebGL2 (SwiftShader) in CI and can read back a framebuffer.

The WebGL2 probe is implemented in `test/helpers/webglProbe.js` and invoked by
`npm run test:browser`, including in the configured CI job. Local Chromium passes
integer texture sampling, high-address/row-boundary reads and exact framebuffer
readback. The checkbox remains open until hosted execution is observed.

### Phase 1: Chip RAM model and basic reference renderer

**Work**
- `ChipMemory` with dirty tracking.
- Reference renderer: 1–5 planes, lowres, static palette, no scroll, a single screen covering the display window, and border colour outside it.
- IFF ILBM loader (BMHD, CMAP, BODY with ByteRun1 decompression, CAMG for the mode).

**Milestone M1**
- [x] Synthetic fixtures: each plane alone produces the expected stripe patterns. Bit order and byte order are verified (local suite).
- [x] 2/4/8/16/32-colour IFF pictures render identically to independently encoded PNGs, raw and ByteRun1 (local suite).
- [x] `explainPixel` works for normal mode (local suite).

See [the implemented P1 contract](planar-display.md). These checks are synthetic,
not external AMOS captures; hosted CI is still unobserved. The physical bridge is
playfield-only, with indexed drawing authoritative until the later migration.

### Phase 2: Copper interpreter and per-line state

**Work**
- Copper interpreter (§6.1) for per-line effects. Mid-line writes are recorded but not yet rendered.
- Pointer advance with modulos (including negative).
- Reference renderer reads everything from `lineRegs`/`linePal`.

**Milestone M2**
- [x] Rainbow fixture: a COLOR00 change on every line produces correct bands (local synthetic/source-derived fixture).
- [x] Split-screen fixture: two screens with different plane counts and palettes at a line boundary (local builder/interpreter fixture).
- [x] Negative modulo fixture: repeating a single line N times produces the expected stretch (local fixture).
- [x] Pointer rewrite mid-frame after fetch (copper MOVE to BPL1PT) shows the new data from the following line (local fixture; active-fetch writes remain unsupported).
- [ ] At least 3 emulator-captured copper scenes match (within documented allowed regions).

### Phase 3: Reference renderer, full OCS/ECS feature set

**Work**
- Hires, superhires (ECS), and mixed resolutions per line.
- Scroll delays (PF1H/PF2H) and fetch offset.
- EHB.
- Dual playfield with PF2PRI, including 2/4/6-plane variants.
- Display window, and the border/COLOR00 handling.
- Interlace (field selection, weave).

**Milestone M3**
- [ ] Scroll sweep fixture: delays 0–15 on odd/even planes independently, compared with emulator captures.
- [x] EHB IFF pictures match independent raw/ByteRun1 PNGs (local synthetic fixtures).
- [x] DPF fixtures: both priority settings and transparency through to COLOR00 (local 2/4/6-plane fixtures).
- [x] Mixed-resolution stack: lowres screen above a hires screen on one frame (local synthetic builder/interpreter fixture; captures remain separate).
- [x] Interlaced IFF pictures match after two fields, including odd heights and either arrival order (local independent normal/hires/EHB fixtures; live field timing remains open).

### Phase 4: Reference HAM

**Work**
- HAM6 with a running left-to-right state per line, and COLOR00 as the initial state.

**Milestone M4**
- [x] Ten six-plane HAM6 IFF images match independently generated PNG references, in raw and ByteRun1 forms. These are synthetic fixtures, not external execution captures; see [HAM contract](ham-display.md).
- [x] Synthetic: long modify-only runs, a line starting with a modify, and a 5-plane HAM edge case. Laced HAM and standalone Canvas/planar/copper pixels also pass locally. Mid-line events remain P9.

### Phase 5: Reference sprites

**Work**
- 8 sprites, 2-bit colour, attached pairs (16-colour), sprite colour mapping (sprite pairs → colours 17–19, 21–23, 25–27, 29–31; attached → 17–31).
- Priority vs playfields via BPLCON2 (PF1P/PF2P), including DPF interactions.
- Sprite DMA emulation (VSTART/VSTOP/reuse) in the copper/frame builder, and a direct AMOS sprite-manager path.

**Milestone M5**
- [x] Local synthetic sprite fixtures: all five documented priority settings for each playfield, both PF2PRI settings, transparency combinations and all channel pairs. External captures remain separate.
- [x] Raw physical attached-pair fixtures render indices 1–15 plus transparent zero; bounded 16-pixel four-plane AMOS direct allocation now publishes the same paired rows; wide/computed allocation remains open.
- [x] Synthetic signed starts and right-edge clipping, independent of playfield resolution, including native sample grids of two/four. Hardware border/DMA captures remain open.

CPU reference and direct AMOS snapshot publication are implemented; see
[sprite contract](sprite-display.md). Bounded DMA VSTART/VSTOP/reuse and manual
register output are implemented. Canvas now shares structured rows and the
resolver, retiring its opaque RGBA callback. Bus contention/latch timing and
computed allocation remain open.

### Phase 6: WebGL2 infrastructure

**Work**
- Context creation, capability check, loss/restore handling.
- Texture allocation for §5.2, dirty-row chip uploads, per-frame table uploads.
- Scale pass to canvas with integer scaling and aspect options.
- Runtime renderer switch (reference ↔ GPU) and a "diff mode" that shows mismatches live.

**Milestone M6**
- [x] Local Chromium: all three chip sizes and all ABI tables round-trip through actual integer/normalized textures and a shader debug pass; see [resource contract](webgl-resources.md).
- [x] Local Chromium: only changed rows upload, checked with counters, instrumented GL calls, CPU dirty queries and two independent consumers. The snapshot bridge currently compares owned rows; canonical revision-cursor optimization remains later work.
- [x] Forced WEBGL_lose_context cycle recreates textures/programs/framebuffers and uploads the latest owned snapshot without reload. Disposal checks resource deletion.

Resource infrastructure and the direct GPU nearest/aspect presentation pass
are implemented. Runtime backend switching/input integration and live diff remain
open. Native non-HAM decode/resolve now has its own local parity evidence below;
this milestone does not claim host fallback or complete mode support.

### Phase 7: GPU parity, non-HAM modes

**Work**
- Decode pass and resolve pass for normal, EHB, DPF, scroll, mixed resolution, border and interlace.
- Sprites in the resolve pass.

**Milestone M7**
- [ ] **Full parity** on every fixture from M1–M3 and M5, including their unfinished mode/capture gates. Current subset: 151 local GPU/CPU frames pass, including independent normal/EHB/laced images and batched scroll/DPF/sprite/copper cases; see [renderer contract](webgl-renderer.md).
- [x] Local Chromium parity on 100 fixed-seed valid non-HAM FrameStates, varying modes, pointers, palettes, delays, windows and physical sprites across all three chip sizes. The browser CI command runs this corpus; hosted execution remains pending. Failures reduce/save replay fixtures, with a deliberate harness-mismatch self-check.

### Phase 8: GPU HAM

**Work**
- Backward-scan HAM resolve (§5.5).
- Profiling on worst-case HAM images. Implement pointer jumping only if it exceeds budget.

**Milestone M8**
- [ ] Parity on all HAM fixtures (the GPU backward scan agrees with the reference forward scan).
- [ ] Worst-case HAM frame resolves in under 1 ms GPU time on the reference hardware set (an integrated GPU laptop and a mid-range phone).

### Phase 9: Mid-line copper events

**Work**
- Interpreter emits events with correct hpos conversion.
- Reference: `paletteAt` with events, HAM-aware.
- GPU: event-table lookup in resolve.
- Overflow → exact segment/register representation, or an explicitly reported CPU frame fallback. Never count fallback output as successful GPU coverage.

**Milestone M9**
- [ ] A fixture with a colour change every 8 lowres pixels across a line (copper "plasma"/chunky) shows parity, and matches an emulator capture.
- [ ] HAM + mid-line palette change fixture shows parity.
- [ ] An overflow fixture (more than MAX_EVENTS on a line) preserves every write and demonstrates reference/GPU parity through exact segments. A separately tested CPU fallback is allowed during migration, but does not satisfy this GPU gate.

### Phase 10: AGA extensions (optional, if targeting AGA AMOS / AMOS Pro AGA extensions)

**Work**
- 7–8 planes, 256-colour palette with 24-bit colour (BPLCON3 bank select + LOCT high/low nibble writes resolved on the CPU).
- HAM8 (6 data bits + 2 control bits).
- BPLCON4 BPLAM (XOR on index), PF2OF (playfield 2 colour offset).
- FMODE fetch widths (affects `fetchBytes` and scroll granularity).
- Wide sprites (32/64 pixels), sprite colour banks.

**Milestone M10**
- [ ] AGA IFF pictures (256-colour, HAM8) match.
- [ ] Parity on AGA fuzz set.

### Phase 11: AMOS runtime integration

**Work.** Map AMOS commands onto the model:

| AMOS                                    | Model                                                       |
|-----------------------------------------|-------------------------------------------------------------|
| `Screen Open n,w,h,colours,mode`        | allocate planes in chip RAM; screen record with BPLCON0     |
| `Screen Display n,x,y,w,h`              | DIW/position in copper builder                              |
| `Screen Offset n,x,y`                   | pointer offset + scroll delay + fetchOffset                 |
| `Dual Playfield a,b` / `Dual Priority`  | DPF bit, plane interleave, PF2PRI                           |
| `Colour`, `Palette`, `Fade`             | screen palette → copper MOVEs                               |
| `Set Rainbow`, `Rainbow`, `Rain(n,l)`   | per-line COLOR MOVEs                                        |
| `Copper Off/On`, `Cop Move`, `Cop Wait`, `Cop Swap`, `Cop Reset` | user copper list path                  |
| `Sprite`, `Set Sprite Buffer`           | sprite manager → lineSprites                                |
| `Bob`, `Paste Bob`, `Autoback`, `Double Buffer`, `Screen Swap` | JS blitter into chip RAM, buffer pointer swap |
| `Plot`, `Draw`, `Bar`, `Text`, `Paste Icon`, `Screen Copy` | JS planar drawing primitives (dirty tracked)  |
| `Hires`, `Lowres`, `Laced`, EHB/HAM screen modes | BPLCON0 flags                                      |

- Planar drawing primitives in JS operate directly on plane bytes. Word/longword-at-a-time paths are used for speed, and each is unit-tested against a naive per-pixel implementation.

**Milestone M11**
- [ ] A suite of small AMOS test programs (one per command group) transpiles and renders. Each is compared to emulator captures of the same program running under real AMOS.
- [ ] At least one complete small AMOS game runs at full frame rate with the GPU renderer, and in diff mode shows zero mismatches over a 60-second recorded input session.

### Phase 12: Performance, robustness and polish

**Work**
- Profiling: main-thread display cost, upload sizes and GPU time per pass.
- Merge decode and resolve for non-HAM frames once parity is stable.
- Optional: run the copper interpreter, builder and reference fallback in a worker, using OffscreenCanvas for the fallback.
- CRT/scanline shader options and integer/fit scaling modes.
- Frame pacing: 50 Hz (PAL) timing on high-refresh displays (accumulator with frame repeat).

**Milestone M12**
- [ ] Main-thread display work under 2 ms per frame for typical lowres/hires games on the reference hardware set.
- [ ] Stable 50 Hz pacing on 60/120/144 Hz displays (no drift over 10 minutes).
- [ ] Fallback renderer sustains 50 fps for lowres 5-plane games on the reference phone.

---

## 8. Testing strategy summary

| Layer            | What                                                     | Tooling                 |
|------------------|----------------------------------------------------------|-------------------------|
| Unit             | register bitfields, ByteRun1, copper decode, pointer math, drawing primitives | existing npm test runner |
| Reference golden | reference renderer vs decoded IFF / emulator captures    | harness + PNG diff      |
| Parity           | GPU vs reference, fixtures + seeded fuzzing              | Playwright + SwiftShader|
| Integration      | AMOS test programs vs emulator captures                  | transpiler + harness    |
| Live             | in-app diff mode + `explainPixel` overlay                | dev build               |

Fuzzing generator rules: random chipset-valid BPLCON0 values, 1–6/8 planes, random pointers within chip RAM, random modulos (including negative), delays 0–15, random palettes, 0–8 sprites, 0–MAX_EVENTS events per line. Each failure is minimised automatically, by shrinking lines, planes and events, into a new permanent fixture.

---

## 9. Risks and mitigations

| Risk | Mitigation |
|------|-----------|
| Reference renderer encodes a misunderstanding of the hardware | Validate against emulator captures and IFF images (§4.6), not just self-consistency |
| Integer textures sample as 0 (wrong filtering) | `NEAREST` everywhere; an M6 readback test catches it |
| Float precision in shaders corrupting addresses | uint-only addressing; fuzz tests with high addresses (2 MB) |
| HAM worst-case GPU cost | Measure in M8; pointer-jumping fallback designed but deferred |
| Mid-line copper complexity grows unbounded | Bound interpreter work/storage; exact segments or explicit CPU fallback preserve writes |
| WebGL2 unavailable / context loss | CPU fallback path shares the same FrameState; restore logic in M6 |
| Emulator capture mismatch due to overscan/filtering | Per-fixture allowed regions; disable emulator filtering for captures |
| AGA scope creep | Phase 10 is optional and isolated behind the `chipset` flag |

---

## 10. Suggested order of work and dependencies

```
P0 ─► P1 ─► P2 ─► P3 ─► P4 ─► P5 ─┐
                │                   ├─► P7 ─► P8 ─► P9 ─► P11 ─► P12
                └──────► P6 ────────┘                    ▲
                                       P10 (optional) ───┘
```

- P6 (WebGL infrastructure) can start in parallel once P2 fixes the FrameState format.
- P11 begins with a static physical-buffer bridge at P1, moves to the shared copper builder at P2–P3, and completes planar drawing/storage migration after parity. The GPU renderer consumes the same snapshots throughout. See D0–D6 in the integrated architecture.
