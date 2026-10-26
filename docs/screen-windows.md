# Screen windows and scrolling

Original `Screen Display` `$0a18` and `Screen Offset` `$0a36` now connect AMOS
screen windows to the shared physical planar/copper snapshot. The
[standalone demo](../demos/screen-windows.html) executes Wonderland's original
screen setup and checks landscape scrolling and both panels against independently
decoded PNGs. This is a declared fixture, not the complete game.

## Language and storage

`Screen Display n,x,y,width,height` changes presentation geometry, without
selecting that screen or resizing its bitmap. Omitted numeric arguments retain
their values. The source rounds horizontal placement and width down to multiples
of 16; zero rounded width or zero height retains the old size. Nonzero sizes are
bounded by the bitmap. Width is in lowres hardware units, including hires mode;
the stored viewport width is doubled for hires. Vertical placement and height
use physical rows in the supported nonlaced subset.

The current bounded implementation accepts aligned x=128, widths 128–320 lowres
units and nonnegative vertical positions whose internal signed-word coordinates
do not wrap (Y and Y+height at most 28,671, with the existing minimum end 128).
Committed windows clip to the native nonlaced end row 310 (260 for NTSC). Other placement,
clipping and scheduling forms reject explicitly. Equal-width lowres overlaps use
the [priority slice path](screen-priority.md), including ordinary window opens. A window and its offsets
must fit within its physical bitmap at presentation; wrapped/out-of-bitmap DMA is
unsupported. Negative coordinates and word-overflow behavior remain outside this
subset. Hires offsets discard the low x bit, following the original scroll logic.
HAM fine horizontal offsets reject pending fetched-prefix colour-history support.

`Screen Offset n,x,y` changes the source origin in bitmap pixels. Omitted x/y
retain their values. It changes neither bitmap pixels nor drawing coordinates.
Drawing, Point, Bob saved backgrounds, Autoback and double buffering still use the
full logical/physical buffers. Swapping changes the physical bitmap presented
through the same window. `snapshotPlayfield` and `rgba(screen)` retain their
full-bitmap migration contracts; `snapshotDisplay` applies the window.

X Screen/Y Screen now include the display offset. X Hard/Y Hard retain the
original source's asymmetric rule: placement and resolution conversion, without
subtracting the bitmap offset. Browser pointer coordinates map the composed field
back to the selected screen, including its committed offset; they may lie outside
that window when the pointer is over another screen or a gap.

## Presentation and timing

Existing programs without window commands keep their single-screen presentation.
Issuing a window command opts that screen into an explicitly managed stack.
Only managed windows participate in that stack; implicit display of other opened
screens and the complete AMOS priority/overlap model remain open.

Auto View Off stages geometry, offsets, replacement and closure. View or Auto View
On commits the managed screen descriptors. Committed descriptors retain their old
screen objects and physical buffers until the next commit; live pixel/palette
changes on those objects remain visible. This extends the static view contract;
it does not emulate exact VBL display-list update timing.

Screen Hide/Show now stage visibility through the same commit path. Static,
single-buffer Screen Clone aliases share pixels with independent palettes;
Get Palette copies bounded screen palettes without selecting the source.
See [Roller II's first-image contract](roller2-title.md) for clone selection,
owner-retirement gates and the original FLOAD evidence.

Roller II's foreground prompt at 601–602 now uses bounded priority slices and
DMA-disabled setup rows; see [the priority contract](screen-priority.md).
The separate [board inspector](roller2-boards.md) validates GAMEDISP across all
supplied maps. Occlusion retains physical buffers/offsets and feeds the same
immutable snapshot to CPU and GPU.

The bridge packs each full physical bitmap with its original plane stride. A
coarse x/y offset adjusts bitplane pointers; the remainder sets shared BPLCON1
delay and an earlier data-fetch start. Modulos retain the full bitmap row stride.
Lowres uses an eight-clock early fetch; hires uses four clocks. Neither Canvas
nor the GPU crops a separately rendered RGBA world image.

Different palettes may need more MOVEs than fit before a single row's fetch.
The builder can distribute setup across genuine blank rows before the next
window, writing DIW first to keep those rows inactive. Every chunk must finish
before fetch/capture; insufficient blank space or additional rainbow writes
exceeding that budget reject. There is no mid-line-event fallback. Exact DMA bus
contention and the original engine's full copper allocation remain unimplemented.

Canvas uses the CPU reference of the same immutable snapshot. Lowres output
selects one sample from each duplicated horizontal pair; mixed/hires output retains
native samples. The headless JavaScript runner remains available.

## Evidence and verification

Offsets and signatures come from the pinned original token catalogue. Semantics
follow [`src/lib/screens.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/lib/screens.cpp),
[`src/w/screens.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/w/screens.cpp),
[`src/w/copperlist.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/w/copperlist.cpp)
and [`src/w/mouse.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/w/mouse.cpp).
These are source-derived expectations, not captured Amiga execution.

The fixture copies original physical lines 351–362 unchanged, with synthetic
game/background inputs and a Wait Key suffix. It includes the original Flash Off
and Auto View On, excluding the enclosing Gosub. All four game/editor/background combinations
execute in Node. The browser checks five window positions against independent
landscape/panel PNGs; it explicitly restores the original landscape palette after
the source's black setup. Those fixture boundaries are deliberate and documented,
not a claim that the full setup routine or game executes.

Unit coverage checks all fine/coarse phases at both resolutions, physical versus
logical buffers, swaps, immutable snapshots, staged replacement/close, coordinates
and unsupported forms. Eight independent indexed-pattern GPU/CPU comparisons
exercise both resolutions, two palettes, fine/coarse offsets and the blank gap.
The Chromium catalogue includes the standalone scrolling demo with HTML Preview
links. The whole source now compiles and game entry runs and renders a bounded first-level loop for two nominal seconds; see
[Wonderland's milestone](wonderland.md).

When setup spans real blank rows, the copper builder now reserves each row's
rainbow/palette writes before placing setup chunks. DIW changes still precede
pointer updates. Visible rows retain their strict pre-fetch limit; genuinely
blank rows finish before snapshot capture instead. The original game's two-row world/HUD gap now fits its combined palette
work. Insufficient gaps and palette rows exceeding the budget still reject;
this is bounded scheduling, not exact DMA/bus timing. Nonzero playfield-colour
gap writes may be omitted only when the next row overwrites the same register;
border/sprite colours and final restoration writes remain. The original death
fade now fits the two-row gap. See [the live-game contract](wonderland-game.md).

Screen To Front and ordinary overlapping windows use bounded equal-width lowres priority slices
with shared background colour and real DMA-disabled setup rows. Roller II’s
connected board/ready prompt and full-source editor entry now render; wider overlays and native timing
remain open. See [priority and ready-prompt contract](screen-priority.md).

## Field-edge clipping and parked panels

Native `screens.cpp::view` records the requested Y without an eight-bit limit.
`copperlist.cpp::take_changes`, `cut` and `slices` rebuild visible slices; the
nonlaced exclusive end is `EcYMax-1-EcYBase`, 310 in PAL and 260 in NTSC.
Source reviewed at `efddf2c9a09bf61a45b7b096a9be84630853c2b1`. Wrapped signed-word
coordinates, negative placement and top-border timing remain outside this subset.

The runtime keeps full window Y/height, bitmap ownership and offsets when a window
crosses that end. Only committed physical views are clipped or omitted. Bitmap
bounds are still checked even for a fully off-field window. Pointer mapping uses
the same clipped union as scanout; Auto View Off keeps the previous crop until View.
If every committed window is off-field, a full-field backdrop is interpreted from
zero bitplanes using the foremost committed window's palette; structured sprites
and rainbows still use the shared snapshot. No CPU bitmap compositor is introduced.
Explicit requested-screen snapshot exports retain their existing geometry gates.

A first visible window beginning after row 255 starts with bitplane DMA disabled;
the copper enables it at the actual start before fetch. This prevents the eight-bit
DIW start from advancing source pointers through hidden rows. Later late slices use
the existing DMA-disabled setup row. A one-row slice consumed entirely by setup
keeps its palette/control setup but never enables bitplane DMA, so sprites still
receive the restored palette. The captured geometry retains that blank row.

Original Roller II DROPSCREEN (169–175) moves the panel from 240 through 315 before
its level-test loop. Escape reaches the original key prompt; HOPSCREEN (176–183)
then animates the panel back to 240. The full-source replay verifies the edited
map backup/restoration and foreground pointer selection after return, without
source changes, VM/IP/bank edits or relaxed memory checks. Ten additional editor
Canvas frames and ten GPU comparisons are part of the live game demo. Synthetic
PAL/NTSC row oracles separately cover late first windows, all-off-field backdrops,
setup-only rows, buffer ownership, View and pointer bounds. These are portable and
source-derived checks, not external Amiga captures.
