# Native menus: data and layout groundwork

The Tutorial collection's nine menu programs are still compilation blockers.
The modules described here prepare their native data and geometry; they do not
yet provide `Menu$`, browser selection, `Choice`, or `On Menu` execution.

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

## Next integration

Connect these helpers to AST/lowering and a driver-owned menu service. That
service needs indexed-screen drawing and background restoration, modal mouse
selection, keyboard shortcuts, movable groups, destructive bare `Choice` and
nondestructive `Choice(n)`. `On Menu` handlers and graphical procedures must
use ordinary VM stacks and preserve pending waits. Stop/Resume, screen
retirement and browser input cleanup need coverage before these nine programs
are marked playable in the catalogue.

Source references are `MnLong` and menu flags in `+Equ.s`, `MnTb`, `MnTMn`,
`MnCa0`, `MnDraw`, `MnMaxi`, `MnObjet` and `ObJumps` in `+Lib.s`, and `MnOob`,
`MnDim` and `MenuProcedure` in `+ILib.s`, from the
[official AMOS Professional source](https://github.com/AOZ-Studio/AMOS-Professional-Official/tree/533b4b1f5acd604814513f78e02c7b4796cb0531).
