# Writing text modes

`Writing mode` (`$1408`) and `Writing mode,parts` (`$1418`) now control the
selected screen's existing 8×8 window text writer. Numeric expressions use the
ordinary checked integer conversion and evaluate once, left to right. Modes are
0 Replace, 1 OR, 2 XOR, 3 AND and 4 Ignore; parts are 0 Both, 1 Paper and 2 Pen.
Omitting parts selects Both. Invalid selectors fail with source context before
changing state or touching pixels/Bob backgrounds.

For each glyph pixel, Both selects Pen inside the glyph and Paper outside it.
Paper selects zero inside and Paper outside; Pen selects Pen inside and zero
outside. Replace writes that value; OR/XOR/AND combine it with the previous
indexed colour within the screen's planes. Pen-only Replace therefore writes a
zero background even when Paper is nonzero. Ignore suppresses glyph writes but
still advances the text cursor, handles controls, wraps and scrolls. Scrolling
can still fill rows with Paper. Existing host Print/write callbacks continue to
record output intent independently of the raster mode.

The source uses a shared combine/parts pair with a per-window activation flag.
Within the supported single default window per screen, `Writing 0,0` clears that
screen's flag and restores its ordinary Pen/Paper path. Other forms activate it.
Already-active screens use the latest shared pair; inactive screens retain normal
printing. Opening a screen resets the shared pair to 0,0 without clearing older
screens' flags. Pen/Paper changes preserve activation. Separate program factories
own separate state. General multiple-window controls remain unsupported.

Print and Centre use the window writer. Graphics Text, Draw/Box, Set Line and
Cline keep their separate semantics; graphics `Gr Writing` remains unsupported.
Existing Autoback and Bob hooks restore/replay text against each buffer's own
pixels, retain buffer/background ownership and advance the cursor only once.
CPU and GPU consume the same physical snapshot, with no text-specific overlay.

Source evidence is pinned to AMOS-Professional-Official revision
`efddf2c9a09bf61a45b7b096a9be84630853c2b1`: `src/lib/windows.cpp`
`lib_in_writing1`/`lib_in_writing2`, and `src/w/windows.cpp` `writing`, `draw`,
`out` and default window initialization. The executable source defines modes
0–4; the bundled help describes them as 1–5. The implementation follows the
executable source and Roller II's original `Writing 0,2` statement. This is source
analysis, not an Amiga execution capture. Alternate fonts, shade/underline/plane
masks, general text windows and exact native timing remain open.

The [browser demo](../demos/roller2-writing.html) executes unchanged Roller II
333–334 on a declared blank 320×200 screen with the original icon palette and
prepared LV=1/TM=300. An extra Screen 1 selects the preview after original 334
returns to Screen 0. The synthetic third stage sets Paper 7/Pen 5 and prints A
to prove the zero background. A separate matrix runs all fifteen mode/parts
combinations on six-plane background 36 with Pen 21/Paper 10. Neither fixture
runs the editor panel/loop or saves files.

`tools/reference/roller2_writing.py` builds four independent PNGs and full
indexed/RGBA hashes using explicit per-plane combination, the pinned portable
font glyphs and the independently decoded raw icon palette. Seven headless
groups cover all combinations, shared/reset state, typed expressions and arities,
atomic failures, Ignore/control/scroll behavior, buffer/Bob ownership and original
statement/hash parity. The shared browser scenario checks four Canvas images
and four actual GPU frames with CPU presentation disabled during GPU rendering.
Live controls provide text stages, matrix, fullscreen and Restart. Every browser
scenario has a self-contained demo and HTML Preview link in the gallery.

Whole-source compilation now stops at Scin `$16b6`, original line 342,
byte 17552. Nine of 194 token encodings remain unrecognized; full editor/gameplay
and native reference capture remain separate acceptance gates.
