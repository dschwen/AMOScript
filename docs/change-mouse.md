# Change Mouse built-in pointers

`Change Mouse shape` (`$1e02`) now records a built-in pointer choice per program:
1 arrow, 2 crosshairs and 3 clock. Ordinary numeric conversion accepts typed
scalars, arrays, DATA and procedure/boxed results; the expression evaluates once.
Unsupported values fail with source context before changing the shape, display
revision or visibility. Sprite-bank shapes 4+, wrapped selector aliases and
configured mouse-bank artwork remain unsupported.

Shape and visibility are separate. Changing shape never resets the signed-word
Hide/Show nesting count. A shape selected while hidden appears when that nesting
permits Show, including Show On. Pointer shape does not move the mouse, consume
clicks/keys, select a screen, change text/graphics cursors or write bitmap/bank
pixels. It works without an open screen. Stop/Resume and End retain the choice
while the browser host remains attached; detach restores the owning page's cursor.
The pure runtime exposes `changeMouse(shape)` and `mouseShape()` for host use.
Before any explicit Change Mouse, `mouseShape()` returns null so the host keeps
its existing cursor, preserving the established browser ownership contract.

The shared Canvas/WebGL host maps explicit 1/2/3 to CSS `default`, `crosshair`
and `wait`; hidden always maps to `none`. Native CSS cursor pixels, size, hotspot
and animation depend on the browser/OS. This is a portable shape mapping rather
than emulation of configured Amiga mouse artwork or sprite DMA. Each host saves
its own original inline cursor on attach and restores it on detach/replacement.
A new program with no explicit shape inherits that owner's cursor. Detached
programs cannot change the active program's cursor. Renderer switching, fullscreen
and Restart retain the existing stable-container and input ownership behavior.

Source evidence is pinned to AMOS-Professional-Official revision
`efddf2c9a09bf61a45b7b096a9be84630853c2b1`: `src/lib/sprites.cpp`
`lib_in_change_mouse` subtracts one after checking the lower bound;
`src/w/mouse.cpp` `change` selects three mouse-bank images and preserves MouShow.
The original help identifies arrow/crosshairs/clock. Native larger selectors can
use suitable 16-pixel/two-plane object images or fall back to the first mouse
image; this subset rejects them explicitly. These are source-derived semantics,
not native pointer captures.

The [browser demo](../demos/roller2-pointer.html) runs seven unchanged Change Mouse
lines from Roller II: 439, 453, 457, 466, 489, 503 and 550, selecting
2/1/2/1/2/3/1. A prepared coloured hover surface/text and synthetic Wait Key gates
make the shapes inspectable. Original editor setup, ball placement, flood-fill,
overwrite handling, board analysis and persistence are excluded.

Four headless groups cover original token/numeric typing, atomic rejection,
visibility/input/pixel invariants, independent factories, screen-free operation,
host Stop/Resume and every original statement gate. The shared browser scenario
checks thirty inline/computed cursor states across Canvas/WebGL hosts, including
hidden changes, nested Show, Stop/Resume, replacement and stale program isolation.
Seven GPU frames compare the unchanged prepared surface with the CPU snapshot,
with CPU presentation disabled during GPU rendering. They are renderer regression
checks, not evidence of cursor raster fidelity. The offline live demo checks
fullscreen, hidden shape changes, wait/arrow/crosshair styles and Restart. Every
browser scenario has a runnable page and an HTML Preview gallery link.

Whole-source compilation now stops at Get Icon `$1cc6`, original line 480,
byte 26044. Seven of 194 encodings remain unrecognized; full editor/gameplay,
AMOS Music end tunes and native reference captures remain separate milestones.
