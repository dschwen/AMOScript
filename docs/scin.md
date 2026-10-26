# Scin and Roller II pointer selection

`Scin(x,y)` (`$16b6`) now returns the first visible screen whose hardware window
contains the point, searching the live screen priority list from front to back.
No hit returns AMOS EntNul as signed integer `-2147483648`. The query leaves
selection, pixels, cursor state, presentation and input queues unchanged.

`Scin(screen,x,y)` (`$16c4`, internally `Scin From`) starts the same search at
that screen, including it and every lower-priority screen. It is not a test of
only that screen. Omitted screen or -1 starts from the front. The supported start
selector is -1..7; an explicit unopened screen fails. Other wrapped/signed-word
selector aliases remain gated. Both forms require a current open screen before
lookup, including when an explicit start is provided.

Arguments use ordinary numeric integer conversion, once in source order. Hardware
x/y use unsigned low words. Left/top edges are included; right/bottom edges are
excluded. Hidden screens are skipped, including a hidden start screen, and static
clones participate despite being unselectable for drawing. Hires windows use their
hardware width, half their stored bitmap/window width. Source offsets do not move
the hardware hit rectangle. Positions, visibility and priority are live even with
Auto View Off; a copper setup row can be black while still lying inside the logical
window tested by Scin. This is a geometry query, not a test of fetched DMA pixels.

The implementation reuses the existing screen priority order and window model.
The source-derived semantics are pinned to AMOS-Professional-Official revision
`efddf2c9a09bf61a45b7b096a9be84630853c2b1`: `src/lib/screens.cpp`
`zone`/`lib_fn_scin2`/`lib_fn_scin3`, `src/w/mouse.cpp` `screen_at`, and the
original assembled token signatures. The source uses EcPri, unsigned coordinate
words, hidden flags and exclusive window bounds, returning EntNul on no hit.
Within the existing bounded non-laced window model, vertical geometry corresponds
to its EcYBase-adjusted hardware coordinates. Laced/extended modes, arbitrary
horizontal placement, native capture, Mouse Screen and Hzone remain open.

The [browser demo](../demos/roller2-scin.html) runs unchanged original Roller II
lines 341–342 and 344–346: capture X/Y Mouse, compute Scin, conditionally select,
convert X/Y Screen and query Mouse Zone. A prepared back screen has a green
320×250 window at (128,50); a red front window is 320×32 at (128,140) with source
offsets (16,8). The front bitmap is 352×128 to keep its offsets within storage.
Each window has one prepared zone. A synthetic Wait Key loop gates each sample.
Original scrolling-mode line 343, editor setup/drawing/actions and persistence
are excluded. These are original pointer lines in a declared fixture, not the
full editor or a native screen capture.

Five headless groups check exhaustive rectangle-edge/start-order expectations,
unsigned aliases, hide/show/front/close/clone state, live-before-View behavior,
hires and offset handling, factory isolation, DATA/arrays/procedure results,
boxed conversions, once-only evaluation, signature/range errors and original
pointer selections/coordinates/zones without drawing or consuming clicks.

The shared browser scenario checks seven pointer positions through both Canvas
and WebGL hardware-input adapters. Seven Canvas images match an independently
specified stripe oracle: green back rows, red front rows and two black setup rows.
Seven actual GPU frames match the CPU snapshot with CPU presentation disabled
during GPU rendering. Live pointer readout, fullscreen coordinate mapping and
Restart/container retention are checked in the generated offline demo. The gallery
includes an HTML Preview link. This establishes fixture and CPU/GPU parity;
external Amiga reference execution remains outstanding.

Whole-source compilation now stops at slot-1 Music `$0058`, original line 992,
byte 54202. Three of 194 token encodings remain unrecognized. Full gameplay,
end-state AMOS Music and integrated editor behavior remain acceptance work.
