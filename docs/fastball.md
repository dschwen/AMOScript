# Fastball compilation and bitmap font selection

All **eight editable AMOS-header programs** under `fastball/elms` now compile
without modifying source or assets. Three were previously blocked: current
`Fastballintro.AMOS`, older `FastballEditor.Bak`, and current
`Fastballhigh.AMOS`. Their unmodified bytes and hashes are pinned under
[examples/Fastball](../examples/Fastball/README.md) for compiler regression tests.
The five previously compiling files retain their existing compilation paths.

The two `_C.AMOS` files contain Europress AMOS Compiler wrappers and native 68000
procedure data. They are already compiled Amiga programs, not editable tokenized
source for this transpiler. Use their supplied editable counterparts. They remain
unsupported; binary/source bounds checks have not been relaxed to accept them.

## Uncached AMOS 1.3 operands

The old files retain base token words where newer verified files cache a numbered
or colour overload. The parser now resolves only these bounded families:

| Base word | Supported operand form |
| --- | --- |
| Cls | One colour, or colour,x1,y1 To x2,y2 |
| Screen Hide / Screen Show | One screen number |
| Logic / Physic | One parenthesized screen selector |

Bare forms remain available. Explicit cached variants retain their exact arities.
Dispatch metadata lives in DisplayTable, parsing creates ordinary pure ASTs, and
typing/lowering/runtime validation stays on the existing operations. Expressions
are parsed once, without parser execution or emission. Logic/Physic still encode
selectors; Screen Copy validates them when consumed, as in the existing contract.
No clipping, screen visibility/selection, buffer ownership or copy behavior changes.

The pinned native [Lib.s token signatures and handlers](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BLib.s)
include InCls0/1/5, InScreenShow0/1, InScreenHide0/1 and FnLogic0/1/FnPhysic0/1.
The newly accepted forms normalize to those existing signatures, not arbitrary
variadic argument acceptance.

## Get Disc Fonts and Set Font

The compiler now recognizes **Get Disc Fonts** (`$0f8a`, no operands) and
**Set Font** (`$0fb2`, one numeric operand). The former snapshots a preloaded host
catalogue; the latter selects a one-based entry for the selected screen's graphics
Text writer. **Set Font 0** restores that screen's default graphics font without
requiring enumeration. Opening/replacing a screen starts with its default font.
Selection is per screen and factory. Print/Writing retain the default window font.

Native `InGetDiscFonts` selects AvailFonts disk entries through TGFonts. TSFont
indexes that catalogue, opens the font and sets the screen RastPort; CFont restores
the default. See [W.s TGFonts, TGFont, TSFont and CFont](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BW.s).
The portable implementation supplies an explicit host inventory instead of asking
a browser/Node process to enumerate an Amiga operating system's fonts.

Standalone generated factories accept this normalized format:

```js
const program = create({
  displayOptions: {
    diskFonts: [{
      name: 'My preloaded font',
      width: 8,
      height: 9,
      baseline: 7,
      data: glyphBytes // Uint8Array: 256 glyphs, nine rows per glyph
    }]
  }
});
```

Each glyph has `height` consecutive rows of `ceil(width/8)` bytes, MSB first.
The catalogue preserves supplied order. Widths 1–16, heights 1–32 and baselines
0..height-1 are supported; data length must match exactly. At most 128 records are
accepted. Enumeration validates the whole list and takes owned copies before
replacing the inventory. Sparse arrays, malformed bitmaps and asynchronous values
reject. Selected atlases survive later caller mutations and list refreshes until
another Set Font. Invalid selection/catalogue validation preserves existing state.
That checked failure behavior is portable; native failure-time font closing is
not claimed as an exact match.

Graphics Text uses the selected width, height and baseline, ordinary indexed
foreground/background colours, clipping, and existing Gr Writing transparent or
opaque mode. Host strings containing code points beyond byte range use glyph `?`.
No canvas font API, RGBA text overlay, drawing fallback or external asynchronous
font load is used. Bitmaps remain authoritative for chip-memory/WebGL output.
An empty host catalogue is valid, but Set Font 1 then fails explicitly. Get Fonts,
Get Rom Fonts, Font$, proportional/styled/native font decoding and OS font discovery
are outside this subset.

## Runtime assets still needed

`Fastballhigh.AMOS` begins with Get Disc Fonts / Set Font 1. Its supplied
`Fastballfont.font` contains a descriptor for **Fastballfont/9**, but the glyph
file is absent. The program now compiles; running it with no preloaded font
correctly reports a missing font at source line 2. Tests may run the unchanged
program with an explicitly prepared test atlas, which is not original-font parity.
The page builder does not automatically parse Amiga disk-font descriptors or create
glyphs from them.

Both intro sources encounter the existing strict IFF error in FastballRay3.iff:
one zero byte remains inside its declared BODY payload after all rows decode.
This is a separate runtime/asset investigation. No padding workaround or asset
rewrite is included in the compilation fix. Main Fastball gameplay source was not
found in the supplied directory.

## Verification

Compiler regressions pin all three newly compiling sources. Synthetic cases check
uncached clears, rectangle separators, Hide/Show selection, Logic/Physic buffer
copy ownership, bare forms, malformed arguments and cached arity rejection.
Font tests verify independent glyph coordinates, owned arrays, missing/malformed
catalogues, selection/reset/replacement, unchanged Print and clipping/draw modes.

The [disk-font browser demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/disk-fonts.html)
checks 192,000 literal expected pixels across transparent, opaque and default-font
frames, with three real GPU/reference comparisons. Its 10×9 atlas is declared test
data, not Fastball's missing font or a native capture. All browser checks have
self-contained gallery pages. Rebuild with `npm run build:demo`, then verify with
`npm run check` and `npm run test:browser`.
