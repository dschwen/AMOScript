# Signed screen placement and RolIntrIdee2

Both unchanged `RolIntrIdee2.amos` and `RolIntrIdee2.Bak` now complete their
50-step screen slide, reveal the original full image and finish after a key.
The [live demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/screen-slide.html)
provides version selection, Play, Pause/Resume, Restart, fullscreen and optional
sample sound. Browser checks and captured frames remain collapsed below it.

The backup slides the original image strips. The newer source clears parts of
those strips with colour 13 and plays samples 1 and 2. These source differences
are preserved. Neither program is rewritten or steered through VM variables/IP.
The four original files are pinned in `test/fixtures/screen-slide.json` and
`examples/Introideen/`.

## Native-derived placement and bounded support

Native `EcView` stores a word Y. `EcCopper` adds `EcYBase=$1000` and uses the
biased coordinate for its priority table. The table inserts a top boundary at
`EcYStrt-1`, corresponding to raster row 25; DMA begins on row 26. `EcCopHo`
advances the physical bitplane pointers by the visible start minus the screen's
requested Y, including Screen Offset. `EcCopBa` stops bitplane DMA at an exclusive
end row. This is cropping, not shifting the bitmap's contents.

Screen Display now accepts Y **-4095..28671**, with Y+height no greater than
28671. This keeps biased coordinates positive and nonwrapping. More-negative
native clamp cases, aliases from oversized word arguments, wrapped ends and
interlace remain gated. Existing aligned horizontal/width constraints remain.
Small positive windows ending before row 128 are supported too.

Managed presentation clips to `[26,310)` in PAL or `[26,260)` in NTSC. Geometry
retains the requested signed Y and full logical window. Windows wholly above or
below that field contribute no fetches. If every window is off-field, the existing
zero-bitplane backdrop snapshot remains available. Logical and physical bitmap
storage, palettes, offsets, Bob ownership and Auto View/View staging retain their
existing contracts; validation of the full bitmap range is not relaxed just
because the window happens to be invisible.

The physical bridge advances shared planar pointers for the cropped top before
forming priority slices. Short/upper windows use a bounded vertical DIW aperture
and explicit DMA enable/disable copper changes at their actual starts/ends.
The native engine also uses a broad vertical aperture plus DMA control; the
portable builder retains its existing DIW fields for ordinary windows. A later
normal window re-enables DMA after an early-ending one. Setup rows keep their
existing fetch/write budget and palette-capture restrictions. No RGBA
overlay or CPU fallback supplies the GPU output.

Canvas, WebGL and hardware pointer coordinates use the same committed clipped
bounds. Local pointers still map back to the selected screen's requested Y plus
source offset, so the first visible row of a negative window points to its
cropped source row. Changing Y under Auto View Off does not change that committed
mapping until View.

## Evidence

`tools/reference/screen-slide.py` independently decodes the original ILBM,
transcribes both versions' strip copies/clears and computes each frame from the
native top/bottom clipping rules. Its fixture records source/asset hashes, both
strip hashes and all 200 indexed-palette-to-RGBA movement hashes. It imports no
production JavaScript and does not use an Amiga capture.

Six unit groups check crop/offset pointers, immutable snapshots, staged placement,
early DMA endings followed by normal windows, overlap setup/resume rows, parked
windows, strict bitmap ranges, all original PAL/NTSC frames, sample commands,
key completion and Stop/Resume. The shared browser scenario compares all 200
frames to that oracle, performs 28 actual GPU/reference comparisons and 28
hardware-pointer checks, and ends both originals through host key input.

Live-host checks cover sound activation before the first sample, both sample
triggers, the silent backup, Pause/Resume, version replacement, fullscreen, key
completion and page-exit audio cleanup. The shared animation harness remains
usable by Logoanim without audio. Native beam timing, bus contention and broad
mode/placement parity remain open.

Reproduce:

```sh
python3 tools/reference/screen-slide.py
npm run build:demo
npm run check
npm run test:browser
```

Source evidence is pinned AMOS revision
`7f32e0abe1b6b415c9502b598cd3e4cb131018f8`:
[W.s](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/%2BW.s)
(EcView, EcCopper/MkD/MkA, EcCopHo, EcCopBa) and
[Equ.s](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/%2BEqu.s)
(EcYBase/EcYStrt). See also [screen windows](screen-windows.md) and
[screen priority](screen-priority.md) for retained bounds and setup behavior.
