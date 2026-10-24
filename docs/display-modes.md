# Scroll, EHB, dual playfields and explicit fields

Status: these CPU mode/field paths are implemented in ABI v1. They extend
[planar decoding](planar-display.md) and [the copper path](copper-display.md).
[HAM6](ham-display.md) is also implemented. Full ECS superhires, HAM8,
sprite contention/computed allocation, live interlace timing, DMA arbitration
and GPU rendering remain open. Synthetic goldens establish behavior and migration
comparisons; no fixture here is an emulator or AMOS execution capture.

## Bitplane scroll and fetch alignment

`lineRegs[9]` contains BPLCON1. Its low nibble delays planes 1/3/5 and its next
nibble planes 2/4/6. These are lowres units: hires doubles their source-pixel
delay. Thus a one-unit delay moves either resolution by two OCS native samples.
Negative source positions read zero without accessing preceding chip bytes.
Per-plane pixel traces include the adjusted sourceBit when it differs from the
unscrolled source coordinate, including null byte addresses for blanked positions.

Column 15 is a signed source-pixel fetch offset stored as Uint32 bits. The basic
renderer accepts offsets in ±65535 and checks every nonnegative fetch address.
Static frames can supply this offset directly. Values zero retain the old ABI
behavior. For the current x=128 copper profile, earlier data fetches add prefix
pixels relative to normal DDF start ($38 lowres, $3C hires). Raw lowres DDF values
ignore bits 0–2; hires ignores bits 0–1. Arbitrary DIW/DDF phase relationships and
mid-line scroll timing still need capture/word-level validation.

The copper builder accepts a per-view scroll byte. Nonzero scrolling starts DMA
eight clocks earlier, providing one extra lowres word or two extra hires words.
The caller's raw plane storage must include that prefix; modulos account for the
actual fetched size and row stride. [AMOS Screen Offset](screen-windows.md) now
adjusts physical plane pointers and scroll delay through the same builder. Its
hires path requests a four-clock advance, preserving the source's even-pixel
precision; the default raw-model advance remains eight clocks.

These definitions follow the Commodore
[playfield register summary](https://amigadev.elowar.com/read/ADCD_2.1/Hardware_Manual_guide/node0092.html),
[scroll setup](https://bastya.net/AmigaDevDocs/hard_3.html) and the original
[scroll-code bit definitions](https://www.ikod.se/references/amiga-aga-guide/registers-by-name/).
Tests sweep all 256 odd/even delay pairs in lowres and hires, with and without
prefixes. Additional copper fixtures verify fetched prefixes and row advancement.
The M3 emulator-captured scroll sweep remains an independent unfinished gate.

## Extra Half Brite

Six normal lowres planes with HAM and dual-playfield bits clear select EHB.
The lower five bits select one of 32 palette registers; bit 5 halves each
four-bit RGB channel before expansion to eight bits. For example, `$135` becomes
`$012` → RGBA `[0,17,34,255]`; white becomes `[119,119,119,255]`. Halving an
already-expanded eight-bit colour would give different results and is not used.
The [hardware EHB description](https://amigadev.elowar.com/read/ADCD_2.1/Hardware_Manual_guide/node0098.html)
defines the sixth-plane reduction.

`Screen Open n,w,h,64,Lowres` now works through the existing token/parser/lowerer
path. Drawing, text, Point, image-plane masks, Bobs and buffers use six-bit
indices. The indexed Canvas converter and standalone planar/copper output all
derive upper-half colours from the shared 32-register palette. The physical
bridge remains one-way; indexed arrays still own drawing state.

The source also establishes Hires's four-plane/16-colour limit, now enforced by
AMOS Screen Open. The 4096-colour lowres form selects HAM6; Laced mode still
rejects in the AMOS facade pending live field timing. The mode
rules come from original
[InScreenOpen](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BLib.s)
and the [screen manual](https://amospromanual.dev/06-01-setting-up-screens.html).

The ILBM reader supports six-plane EHB with explicit CAMG `$80`, including raw
and ByteRun1 BODY data and EHB+LACE. It rejects missing/inconsistent EHB declarations
and hires EHB, rather than guessing an ambiguous legacy six-plane file's mode.
Independent PNG fixtures cover all 64 indices, odd channel values and row padding.
Chromium compares source-compiled EHB pixels across Canvas/planar/copper and saves
`test/artifacts/ehb.png`.

## Palette conversion

AMOS Colour now masks integer register numbers to five bits and RGB values to
twelve bits. `Colour 33,$1135` changes register 1 to `$135`; `Colour(-1)` reads
register 31. This does not create writable registers 32–63 for EHB: they are
derived pixel colours. Palette entries with a negative signed low word are
omitted; null omitted arguments retain the same skip behavior. Other entries
use the masked RGB value.

The original [EcSCol/EcGCol/EcSPal handlers](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BW.s)
establish these masks and signed-word omission. Language arguments first use the
shared integer conversion, including Val and procedure results. Direct host API
arguments must still be safe integers. Previous strict 0–31/$000–$FFF errors have
been corrected to these source-derived rules. Tests include scalar/array/DATA/
procedure values and six-plane pasting. Heap/interrupt/flash behavior is not implied.

## Dual playfields

Setting BPLCON0 bit 10 splits odd-numbered planes into PF1 and even-numbered
planes into PF2. Each group is compacted to its own index. PF1 uses palette
1–7, PF2 uses 9–15; a zero group is transparent. If both are zero the result is
COLOR00, regardless of COLOR08. BPLCON2 bit 6 selects which nonzero group wins.
The reference supports the 2/4/6-plane variants and exposes both group indices,
selected playfield and final palette index in explainPixel. Sprite priority bits
are now resolved against physical channels; see [sprite contract](sprite-display.md).

Static frames and raw copper builder views accept dualPlayfield/pf2Priority
flags. This is not yet the AMOS Dual Playfield/Dual Priority command pipeline:
those commands must link screen identity, palettes and independent offsets using
verified token/source semantics. The current Canvas host still presents one
indexed screen. The
[dual-playfield summary](https://amigadev.grimore.org/Hardware_Manual_guide/node007d.html)
and [priority definition](https://amigadev.elowar.com/read/ADCD_2.1/Hardware_Manual_guide/node007B.html)
inform the synthetic transparency/priority fixtures; captures remain separate.

## Interlace without hidden history

ILBM CAMG LACE (`$4`) is supported for normal, hires, EHB and HAM6 images. The reader
returns field zero by default; `readIlbm(bytes, { field: 1 })` selects the other
field. It decodes the complete picture into owned chip storage, then publishes
only the chosen field's pointers, using doubled row stride. Source image metadata
retains full dimensions. Field selection on an unlaced image rejects.

ABI v1 dimensions now handle odd heights too:
`lines = ceil((outputHeight-interlaceField)/2)`. Without interlace, lines equals
outputHeight. A one-row image has an empty field one; its tables and rendered
RGBA contain zero rows. This corrects the earlier even-only validation without
changing the wire layout or any previously valid fixture. It prevents padding
or doubling a final image row merely to fit the codec.

[composeField.js](../lib/display/presentation/composeField.js) exports
`composeField(frame, rgba, previous = null, mode = 'weave')`. It takes exact
current-field bytes and explicit previous full output, validates dimensions and
returns an owned Uint8ClampedArray. Weave updates rows `2*y+parity`; absent history
is opaque black. Line-double repeats current-field rows and clamps an odd final
row. An empty field preserves supplied history. Neither mode changes a renderer,
snapshot or input buffer, runs a clock, or retains any global history.

Independent even/odd-height, hires and EHB IFF/PNG fixtures verify both field
arrival orders. Other tests check serializer round trips, missing history,
line doubling, empty fields, VM arrays and malformed dimensions. Empty fields
have no zero-height PNG; they are checked through full-output composition.
This establishes image/field semantics, not live PAL/NTSC field pacing, Copper
LACE arbitration, a browser interlace host or automatic AMOS screen updates.
