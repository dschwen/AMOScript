# Double buffering and Autoback

`Double Buffer` copies the selected screen into a second buffer and enables
Autoback 2. Repeating the command on that screen is an error. A single-buffered
screen has one pixel array shared by drawing and presentation; a double-buffered
screen has two independent arrays:

- `screen.pixels` is the logical drawing buffer. Point reads it.
- `screen.physicalPixels` is the presented buffer. RGBA conversion and Canvas
  read it. A palette is shared by both buffers.

`Screen Swap number` exchanges the buffers of one open screen. `Screen Swap`
exchanges all open double-buffered screens, leaving single-buffered screens
unchanged. The old physical buffer becomes the next logical drawing buffer.
It is not erased, so it can still contain a previous frame.

## Drawing modes

`Autoback 0` draws graphics and text only into the logical buffer. Drawing remains
invisible until a swap. This is the manual mode for Bob Clear/Draw and custom
frame construction.

`Autoback 1` repeats supported graphics and text operations in both buffers.
Text and graphics cursors advance once, and output hosts receive Print once.
Saved Bob backgrounds are not adjusted: drawing over a visible Bob can be lost
when that background is restored on a later update.

`Autoback 2` first removes Bobs from both buffers, applies the drawing operation
to both backgrounds, then saves the changed areas and redraws Bobs. Background
changes beneath Bobs therefore survive movement. The same rules apply to static
Bob/Icon pasting and the supported drawing/text commands. Palette and pen/cursor
state changes are shared screen state and do not need duplicated pixels.

Modes belong to each screen. Only 0, 1 and 2 are accepted. Host writes directly
into pixel arrays bypass Autoback; use the drawing API or explicit Bob Clear/Draw
when modifying backgrounds.

## Bob frames

Each saved Bob background records the actual buffer, selected planes and
background mode it belongs to. An update restores and redraws only the current
logical buffer on each owning screen.
Snapshots for the other buffer remain until it becomes logical again.

`Bob Update` then swaps all double-buffered screens. `Bob Draw` draws on the
current logical screen without swapping; `Bob Clear` restores that logical
screen's saved backgrounds. After removing Bobs, two updates can be needed to
clear both stored buffers, even though the first update already presents a
clean frame. This prevents old pixels reappearing on subsequent swaps.

Screen reopen/close discards both buffers and their Bob snapshots. Enabling
double buffering after Bobs have been drawn preserves their clean backgrounds
in both copies. Program instances have independent buffers and snapshots.

## Timing and limits

Buffer exchanges happen synchronously in the runtime. Canvas presentation is
coalesced through animation frames; exact Amiga copper/VBL scheduling and the
original suppression of duplicate swaps before a VBL are not implemented.
Use Wait Vbl between frames. Automatic Bob updates still occur at cooperative
execution boundaries as described in [the Bob contract](bobs.md).

Autoback synchronization currently applies to the selected screen. Original
multi-screen interrupt side effects need further reference execution coverage.
Screen-copy/scrolling commands, Logic/Physic screen selectors, hardware sprites,
and the remaining screen modes are separate unfinished features.

## Evidence and checks

The [updating manual](https://amospromanual.dev/07-03-updating-objects.html) defines
the three drawing modes and Bob update/swap distinction. Original
[+W.s](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BW.s)
`EcDouble`, `ScSwap`, `ScSwapS` and `TAbk1`–`TAbk4`, together with
[+Lib.s](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BLib.s)
command handlers, inform the implementation. The current contracts are derived
from sources/manuals, not captured emulator results.

Unit tests compare logical and physical pixels, alternating backgrounds,
Autoback differences, cursor/output behavior, static-image visibility, screen
selection and malformed commands. The synthetic Bobs.AMOS demo draws Bobs
off-screen first: press a key to swap them into view, again to animate, and once
more to remove them. Real Chromium checks that hidden drawing stays invisible,
then verifies presented pixels, movement and background restoration.
