# Screen-local rectangle zones

The supported original forms are `Reserve Zone [count]`, `Set Zone n,x1,y1 To
x2,y2`, `Reset Zone [n]`, `Zone(x,y)` and `Zone(screen,x,y)`. They use the existing
parser, lowering and display methods, including shared numeric conversion. No
browser API is required for a zone query.

## Storage and lookup

Each actual screen owns its reservation. A positive Reserve Zone count replaces
its old table with a cleared table; zero or the bare form releases it. Counts
0–65535 are supported. Negative values and larger counts reject explicitly rather
than emulating the source's low-word truncation. This models logical allocation,
not AMOS heap exhaustion or physical addresses.

Set Zone requires a reservation and a number in 1–count. Coordinates are stored
as unsigned 16-bit words. The resulting x1 must be less than x2, and y1 less than
y2: reversed and zero-width/height rectangles reject. Endpoints do not normalize
or clip to the bitmap. Negative/oversized coordinate integers use their low words,
so `(-2,-3) To (-1,-1)` is a valid off-bitmap rectangle near 65535.

Query coordinates use the same unsigned-word conversion. All four edges are
inclusive. If definitions overlap, the lowest numbered matching zone wins;
undefined entries do not match. An unreserved table or no hit returns zero.
Queries use bitmap coordinates directly, independent of Screen Display, source
offsets, resolution, View and logical/physical buffer selection. They do not
change the selected screen. The two-argument form uses the current screen;
the three-argument form supports screen 0–7 and -1 for current. A current screen
must exist even when another screen is explicitly named. Other selector aliases
and the source's out-of-range word cases remain unsupported.

Reset Zone n clears one definition while retaining the reservation. Zero or the
bare form clears all definitions. Reset without a reservation and out-of-range
numbers are errors. Set/Reset indices are bounded ordinary numbers; wrapped or
negative index aliases reject. Re-reservation, screen closure or replacement
discards old definitions. Screen selection, swaps, double buffering and Autoback
do not move or duplicate them. Program factories have independent tables.

Zones are metadata. They do not draw outlines, invalidate pixels, change palettes
or cursors, or modify Bob backgrounds. Display snapshots retain their existing
physical-buffer contract and do not include zone definitions.

## Mouse boundary and Wonderland fixture

This feature preserves the existing Canvas input contract: its pointer coordinates
are local to the selected screen. [Mouse limits/clicks and an explicit hardware
Canvas mode](mouse.md) are now implemented separately; Hzone and Mouse Zone
remain unsupported. Do not treat a Zone query
as an implicit conversion between browser-local and Amiga hardware coordinates.

The declared fixture joins unchanged Wonderland screen setup (lines 351–362),
editor-zone setup (371–377) and the Zone assignment at 388. Synthetic game/editor
inputs and a Repeat/Wait Key/Until guard join those slices. The query receives
explicitly injected hardware coordinates; no original Mouse Click, Limit Mouse,
editor actions or complete editor loop executes. Load, Save, Clear, Exit and tile
selection actions remain outside this fixture.

The [self-contained browser demo](../demos/zones.html) checks all 10,240 positions
of the original 320×32 panel with the original expression. Its independent
rectangle oracle produces counts 900/900/900/756/324 for zones 1–5 and 6460 for no
hit. Canvas and CPU panel pixels match the independent original-panel PNG;
queries leave bitmap bytes, presentation version and old snapshots unchanged.
A cropped view of actual Canvas output provides a live point inspector and
Reset/Restore controls. Pointer movement in this inspector explicitly injects
panel-relative hardware coordinates. The separate [mouse demo](mouse.md) exercises
the hardware Canvas adapter and original selection statements.
All browser assertions and demo inputs share the same scenario, linked through
HTML Preview in the [gallery](../demos/index.html).

## Source and verification

The pinned [`src/lib/screens.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/lib/screens.cpp)
contains language handlers and current/explicit-screen dispatch.
[`src/w/mouse.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/w/mouse.cpp)
provides `w_sy_zones_reserve`, `w_sy_zone_set`, `w_sy_zone_reset` and `zone_at`:
per-screen word rectangles, ordered inclusive lookup and table lifetime.
Seven execution groups cover original token overloads, edge/overlap priority,
word coordinates, screen/factory lifecycle, typed scalars/arrays/DATA/procedure
results, numeric conversion, diagnostics and the unchanged original panel query.
An independent-byte conformance fixture separately checks reserve/set/reset/query
forms. These are source-derived expectations and browser comparisons, not an
Amiga execution capture.

The unmodified whole source now compiles. Controlled game entry reaches the
attached-sprite publication gate at Wait Vbl line 204; see
[the milestone](wonderland.md) and [whole-program evidence](file-selector.md).
