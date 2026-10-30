# Horizontal windows and GALAX packed headers

`Screen Display` now accepts hardware x positions 96–240 after unsigned-word,
16-pixel rounding. Fractal3's 180 becomes 176, Plasma uses 160, and packed GALAX
headers retain raw x=129 while their displayed windows use 128. Omitted x retains
the existing placement. A request rejected by the supported bounds does not change
the screen or committed View.

The implementation changes OCS registers and source pointers through the existing
copper/display pipeline. DDFSTRT/STOP shift with the display window. Fetch offsets
are relative to that window; fine scroll and the two playfield lanes retain their
existing source-prefix rules. Logical pixels, full bitmap storage, bank addresses,
physical-buffer ownership and raw snapshotPlayfield are unchanged. There is no
RGBA overlay or CPU replacement for GPU rendering.

Physical windows are bounded at hardware x=464 in lowres and 448 in hires, keeping
fetches inside the supported OCS line. The output crop ends at x=454 at most, the
existing 908-native-sample capture limit. These cuts preserve requested geometry
and bitmap contents. Canvas, WebGL and pointer mapping share the resulting crop;
local hires pointer input keeps pixel precision, and hardware input keeps hardware
units. Horizontal regions ending before 256, wider/unrepresentable fetches, HAM
fine scrolling, mixed hires overlaps and general off-field placement remain gated.

Different-width, shifted lowres windows can now use priority slices, including fine
source offsets. One owner supplies each raster slice, with its own window, fetch
width, palette and stride. Copper setup and sprite-palette deadlines still apply.
A newly opened screen joins an already windowed presentation with its default
window; this exposes Plasma's short report above its scrolling playfield. The
legacy single-screen/raw presentation path remains available before windowed
presentation is established. Auto View/View still capture geometry separately
from logical selection.

## Packed picture metadata

The SCCode/BMCode reader accepts the optional OCS COLOR flag `$0200`, preserving
the raw control word alongside normalized pixel mode. That flag describes colour
signal metadata; it is not an extra plane, HAM, interlace or dual-playfield mode.
Other unsupported control bits still reject. Original bytes and raw window
requests remain intact.

Screen headers contain requested View/Offset values, not the bitmap payload's
bounds. The reader validates stored fields and offsets without requiring every
unused requested viewport to fit at once. `Unpack bank To screen` separately
validates the effective window and complete bitmap range before replacing a
screen. Thus bad active placement leaves the old screen, palette, bank and virtual
addresses intact. Normal horizontal rounding is applied by Screen Display.

Bitmap-only `Unpack bank` retains the destination's window, palette and buffer
identity, validates matching plane counts/bitmap capacity, and ignores the
packed screen's unused viewport. GALAX uses this form for PicAst2: its 670-row
header requests a 670-row viewport at offset 420, but the game copies its full
bitmap into an existing 670-row screen and establishes a separate 228-row window.
Applying that stale full viewport through Unpack To still rejects; no bitmap
range guard was relaxed.

## Evidence

[The browser demo](../demos/horizontal-packed.html) covers:

- Sixteen synthetic lowres/hires placement, clipping and fine-scroll cases.
- All five original GALAX picture banks against independent Python pixels.
  PicAst2 has an explicitly prepared palette and viewport in its bitmap preview.
- Complete unchanged Fractal3 execution and Plasma's bitmap calculation,
  scrolling/palette loop and exit through input.
- Unchanged GALAX startup, title fade and scrolling menu, using supplied banks.
  The default zero memory-availability metadata takes the source's silent branch;
  music, starting a game and gameplay completion are not claimed here.

Twenty-six actual GPU comparisons and 962,072 independent visible/bitmap pixels
pass. The five complete decoded bitmaps additionally match 626,560 independent
indexed pixels in unit checks. Reproduce these vectors with
`python3 tools/compiler_packed_vectors.py`; no production decoder is imported.
These are portable/source checks, not native timing measurements or Amiga captures.

Native references remain pinned to official source revision
`533b4b1f5acd604814513f78e02c7b4796cb0531`: W.s EcView/EcAct1 and EcCopHo/MkC1c/MkCH
supply rounding, horizontal clipping and fetch formulas; Lib.s UnPack_Screen and
UnPack_Bitmap distinguish screen metadata from destination bitmap transfers.
