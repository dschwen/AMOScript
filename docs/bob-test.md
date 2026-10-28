# BobTest: 64 bouncing Bobs

[Run the demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/bob-test.html)
from the gallery’s **More to explore** section. Press **Play Demo**, then a key
inside the canvas to start the original 500-frame loop. The final key prompt
ends the program. Pause, Resume, Restart and Fullscreen use the shared live intro
host; rendering defaults to WebGL2 with Canvas fallback.

`examples/BobTest/BobTest.amos` is an unchanged copy of the supplied root file,
pinned by `manifest.json` (4,454 bytes, SHA-256
`3e275a0baf7724d9f08f9c51f25d876e34246b66892f48fc0d5bd0833a4265ce`).
The complete 59-line source compiles to 111 instructions. Its three images are
created by the original drawing/Get Bob statements, replacing the embedded bank
images. Startup keys, VM variable/IP edits and substituted image assets are not
used. `BobTest.amos2` is a different, unrequested input.

The source numbers its objects **1–64**. AMOS defaults to IDs 0–63 but can increase
its Bob capacity ([manual](https://amospromanual.dev/07-02-blitter-objects.html),
BOB). The factory now accepts `maxBobs` (integer 1–256, default 64); this page
passes `{maxBobs:65}`. Capacity is per factory and fixed at creation. Sprite
limits remain independent. This is a host configuration choice rather than a
change to the source or an unconditional relaxation of Bob bounds.

The source has no Wait Vbl or Double Buffer in its movement loop. It runs through
ordinary cooperative instruction budgets and can flicker or present partial
updates. Its printed Timer depends on browser scheduling, renderer and machine;
it is **not an Amiga speed benchmark**. Random initialization uses the runtime’s
documented portable zero startup seed/beam, without injecting Randomize.

## Graphics support

- `Circle x,y,radius` (`$0e9a`) draws a solid outline in Ink and leaves the graphics
  cursor at its centre. This slice accepts positive signed-word radii and centres
  with signed-word bounding extents, lowres and solid Set Line. Pixel writes clip
  to the bitmap. Its portable midpoint outline is independently specified by
  nearest-circle octant samples; native DrawEllipse rounding remains unverified.
  Hires ellipses and patterned outlines reject before drawing hooks.
- `Paint x,y` (`$0ee8`) fills the four-connected component of the seed colour with
  Ink. The native two-argument form selects mode 1. Seed colour is read before
  Bob restoration and retained for both Autoback passes. Out-of-bitmap seeds are
  no-ops; coordinates are bounded signed words. The iterative queue is bounded
  by the bitmap size. Explicit modes and fill patterns remain unsupported.
- `Get Bob image,x1,y1 To x2,y2` (`$1bfc`) captures logical screen pixels into bank
  1. Exclusive in-bitmap bounds and width rounded to 16 pixels follow the shared
  Get Icon capture path. Extra right pixels are zero. New records have zero
  hotspots, transparent-zero masking and no cached mask; rendering generates it
  lazily. Replacement drops the old image mask/hotspot while preserving other
  records and the bank palette. New banks use the selected screen palette.
  Capture does not draw, restore Bobs or replay Autoback. Geometry, record index,
  payload size and existing bank type validate before replacement.

Circle/Paint use the existing drawing hooks and Autoback replay. They write
indexed logical bitmap pixels. The physical-screen bridge publishes those pixels
as planar chip snapshots for the existing WebGL shader passes; there is no RGBA
overlay. Get Bob captures image pixels without writing the display.

Native evidence is the pinned AMOS source at revision
[`533b4b1f5acd604814513f78e02c7b4796cb0531`](https://github.com/AOZ-Studio/AMOS-Professional-Official/tree/533b4b1f5acd604814513f78e02c7b4796cb0531):
[`+Lib.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BLib.s)
`InCircle`/`EllCir`, `InPaint2`/`InPaint3`, `GfxPnt`/`GfxF0`,
`InGetSprite5`/`GS`; and
[`+W.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BW.s)
`TPaint`/`PMask`, `GetBob`, `BbInit`/`BobSet`.
The original routines use DrawEllipse and a configurable `T_BbMax`; GetBob clears
the image mask pointer, whereas Get Icon explicitly disables transparency.
Exact native edge pixels, busy-loop timing and Amiga captures remain open.

## Verification and rebuilding

`python3 tools/generate_bobtest_oracle.py` produces the three image references and
all 501 sets of 64 positions. It uses screen-coordinate circle geometry,
independent Python random word arithmetic and the transcribed source movement
rules, without loading the compiler/runtime.

Tests execute the complete source, verify all **32,064 object positions**, compare
five complete independent composites over the original pre-animation background,
and check full Bob Off background restoration before the final Print. Eight
Canvas frames and eight actual WebGL frames cover the original prompts, sampled
movement and restoration. GPU checks forbid the CPU presentation path.

Live browser checks exercise startup without an injected key, movement,
Pause/Resume, final key, Restart, fullscreen and disposal. Compiler/runtime checks
cover typed signature rejection, clipping/fill connectivity, preflight, Autoback,
image replacement and default/configured Bob limits. These are portable/source
and browser-renderer checks, not native Amiga captures.

Run `npm run build:demo` to regenerate the self-contained page and gallery links.
Run `npm run check` and `npm run test:browser` to validate them.
