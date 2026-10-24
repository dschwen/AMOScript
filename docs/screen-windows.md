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
units, y=0–255 and windows ending on rows 128–312 (262 for NTSC). Other placement,
overlap, clipping and scheduling forms reject explicitly. A window and its offsets
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

The fixture copies original physical lines 351–360 unchanged, with synthetic
game/background inputs and a Screen 0 / Auto View On / Wait Key suffix. It excludes
Flash Off and the enclosing Gosub. All four game/editor/background combinations
execute in Node. The browser checks five window positions against independent
landscape/panel PNGs; it explicitly restores the original landscape palette after
the source's black setup. Those fixture boundaries are deliberate and documented,
not a claim that the full setup routine or game executes.

Unit coverage checks all fine/coarse phases at both resolutions, physical versus
logical buffers, swaps, immutable snapshots, staged replacement/close, coordinates
and unsupported forms. Eight independent indexed-pattern GPU/CPU comparisons
exercise both resolutions, two palettes, fine/coarse offsets and the blank gap.
The Chromium catalogue includes the standalone scrolling demo with HTML Preview
links. Full-game compilation now first encounters `Fade` on line 236; see
[Wonderland's milestone](wonderland.md).
