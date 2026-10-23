# Display and browser host contract

Every program factory creates an independent `program.display`. It has a default
320×200, 16-colour screen numbered zero. Screen pixels are palette indices (HAM screens store six-bit commands);
`program.display.rgba()` produces an RGBA snapshot of the physical buffer.
Text and drawing modify logical pixels, which `Point(x,y)` reads. They share one
buffer until Double Buffer is enabled; see [buffering and Autoback](buffering.md).

The [integrated display architecture](display-architecture.md) adopts
[the Amiga/WebGL plan](amiga-webgl-display-plan.md) as the target evolution of this
contract. The FrameState codec, basic planar reference and physical playfield
export are implemented alongside the current Canvas path. The
[OCS copper/stack exporter](copper-display.md) now supplies a hardware display
subset; advanced modes and WebGL2 presentation remain planned. See
[planar export and ILBM support](planar-display.md). Indexed storage remains
authoritative and the logical/physical and Bob rules here still apply.

Current source also contains direct 16-pixel, 1/2-plane sprite composition,
hardware-coordinate helpers and all 32 palette registers. The refreshed baseline
passes 332 tests plus Chromium sprite/native-planar/copper/cursor checks. A separate
WebGL2 integer readback probe verifies capability, not a GPU display backend.

## Supported AMOS instructions

- `Screen Open id,width,height,colours,Lowres/Hires`, `Screen id`, `Screen Close id`.
  Screens 0–7, dimensions 1–1024 wide and 1–1023 high, and 2/4/8/16/32/64 colours
  are supported, plus 4096 for lowres HAM6 (six-bit pixel commands, 16 base colours;
  see [HAM semantics](ham-display.md)). Hires permits at most 16. Lowres 64-colour EHB derives half-bright
  entries from the 32-register palette. Reopening replaces the screen. The minimum text cell is 8×8;
  smaller screens support graphics and reject text output explicitly.
- `Palette`, `Colour index,$RGB`, and the read-only `Colour(index)` token variant.
  Colour register numbers mask to five bits and values to twelve; Palette skips
  negative signed low words. See [mode and palette semantics](display-modes.md).
  `Screen`, `Screen Width` and
  `Screen Height` query variants return the selected screen and dimensions.
- `Ink`, `Plot`, `Point`, `Draw`, `Draw To`, `Box`, `Bar`, `Gr Locate`.
  Rectangles include both end coordinates. Lines and rectangles clip to the
  screen, including very large off-screen coordinates. Out-of-bounds `Point`
  returns -1. Omitted coordinates use the graphics cursor.
- `Cls`, coloured/rectangular `Cls`, `Locate`, `Home`, `Pen`, `Paper`, `Set Tab`,
  `Centre`, `Text`, and ordinary `Print`. Text positions use 8×8 character cells;
  `Text x,y,string$` uses pixel coordinates with y as the baseline. Printing
  scrolls the pixel buffer when it reaches the bottom text row. `Print` still
  forwards output to the selected `write`/`print` host.
- `Inkey$`, `Put Key`, `Clear Key`, `X Mouse`, `Y Mouse`, and `Mouse Key` query
  tokens. Keyboard input is a FIFO queue shared with `Wait Key`.
- `Paste Bob`, `Paste Icon`, `Get Sprite/Bob Palette` and `Get Icon Palette`,
  including masked palette variants. `Hrev/Vrev/Rev` select image orientation;
  `Make/No Mask` and `Make/No Icon Mask` control image transparency. See
  [the bank contract](banks.md) for embedded formats, flipping and mixed depths.
- `Bob`, `Bob Off`, `Bob Update On/Off`, `Bob Update`, `Bob Clear/Draw`,
  `X/Y/I Bob`, `Hot Spot`, `Set Bob`, `Limit Bob`, and Bob priority commands.
  See [the Bob contract](bobs.md)
  for saved backgrounds, screen ownership and cooperative update timing.
- `Bob Col` and its ranged variant, plus `Col` status/search queries. These use
  existing image masks; see [the collision contract](collisions.md).
- `Double Buffer`, both forms of `Screen Swap`, and `Autoback 0/1/2`.
  Canvas presents physical pixels; drawing and Point use logical pixels.
- Direct `Sprite` numbers 0–7, `Sprite Off` (one/all), `Sprite Update On/Off`,
  `Sprite Update`, `Sprite Priority`, `X/Y/I Sprite`, `Hide On` and `Show On`.
  Images must be 16 pixels wide, 1/2 planes and at most 270 lines high. Sprite
  zero is hidden while the mouse pointer is visible. Zero image pixels are
  transparent; lower sprite numbers win overlaps. Manual mode preserves the
  presented frame while queries read pending coordinates. Automatic updates
  flush at cooperative execution boundaries, rather than hardware VBLs.

The [AMOS screen manual](https://amospromanual.dev/06-01-setting-up-screens.html)
describes screen identities and basic modes. The
[graphics manual](https://amospromanual.dev/06-04-graphics.html) describes pixel
coordinates, drawing primitives and the graphics cursor. Token variants and
their separate arities come from the original AMOS token table.

## Canvas adapter

Load `lib/amos/browser.js` after the generated program script:

```js
const canvas = document.getElementById('screen');
const host = AMOS_BROWSER.createCanvasHost(canvas);
const program = AMOS_MODULE({ write: text => { output.textContent += text; } });
host.attach(program);
program.tick(1000);
host.focus();
```

Give the canvas `tabindex="0"` so it can receive keyboard events. The adapter
coalesces updates with animation frames and renders palette pixels with
`putImageData`. `host.render()` forces a synchronous redraw. `host.detach()`
removes listeners and pending renders; runtime execution remains controlled by
`program.stop()` and `program.resume()`.

Mouse positions are canvas-local screen pixels, scaled from the canvas content
box. Borders and CSS scaling are accounted for. Buttons use bits 1/2/4 for
left/right/middle. Keyboard input is forwarded while the canvas is focused:
printable characters, Enter, Escape and Backspace. Modifier shortcuts remain
available to the browser. Direct host injection is also available through
`program.sendKey(character)` and `program.setMouse(x,y,buttons)`.

## Verification and limitations

`npm test` checks indexed pixels, palette conversion, clipping, text rasterization,
scrolling, per-screen state, compiler lowering, render coalescing, input mapping
and listener cleanup. `npm run test:browser` uses real Chromium to check the
page, exact Canvas shapes and bank image colours, transparency, keyboard
wait/resumption, pointer events, switching
programs and Stop. It writes `test/artifacts/graphics.png` for visual inspection.

The current font is the public-domain basic Latin 8×8 bitmap by Daniel Hepper,
Marcel Sondaar and IBM, from
[font8x8_basic.h](https://github.com/dhepper/font8x8/blob/master/font8x8_basic.h).
The pixel data and attribution are preserved in `lib/amos/font.js`. This is not
the Amiga Topaz typeface; unsupported characters use a question-mark glyph.
Initial palette entries beyond the conventional basic colours are approximate.

The current display selects one screen for presentation. Amiga hardware mouse
offsets, copper/display composition, screen scrolling/display offsets, flashing
colours, cursor animation, HAM raster events and live interlace modes, complete text escape sequences,
fonts/styles, fill/line patterns, circles/ellipses and full hardware/computed sprites
remain unfinished. Direct sprites publish physical rows shared by Canvas and the
CPU reference, which also decodes bounded raw DMA streams. Computed/attached
AMOS allocation and complete bus/shifter timing remain separate work; see
[sprite contract](sprite-display.md). Unsupported command tokens and unsupported screen modes fail
explicitly. Floating-point and numeric text-format compatibility remain separate
work items in PLAN.md.

The CPU reference also decodes static scroll/dual-playfield state and explicit
ILBM fields, with pure weave/line-double composition. Those image/model APIs do
not yet provide AMOS Screen Offset/Dual Playfield/Laced commands or live field
scheduling. See [the mode contract](display-modes.md).
