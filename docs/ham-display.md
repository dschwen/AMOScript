# HAM6 CPU display contract

HAM6 is implemented in the CPU reference, ILBM loader, indexed Canvas converter
and standalone generated modules. It uses the existing ABI v1 BPLCON0 HAM bit;
no wire-layout change or GPU renderer is involved.

`Screen Open n,w,h,4096,Lowres` selects six planes with 64 pixel commands and
16 base palette colours. The internal screen records `ham: true` and
`colours: 64`. Drawing, Point, image pastes, Bobs and saved backgrounds retain
the raw six-bit commands. Point does not return a resolved RGB colour.
The original AMOS
[InScreenOpen handler](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BLib.s)
maps 4096 to six planes and the HAM flag; hires HAM rejects.

Each row starts from COLOR00. Bits 5–4 select palette lookup, blue modification,
red modification or green modification, respectively; bits 3–0 supply the
palette index or replacement four-bit component. Other components retain their
previous values. Five-plane HAM has an absent sixth bit, so only palette and
blue commands occur. This follows the
[hardware HAM description](https://amigadev.elowar.com/read/ADCD_2.1/Hardware_Manual_guide/node008F.html).
[color.js](../lib/display/model/color.js) supplies the shared packed 12-bit
operation; channels expand by exactly 17.

The reference advances state once per source pixel, then duplicates lowres
samples onto the native grid. Borders retain COLOR00. A cropped prefix inside
the display window is decoded before visible samples; processing is bounded to
4096 source pixels per line, including that prefix. explainPixel reports the
operation, prior colour and number of processed source pixels. Calls retain no
hidden row, field or factory history.

The Canvas path resolves the physical buffer afresh, then applies the existing
direct-sprite overlay. Swaps, Autoback and background restoration operate on raw
commands, so changing an earlier command can change later displayed colours.
Physical playfield and copper-stack exports preserve the HAM flag and palette.
Sprites remain outside full-bitmap playfield exports. Copper-stack exports now
include direct physical channels; see [sprite contract](sprite-display.md).

The ILBM reader accepts explicit CAMG HAM `$0800`, five or six lowres planes,
raw or ByteRun1 BODY and HAM+LACE `$0804`. Fields use the explicit field composer.
HAM+EHB, hires HAM and other plane counts reject. Missing palette entries use
the loader's grayscale base-colour fallback. This utility is not yet wired to
an AMOS Load Iff command.

Verification includes ten independently generated six-plane ILBM/PNG images,
five-plane and laced variants, long modify-only runs, row resets, cropped carry,
typed DATA/array/procedure values, buffer restoration and factory isolation.
Chromium checks source-compiled pixels across Canvas, planar and copper output;
its screenshot is `test/artifacts/ham.png`. Fixture provenance is documented in
the [fixture README](../test/fixtures/display/README.md).

These are synthetic references, not AMOS/emulator captures. HAM8, mid-line
palette/mode events, arbitrary DMA/border latch behavior, live interlace timing
and GPU HAM remain open. Fetch prefixes outside the display window are not
replayed as HAM history; that boundary still needs hardware/reference evidence.
