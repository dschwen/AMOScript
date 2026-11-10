# AMCAF raw blitter graphics

[Play the original Protracker2 visualizer](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-protracker2.html).
Its unchanged loop combines narrow polygon edges, area fill, raw dots, physical
screen copies and buffer swaps. The new commands write the canonical logical
indexed bitmap; the ordinary chip-memory snapshot builder and WebGL decoder
consume those same pixels. No RGBA overlay or CPU rendering fallback is added.

## Turbo Draw and Turbo Plot

`Turbo Draw x1,y1 To x2,y2,colour[,planes]` follows the recovered R15a/R15b line
setup. Positive masks select destination planes; omitted masks select all existing
planes. Lines include both endpoints, normalize their start toward increasing Y,
and use the native major/minor error rule. Horizontal strokes therefore reverse
input order when endpoints share Y. Set Line starts from its first pattern bit
on every stroke; zero pattern bits clear the selected planes. The ordinary AMOS
line-phase counter, Ink/Paper, graphics cursor and drawing masks are unchanged.

A negative mask selects the special single-dot-per-row XOR edge mode. The native
first-pixel toggle cancels the starting row; horizontal edges write nothing.
Subsequent rows receive only their first line point. Repeating the same edge
cancels it. This bounded implementation supports solid patterns and requires
all selected colour bits to be set in this mode. General negative-mode pattern/
minterm behavior is rejected rather than replaced with ordinary Draw.

Coordinates must lie inside a word-aligned bitmap and fit signed words. Lines
are bounded to 1,024 major-axis pixels, with checked native signed start offsets.
The native multi-step clipping algorithm and wrapped geometry remain gated.
The Protracker2 lines stay within this subset.

`Turbo Plot x,y,colour` writes the low colour bits into all existing logical
planes. In-range signed-word points outside the bitmap are clipped away. Both
paths bypass Bob/Autoback hooks, ordinary graphics Clip and graphics-plane masks;
physical double buffers are unchanged until the source swaps them.

## Exclusive area fill

AMCAF R048–R04b programs BLTCON1 as `$0012`: descending **exclusive** fill with
zero starting carry. Scan each row from right to left; source set bits toggle
parity. This preserves the right border and removes the left border. See the
[Commodore area-fill description](https://bastya.net/AmigaDevDocs/hard_6.html).
The hardware manual's `$2418` input becomes `$1c08` in the independent test.

All four recovered forms are implemented: same-screen full/rectangular fill and
source-to-target full/rectangular fill. Rectangle X bounds round outward to
16-pixel words; Y end is exclusive. Target coordinates match source coordinates.
The source remains intact in a distinct target plane or screen, while other
target planes are preserved. In-place operation retains descending live reads.

Bounds and both planes are checked before writing. The subset permits 1–63
words and up to 1,024 rows. The native 64-word size-addition alias and out-of-bank
rectangles remain gated. No hardware DMA races or contention timing are modeled.

`Blitter Wait` is a completed memory barrier in this synchronous model: every
implemented blitter call has finished its real bitmap writes before returning.
It neither schedules fake DMA nor inserts an extra VBL delay. Tests read the
updated plane bytes through Deek and capture the result after the barrier.

## Hex$ formatting

The core one-/two-argument tokens use the original LongToHex digit loop from
[+Lib.s](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/%2BLib.s).
Output has a `$` prefix and uppercase unsigned 32-bit digits. Omitted/negative
widths use the shortest representation. Widths 1–8 return the low digits with
zero padding; zero returns only `$`. Widths above eight revert to the shortest
representation, as in the native loop. Cached token arities stay exact.

## Verification and scope

`tools/reference/check_amcaf_blitter.py` uses rational line positions rather than
the runtime's incremental error loop, and suffix parity rather than its live
fill loop. It produces all-octant point vectors, four primitive matrices and
four early original Protracker2 meter regions. The original expectations use
literal native fine-2 period words 422/316 for the first two sounding cells,
then independently compute the source's histogram, edge and fill arithmetic.

[Run the browser checks](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-blitter.html):
196,608 independent indexed-pixel comparisons, eight complete Canvas/GPU frame
pairs, and the original Mouse Key exit. The real application page also runs
with sound/fullscreen, pause/resume and mouse exit. This is browser/source-derived
evidence, not native captures or a full six-minute GUI replay.

Protracker (the first version) advances past Hex$ to Bchg and other core/Anim
forms. Its `Data/mod.4spirits` input is absent from the supplied distribution.
The compiler and asset builder do not silently replace it with Hawkeye.
