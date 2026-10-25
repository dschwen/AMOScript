# Cline and the first Roller II level load

Bare `Cline` (`$158a`) clears the selected screen's complete current text row in
paper colour, preserving the cursor, pen/ink/paper, palettes, graphics coordinates
and buffer identities. The supported text model uses full 8×8 cells; partial
right/bottom strips are outside its text window. Hidden selected screens retain
their own row and paper state.

The existing drawing path owns the operation. Autoback 0 affects the logical
buffer; modes 1/2 include physical output. Mode 2 synchronizes Bob background
restore/capture/redraw. Normal Bob update/swap cycles preserve their existing
ownership and restoration behavior. Cline does not commit View or print a newline.

Native evidence is `lib_in_cline0` in `src/lib/windows.cpp` and `clear_line` in
`src/w/windows.cpp`, pinned at `7f32e0abe1b6b415c9502b598cd3e4cb131018f8`. The native
command sends control 26; this subset implements its direct statement effect.
General literal control streams, alternate fonts/windows, writing masks/styles
and counted `Cline n` (`$1596`) remain open. The counted token still rejects.

## Original game path

The connected [Roller II demo](../demos/roller2-menu.html) now continues game
selection through unchanged entry/setup 565–600. Original code copies icons,
initializes game variables, creates hidden screen 1 (320×32), opens screen 0
(320×250), builds the 64-entry rainbow and writes status text. It checks the
level path, loads `RII:levl/1` into bank 10 and executes the three original
Locate/Wait Vbl/Cline/Print refreshes.

The guard follows 600. Screen To Front/overlapping-window presentation at
601–602, GAMEDISP board drawing, the ready prompt, sprite/ball setup and gameplay
remain open. This is a first-level load, not a playable level. Source TM is still
zero: its original Deek assignment occurs later at 608. No host patch changes it.
The original missing-file branch reaches a declared win guard without loading
or changing the work bank; the actual win/music routine remains excluded.

## Evidence

Four new headless groups cover original bytes, row/paper/cursor semantics,
partial edges, Autoback modes, double-buffered Bob backgrounds, hidden selection,
procedure calls and source-context failures. Two connected groups check exact
level bytes, variables/screens, print values, pixels and the missing-level branch.

`panel-glyphs.json` independently records public-domain
[font8x8 rows](https://raw.githubusercontent.com/dhepper/font8x8/master/font8x8_basic.h)
and their upstream hash. These describe the portable font, not AMOS Topaz.
`tools/reference/roller2_game_panel.py` imports no runtime font or renderer. It
combines literal status strings, those glyphs and original rainbow formulas into
an indexed bitmap and PNG. Numeric text follows the current bounded Print subset;
these are not native typography/formatting captures.

All four browser game-selection cases check level 1's exact 490-byte payload,
initial variables and hidden secondary screen. The panel replaces the earlier
black guard image in the three-frame connected GPU sequence. Canvas matches the
independent PNG; actual WebGL matches CPU with CPU presentation disabled. No new
GPU frames are counted for replacing that check. The injected menu clock reaches
2840 ms, then checks game load 1300 ms later (field 207). Non-game cases retain
their 640 ms check. These are controlled clocks, not native timing or captures.
