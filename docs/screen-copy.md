# Full screen bitmap copying

The bounded form `Screen Copy source To destination` copies raw pixel codes at
bitmap origin (0,0). Operands are integers: ordinary screen numbers select logical
buffers; `Logic`, `Physic`, `Logic(n)` and `Physic(n)` select current or numbered
logical/physical buffers. The original two-operand token is `$0986`.
Rectangle and minterm variants remain unsupported and fail explicitly.

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
The full game remains blocked at Rnd `$0686`, line 560, byte 21156;
2 encodings remain unrecognized, appearing 14 times. See [the milestone](wonderland.md).
