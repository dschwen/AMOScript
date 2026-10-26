# Screen bitmap copying

The bounded form `Screen Copy source To destination` copies raw pixel codes at
bitmap origin (0,0). Operands are integers: ordinary screen numbers select logical
buffers; `Logic`, `Physic`, `Logic(n)` and `Physic(n)` select current or numbered
logical/physical buffers. The original two-operand token is `$0986`.
The eight-operand rectangle token `$09a8` is also supported:
`Screen Copy source,x1,y1,xEnd,yEnd To destination,x,y`. Explicit minterm
variants `$099c` and `$09be` remain unsupported and fail explicitly.

## Selectors and ownership

Queries pack signed 32-bit integers, without checking whether a screen is open:

| Query | Value / bits |
| --- | --- |
| `Logic` | `$BFFFFFFF` / -1073741825 |
| `Physic` | `$FFFFFFFF` / -1 |
| `Logic(n)` | `(n OR $80000000) AND $BFFFFFFF` |
| `Physic(n)` | `n OR $C0000000` |

Copy resolves these selectors when it executes, including after swaps or screen
replacement. For negative selectors a negative signed low word means the current
screen; otherwise the low word names screen 0–7. Bit 30 chooses physical storage.
A nonnegative selector must be 0–7 and chooses logical storage. Missing screens
fail with source context. Destination validation precedes source validation.
Selectors are buffer choices, separate from chip-memory or generic-bank addresses.

Copy preserves the selected screen, both buffer identities, cursor positions,
palettes, windows, offsets and Autoback settings. Single-buffer self-copies do
nothing. The copy covers the smaller width and height at the two bitmap origins,
including pixels outside displayed windows. It copies the common low bitplanes;
extra destination planes and pixels outside the intersection retain their values.
Raw EHB/HAM codes do not undergo RGB conversion or resolution scaling.

This operation bypasses drawing/Autoback synchronization. It neither transfers nor
clears saved Bob backgrounds: those remain owned by their existing actual buffers.
A later Bob Clear can therefore restore a background saved before a raw overwrite.
Callers must order copies and Bob clear/draw operations appropriately. Screen Swap
continues to exchange buffer identities through its existing separate path.
Copy completes synchronously; exact DMA/blitter timing is outside this subset.

## Source and verification

The pinned original [`src/lib/screens.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/lib/screens.cpp)
provides `get_screen`, `screen_copy`, `logic0/1` and `physic0/1`.
The shared copier in [`src/w/drawing.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/w/drawing.cpp)
clips bitmaps and copies their common planes. Tests cover raw selector words,
typed values/DATA/arrays/procedure results, clipping, buffer ownership, Autoback,
Bob backgrounds, immutable snapshots, failure context and unsupported forms.
An independent-byte conformance fixture checks both copy directions.

The declared Wonderland fixture joins unchanged original title setup (lines 1–64),
game-screen setup (351–362), palette setup (264–276), panel fields (285/655),
level-data loops (309–315) and map-paste/copy loops (287–305). Synthetic game/level
inputs, panel selection and Wait Key/End guards join those slices. For all five
levels it checks original enemy/block counts, hidden logical bytes, complete physical
publication, stable identities and unchanged panel bytes. It includes Flash Off
and Auto View On, and excludes score awards, enemy initialization, rainbow
activation and gameplay.

The shared browser scenario captures ten frames. Canvas and CPU agree; a separate
palette lookup over the runtime-composed indexed input checks 640,000 displayed
pixels. Two copper setup rows per frame are checked for Canvas/CPU parity only.
These are copy/presentation checks, not independent tile-composition goldens or
Amiga execution captures. Two synthetic native GPU frames additionally check
hidden drawing and published copying against independent uniform RGB expectations.

The [self-contained demo](../demos/screen-copy.html) includes all five levels,
explicit injected-clock Prepare/Publish controls and host-controlled bitmap
scroll inspection. It appears with an HTML Preview link in the [gallery](../demos/index.html).
The unmodified Wonderland source now compiles completely. Controlled game entry
now runs and renders a bounded first-level loop for two nominal seconds; see
[the milestone](wonderland.md) and [selector/whole-program evidence](file-selector.md).

## Rectangular copy

Rectangle ends are **exclusive**. Original Tunneltest line 8 copies 95 columns
and 30 rows with `Screen Copy 1,0,0,95,30 To 0,0,0`. Destination selectors resolve
before source selectors, after expressions have each been evaluated once in
source order. The shared display signature lowers all eight numeric operands.

Clipping follows `lib_sco0` in native `src/lib/screens.cpp` at pinned revision
`efddf2c9a09bf61a45b7b096a9be84630853c2b1`: negative
source origins shift the destination; negative destination origins consume source
pixels. Then the source end is bounded to the source bitmap, the adjusted source
origin is subtracted, and the extent is clipped to the destination bitmap. Empty,
reversed and fully off-bitmap rectangles are no-ops. Endpoints are not reordered.
The bounded profile accepts signed-word coordinates and rejects arithmetic that
would wrap a clipped origin; general wrapped-word geometry remains unsupported.

Copies snapshot source codes before writes, so overlapping self/clone copies are
safe in every direction. They copy common low planes and preserve extra destination
planes. Tagged logical/physical selectors, buffer identities, selection, palettes,
view windows, text cursors and Autoback remain unchanged. Rectangle copies use the
same raw path as whole-screen copies: no drawing or Bob hooks and no implicit
publication to the other buffer. A stale saved Bob background stays owned by its
existing buffer. No RGB conversion, stretching or drawing minterm is applied.

Four rectangle test groups cover exclusive bounds, paired clipping, independent
per-pixel results, overlaps/aliases, tagged physical destinations, hooks/Autoback,
old snapshots, typed values and rejected forms. Original [Tunneltest](../examples/Tunnel/README.md)
now compiles completely. Its source runs unmodified with the supplied
external icon bank and original IFF background. An independent Python decoder
and animation oracle verify all 24 wheel icons and both ten-frame branches over
48 physical-buffer/RGBA hashes. Five PNGs and five actual GPU comparisons cover
selected animation frames. This establishes source/asset fixture and browser parity,
not external Amiga reference execution.

The [tunnel demo](../demos/tunnel.html) offers animation, pause/resume, single-frame
stepping, Restart, fullscreen and an IFF background picker. Uploads complete before
VM execution; no asynchronous file object or Promise is returned to AMOS Load.
The gallery features it alongside games and music; individual command checks remain
available in its collapsed technical section.
