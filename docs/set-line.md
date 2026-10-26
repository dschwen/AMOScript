# Set Line and Roller II selection borders

Set Line `$1034` now stores the low sixteen bits of its numeric argument on the
selected screen. Fresh/reopened screens use `$FFFF`; screen switches and separate
program factories keep independent state. The existing signature parser and
numeric lowering support integer, boxed/dynamic numeric, DATA, array and procedure
result paths. Set Line does not draw, move either cursor or reset pattern phase.

Draw, Draw To and Box consume that screen's pattern through the shared indexed
bitmap drawing path. The portable profile starts at bit 15, walks toward bit 0
and repeats. Set bits paint Ink's foreground; clear bits paint its existing
background register. This is the default opaque graphics profile. Bar, Plot,
text, Cline and image pastes retain their existing behavior. General graphics
writing/complement/inverse/transparent modes remain gated with Gr Writing.
[Writing](writing.md) affects window text separately.

The phase is a separate per-screen value, initially 15. Each line advances it
by its major-axis distance, keeping the shared endpoint's bit when continuing
another segment. Draw's explicit coordinates and Gr Locate do not reset it:
AMOS's move_cursor assigns the RastPort cursor directly rather than calling the
OS Move routine. Patterned Box follows the original PolyDraw point order: from
(x1,y1) down the first side, across the bottom, back up, then across the top.
The established portable graphics-cursor endpoint (x2,y2) is preserved. Solid
`$FFFF` lines retain the existing clipped raster path and large-coordinate bounds.

Other patterns use the existing Bresenham stepping rules before clipping pixel
writes, so invisible pixels retain their place in the pattern. Their endpoints
must fit signed words; unsupported coordinates reject before drawing/Bob hooks
or state mutation. That bounds each walk to 65,536 pixel visits. Default solid
clipping remains bounded independently of distant endpoints. Native coordinate
wrapping, exact graphics.library phase behavior across every command, reversed/
clipped octant tie parity and native hardware timing remain capture gates.
This is a declared portable raster/phase profile, not a native graphics capture.

AMOS source evidence is pinned to AMOS-Professional-Official revision
`efddf2c9a09bf61a45b7b096a9be84630853c2b1`: `src/lib/screens.cpp` lib_in_set_line,
move_cursor, lib_in_box and gfx_autoback, and `src/w/screens.cpp` default line
word. The source stores a UWORD and delegates line drawing to graphics.library.
For the external library model, primary AROS source is pinned to revision
`59b6c2433bc92d1d449b76bc8ce27373465d5157`:
[Draw](https://github.com/aros-development-team/AROS/blob/59b6c2433bc92d1d449b76bc8ce27373465d5157/rom/graphics/draw.c),
[Move](https://github.com/aros-development-team/AROS/blob/59b6c2433bc92d1d449b76bc8ce27373465d5157/rom/graphics/move.c),
[PolyDraw](https://github.com/aros-development-team/AROS/blob/59b6c2433bc92d1d449b76bc8ce27373465d5157/rom/graphics/polydraw.c)
and the [bitmap line renderer](https://github.com/aros-development-team/AROS/blob/59b6c2433bc92d1d449b76bc8ce27373465d5157/rom/hidds/gfx/gfx_bitmapclass.c).
These support the pattern-bit direction, opaque background, connected drawing
and cursor/counter distinction. They are another implementation, not evidence
that all native Amiga clipping/counter details have been captured.

## Buffer and Bob ownership

Patterned drawing uses the existing drawing wrapper and its before/after Bob
hooks. Autoback replays the same starting phase into the second buffer and keeps
only the logical pass's final phase. Pixel/buffer/screen/Bob identities remain
unchanged. Unsupported patterned geometry is preflighted before hooks can restore
or erase a held Bob. Existing snapshots encode the resulting indexed pixels;
CPU and GPU consume the same physical snapshot without a pattern-specific RGBA
callback, shader path or fallback.

## Original selection preview and evidence

The [selection demo](../demos/roller2-lines.html) runs unchanged Roller II lines
333, 354 and 356: draw `$CCCC` with Ink 20, erase with `$FFFF`/Ink 0, and redraw
`$CCCC` at another cell. The preview deliberately opens a blank 320×200 screen
and loads the original icon palette. Prepared Input# cell values replace original
mouse-cell line 355. Panel construction, Writing, editor/game input loops and
persistence are excluded. The first rectangle begins at (33,-1), so its invisible
top row still contributes to pattern phase. The redraw uses prepared cell (4,2).

`tools/reference/roller2_line_pattern.py` independently builds all three PNGs,
full indexed/RGBA hashes and phase metadata from the raw palette and an explicit
axis-step oracle. It imports only the independent Python asset reader. Six
headless groups cover masking/state and typed storage, connected phase, clipping,
eight octants, zero patterns, signed-word errors with source context, unaffected
solid drawing/other primitives, all Autoback modes and Bob background ownership.
The original fixture matches every independent image/hash and phase.

The shared browser scenario checks three independent Canvas images and three
actual WebGL frames with CPU presentation disabled during GPU rendering. The
live WebGL preview supports erase, prepared edge-cell redraw, fullscreen and
Restart while preserving its container. The gallery provides its HTML Preview
link and embeds all assets for offline use. These are fixture/CPU/GPU comparisons,
not an original editor screen or native Amiga execution.

A separate [Writing fixture](writing.md) now runs original 334 labels.
Whole-source compilation now stops at Get Icon `$1cc6`, original line 480,
byte 26044. Seven of the 194 token encodings remain unrecognized; recognition alone
does not complete game/editor behavior.
