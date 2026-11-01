# Native menus

All nine menu tutorials compile and have pages in the Tutorial catalogue.
They use indexed screen drawing through the ordinary Canvas/WebGL snapshots.
The browser harness captures right mouse input without opening its context menu.
Hold right mouse, point to a title and option, then release to select.

## Data ownership and serialization

`lib/amos/menuBank.js` reads and writes the native 70-byte menu records and
bank-relative links. The supplied `Tutorials/Menus/Data.Menu` has five roots
and 106 items. Each item retains its number, flags, relative position, shortcut,
six captured inks and four drawing objects: frame, normal, selected, inactive.
Native scratch fields and live pointers are not restored into a JavaScript VM.
In particular, native saves retain stale `MnPrev` addresses; Bank To Menu
rebuilds those links. The codec ignores them on input and writes zero on output.

The reader owns its bytes and checks pointer ranges, alignment, object lengths,
terminators, tree depth, repeated nodes and duplicate sibling numbers. The
writer caps banks at 1 MiB and individual objects at a word-sized length. Text
uses byte strings, big-endian lengths and even padding. Procedure records store
names, never JavaScript function references or native executable addresses.

`test/menu-bank.test.js` checks the original asset, malformed graphs and semantic
save/reload. `test/menu-graphics.test.js` additionally checks independently written
expected bytes for a mixed text/procedure/line object.

## Graphical commands and procedure boundaries

`lib/amos/menuGraphics.js` decodes the menu object's two-letter graphical
language. The supported bounded commands include text, Bar, Line, Ellipse,
Pattern, Ink, Bob/Icon, Locate, Outline, Set Line, Set Font, Proc, Reserve and
text style. Longer spellings retain the meaning of their first two letters.
Numeric operands retain signed-word storage; unsupported fonts/images require
an explicit adapter rather than a substitute asset.

Measurement suppresses drawing and reserves per-item data. Drawing does not
reserve it again. Both paths track the native cursor and maximum extents;
Line and Bar advance beyond their inclusive endpoint. Proc suspends the stream
and returns a name and continuation index. A future driver binding must invoke
the ordinary AMOS procedure, read returned D0/D1, and resume that continuation
without replaying earlier commands or evaluating a Promise as an expression.

## Relative layout

`lib/amos/menuLayout.js` implements the measurement and placement boundaries
separately. Calculation yields procedure requests when needed and leaves the
decoded bank unchanged. Placement uses the calculated records and preserves
each sibling's offset relative to its predecessor. Vertical and horizontal
branches share this rule. Separate items add two pixels in each direction and
start another framed group. Automatic outer borders add two pixels; full-width
title groups retain explicit metadata for the eventual screen binding.

Tests check the native asset's title widths, both colour-grid columns, hit-test
edges and graphical procedure continuation. They also reject cyclic trees,
missing measurement records and geometry outside the bounded signed-word
subset. These are source-derived portable checks, not Amiga display captures.

## Compiler and driver integration

`Menu$` retains up to four independently evaluated drawing strings and an
eight-level numeric path. Menu Base/Set Menu, group and item styles, shortcuts,
Called/Once, deletion, explicit calculation and enable/disable commands update
the per-factory tree. A bare style depth affects subsequently created items;
a parenthesized path affects an existing item. Menu To Bank writes a real Menu
bank; Bank To Menu owns its tree independently of subsequent bank erasure.

`lib/amos/menus.js` measures and draws on the menu's original screen, preserving
the caller's graphics state and restoring the captured background on close.
The current subset requires a single-buffered indexed screen. Basic execution
is modal while the mouse menu is open. AMAL/audio/palette engines retain their
existing driver scheduling; combining live moving objects with menu backgrounds
is not covered by these tutorials.

The driver owns a VBL wake, including while Basic waits for a key or sleep.
On Menu Goto/Gosub/Proc targets are checked at compilation; registration is
currently limited to main scope. A successful dispatch disables further
handlers until On Menu On. Procedure and Gosub handlers use ordinary VM stacks
and retain the interrupted instruction and wait deadline. Bare Choice drains
the signed selection latch; Choice(1..8) retains path components. Shortcuts
consume matching text without changing Scancode or physical held keys.

Graphical Proc commands yield ordinary zero-argument procedure calls. D0/D1
carry coordinates and returned dimensions; D2/D3/D4 carry measurement,
selection and initial-draw flags. A1 exposes checked reserved per-item bytes;
A0 native menu-record pointers are not exposed. Non-default graphical menu
fonts remain gated. Called procedures redraw on VBL boundaries. Stop cancels
owned wakes and pending selection, and Resume closes released mouse menus.
Screen retirement and terminal cleanup invalidate owned work.

`test/menus.test.js` opens/closes all nine sources, selects original colour and
style options, runs shortcuts and handlers, toggles original inactive/movable
options, animates the graphical procedure, saves/reloads a native Menu bank and
checks waiting, input and lifecycle ownership. The browser checks exercise the
same repository pages. File requesters, every drawing-tool option, moving-object
background composition and native pixel/timing captures remain unverified.

## Menus_6 source correction

The supplied line179 lists `On Choice(2) Gosub 1,2,3,4,5,6,7`, but the source
defines only six options and labels1–6. The compiler continues to reject the
unresolved seventh target in `test/fixtures/tutorial/menus6-original.amos`.
The demo source removes that unused target and adds an empty Rem comment in
the same eight bytes, preserving its header, line table, cached offsets,
procedure lengths and total file size. No compiler validation is relaxed.

Original SHA-256: `17987b0a13c3351b1e2199edfccdaa43d1a797b156d4e024bc07242225f012bd`.
Corrected SHA-256: `455be1772dc073fd67708235d821e50bcef49eb17b851a5ec8be87e4cce1ebf6`.
The source-correction notice is included on the generated page and manifest.

Source references are `MnLong` and menu flags in `+Equ.s`, `MnTb`, `MnTMn`,
`MnCa0`, `MnDraw`, `MnMaxi`, `MnObjet` and `ObJumps` in `+Lib.s`, and `MnOob`,
`MnDim` and `MenuProcedure` in `+ILib.s`, from the
[official AMOS Professional source](https://github.com/AOZ-Studio/AMOS-Professional-Official/tree/533b4b1f5acd604814513f78e02c7b4796cb0531).
