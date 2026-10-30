# Packed screen banks and Unpack To

Slot-2 compactor token `$0056`, `Unpack bank To screen`, now creates/replaces and
selects a screen from a full AMOS packed screen bank. Generated modules embed the
pure reader in `lib/amos/packedPicture.js`; no browser/image decoder is required.
The initial target is Planet Zybex's seven original `Pac.Pic.` banks.

## Checked format and execution

The reader owns its input and recognizes SCCode `$12031990`, a 90-byte screen
header, then BMCode `$06071963` and its 24-byte bitmap header. It validates the
screen/bitmap dimensions, depth, control word, all 32 palette words, packed-square
geometry and separate byte, pointer-bit and flag-byte stream ranges before any
screen is replaced. Input is capped at 16 MiB; logical screen dimensions retain
the existing 1024×1023 limits.

The pointer bits select whether to retain or replace a flag byte. Flag bits then
select whether to retain or replace the literal output byte. Output order is
plane, square band, byte column, row within square. The initial seed/control
reads and final control lookahead follow the original decoder; each stream read
is bounded independently. Unused native padding is not rendered.

This subset requires a full bitmap with zero packed x/y origin, dimensions equal
to the screen header, ordinary nonlaced lowres/hires modes and a matching colour
count. HAM, dual playfield, lacing and partial packed rectangles reject. Screen
metadata retains raw x and requested width/height independently of bitmap
payload bounds. Applying a new screen separately checks supported horizontal
placement, width 128–320 hardware units, signed nonwrapping Y and the complete
active bitmap range. Optional COLOR $0200 is retained as control metadata. More screen modes and
native word-wrap behavior remain gated.

Runtime Unpack resolves a reserved generic bank number, validates and decodes it
completely, then calls the normal screen replacement/window/offset APIs and
copies owned indexed pixels/palette. It hides the text cursor. Existing clone
retirement checks and Auto View/View staging remain intact. It does not modify,
replace or retire the packed bank or its Start address. Bank bytes may be changed
explicitly, but every later Unpack decodes/validates them again.

The **To-screen** native extension creates a new screen and calls UnPack_Screen;
it does not use the current-screen UPack Autoback path. Old Bob owners are retired
through ordinary screen replacement; no synthetic paste or Bob replay is used.
The one-argument current-screen form now copies into a checked matching-depth
bitmap through ordinary Autoback, retaining its palette and viewport. Positioned
overloads and raw-address selectors remain unsupported. Pack/Spack encoding is not implemented by this decoder slice.

See [GALAX headers and horizontal placement](horizontal-placement.md) for five
additional banks, independent vectors and complete original startup/menu checks.

## Evidence

`test/fixtures/packed-picture.json` records the full indexed hashes/palettes and
35 independent 320×160 window hashes. `tools/reference/packed-picture.py` uses a
separate two-stage expansion algorithm and explicit square-to-plane remapping.
Seven unchanged banks and the source are pinned by the asset manifest. Unit tests
cover explicit byte patterns, flag changes, geometry/mode errors, truncated stream
reads, exact extension grammar, unsupported overloads, replacement atomicity,
clone checks and retained bank identities. The Planet Zybex browser preview uses
WebGL2 with an explicit Canvas fallback; only actual GPU execution is counted in
its 35 GPU comparisons.

Source inspection used verified upstream revision
`533b4b1f5acd604814513f78e02c7b4796cb0531`:

- [extensions/+Compact.s](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/extensions/%2BCompact.s): InUnpack2, UPack and canonical compactor streams;
  SHA-256 `bb3a793e03a1253382e9c73171e4483fbea03e270859f9e9249c494164782504`.
- [+Lib.s](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BLib.s): UnPack_Screen/UnPack_Bitmap;
  SHA-256 `3422384075ddfd5783c8e9b5d31608896d9e86eda5fad808b13e64313682ba55`.
- [+Equ.s](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BEqu.s): screen/bitmap offsets and signatures;
  SHA-256 `96be293512c3d13fbade43da4c334768cba56b69eb4f5fc3a5fdba155653f193`.

The [screen compaction manual](https://amospromanual.dev/06-02-using-screens.html#unpack)
describes the overloads and screen-replacing form. These are source-derived and
independent decoder/browser checks, not an Amiga capture or playable-game result.
