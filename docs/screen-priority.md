# Bounded screen priority and Roller II ready prompt

`Screen To Front` (original offset `0x0a72`) and its numbered form (`0x0a88`)
move the selected/explicit open screen to the front without selecting it or
changing visibility. Each program owns its priority list. Once used, all visible
screens participate, including implicit default windows. Selecting a logical
screen does not reorder them. Open/clone inserts at the front; close removes it.
Auto View Off stages order, visibility and geometry until View; retained screen
objects/buffers continue presenting across replacement or closure until commit.
Ordinary explicitly positioned windows also use this order when they overlap;
no explicit Screen To Front is required. Logical Screen selection never raises
a window. Nonoverlapping windows retain their existing presentation contract.

The physical bridge chooses the foremost screen for each vertical interval and
coalesces adjacent intervals with the same owner. It emits planar slices using
full physical bitmap stride and adjusted source pointers. There is no RGBA overlay
or CPU fallback. CPU and WebGL consume the same interpreted copper snapshot.

Pinned native source `AMOS-Professional-Official` revision
`7f32e0abe1b6b415c9502b598cd3e4cb131018f8`, `src/w/screens.cpp` EcFirst,
`src/w/copperlist.cpp` cut/slices/screen_start and
`src/lib/screens.cpp` screen_to_front establish ordering, horizontal slices and
DMA-disabled setup rows. A foreground start consumes its preceding physical row;
resuming an underlying screen consumes its first resumed row. Source pointer
advancement includes those omitted rows. Roller II's windows are screen 0 at
Y=50, height 250 and screen 1 at Y=140, height 32: row 139 is blank, rows 140–171
show the prompt, row 172 is blank and background resumes at row 173/source 123.
Hiding the prompt restores the uninterrupted background.

The portable scheduler writes all changed palette/control words and plane pointers
on the DMA-disabled blank row, then enables bitplane DMA before the following
row's fetch. The complete update must fit 227 clocks; ordinary rows keep their
existing strict pre-fetch deadline and PAL wrap handling. This is a bounded safe
schedule, not native instruction/bus timing: native AMOS divides palette writes
between the setup row and following row. With no fetched bitplanes, sprite DMA or armed sprite rows,
invisible nonzero palette/window/control writes do not produce pixel events.
COLOR00 and sprite events remain observable. The blank rows are real output, not
invented extra gaps or a relaxed visible-row budget.

The portable copper keeps each owner's full display-window bounds in DIW and uses
DMA disable/enable for the cuts. Slice coordinates schedule the transitions
rather than becoming new 8-bit DIW starts. This permits short slices before row 128 and background resumes
after row 255 without wrapping the source row or inventing ECS registers.

Direct AMOS sprites can cross setup rows when changed sprite colours (16–31)
finish before the row snapshot. The builder orders those colours immediately after
DMA disable, ahead of invisible playfield setup, and records which rows meet that
strict deadline. The bridge checks active sprite rows after the structured sprite
writer runs. A transition that misses that deadline still rejects; no mid-line
palette effects are discarded or silently composited.

Current bounds: equal-width lowres windows at X=128, whole-word horizontal offsets,
shared COLOR00, no HAM, at most eight resulting slices, and the existing OCS
geometry/palette budget limits. Vertical offsets and full bitmap ownership remain
intact. Unequal-width overlays, arbitrary placement,
unrepresentable slices, larger sprite/palette transitions, wrapped DMA and native
capture parity remain open and reject explicitly. SnapshotPlayfield still exports
the complete physical bitmap without priority cropping.

The ready-only unit fixture extends the connected startup/menu
fixture with unchanged GAMEDISP 72–86, MWAIT 153–155 and game entry 565–608.
The harness selects Game then releases the input; original 601–607 handles the
foreground icon, board rendering, blinking and mouse/Fire(1) exit. Original 608
reads start (5,9), colour 1 and time 35 from level 1. A synthetic Wait Key guard
follows 608 before BALLFARBEN/sprite/fade/gameplay setup. No variables or IP are
edited. The earlier menu demo deliberately retains its post-600 guard.

`tools/reference/roller2_ready.py` independently decodes raw icon 79 and composes
its mask/palette at (105,5) over the independently generated portable status panel.
The board's original black palette remains black; no preview palette restoration
is injected in the connected fixture. The isolated coloured board inspector has
its own documented palette harness. Source-derived PNGs are not Amiga captures.
Unit checks also compare original board indices with the independent map hash,
verify source metadata, independent factories and Stop/Resume. The extended [ready/ball demo](roller2-ball.md) now checks
three original input exits, eighteen Canvas frames and six actual WebGL frames with
CPU presentation disabled. The live demo provides keyboard/Gamepad/mouse input,
Stop/Resume, Restart and fullscreen. It advances an injected VBL clock from host
timers, independently of requestAnimationFrame; MOD timing runs without a browser
audio adapter in this demo. The menu demo retains its optional sound controls.

The live demo now also runs BALLFARBEN, six-plane sprites’ low-four-plane hardware
behavior and initial fade/status border through 617. See [initial ball](roller2-ball.md).
This display fixture remains bounded. Whole-source compilation now passes; see [current milestone](roller2.md).

## Connected Roller II editor

The complete current game now follows its original menu click into lines 324–337
and the editor input loop. Screen 0 occupies Y=42–297; the foreground panel occupies
Y=240–295. Row 239 is a setup row, row 296 restores the background, and row 297
fetches original background row 255. Both right-edge hardware sprites remain
structured sprite rows. Source code and asset bytes are unchanged by this display
extension.

The shared `roller2EditorReplay.js` uses only input: title selection, opening fade,
editor entry, placement of tile 3 at cell (2,2), panel selection, testing the
edited level and returning through the original key prompt/panel animation.
Ten Canvas and ten real GPU frames run in the full-game gallery demo, including
the fade and the two windows. Synthetic row/colour oracles separately verify the
cuts, source offsets, resumed pointers, sprites, staged visibility and priority.
These are source-derived expectations and CPU/GPU parity, not Amiga captures.
Saving/loading and wider editor actions remain unaccepted. See
[field-edge clipping](screen-windows.md#field-edge-clipping-and-parked-panels) for
the off-field panel animation and late DMA start rules.
