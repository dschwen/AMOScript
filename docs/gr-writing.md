# Graphics writing

`Gr Writing mode` (`$1066`) accepts numeric expressions through the ordinary
signature lowering and stores a mode on the selected screen. This profile supports:

| Mode | Graphics Text zero bits / line-pattern holes | Set bits |
| --- | --- | --- |
| 0 (JAM1) | Preserve existing pixels | Ink foreground |
| 1 (JAM2) | Ink background | Ink foreground |

An explicit Ink background updates the graphics background; its initial value is
the screen's initial Paper (1, or 0 for two-colour screens). Later Paper changes
only affect the window text writer. Modes are per-screen; opening/replacing a
screen or Default resets them. Until an explicit Gr Writing, existing factories
retain their legacy transparent Text and opaque line-pattern defaults. This
compatibility boundary is not a claim that the native startup mode is unset:
native screen initialization selects JAM2.

Negative, complement, inverse and combined modes reject before changing mode or
pixels, with ordinary source locations. Expressions are evaluated once. The
setter does not draw, invoke Bob hooks or change cursor/line phase. Patterned
Draw/Draw To/Box retain their existing preflight, traversal, clipping and phase;
solid graphics primitives keep foreground writes. Text writes indexed logical
pixels through the existing Bob/Autoback drawing wrapper. Each buffer retains
its own background for transparent writes. Print, Writing, Pen/Paper, Cline,
bitmap transfers and Bob images retain their separate behavior.

## Source evidence and limits

The pinned original AMOS implementation uses `SetDrMd` in `InGrWriting` and
initializes graphics pens/mode in the screen-opening path:
[Lib.s, InGrWriting](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BLib.s)
and [W.s, screen initialization](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BW.s).
The [Amiga graphics documentation](https://wiki.amigaos.net/wiki/Graphics_Primitives)
describes JAM1/JAM2 foreground/background behavior. Native SetDrMd accepts more
modes than this subset. Complement/inverse, native text cursor advancement,
Topaz glyph parity and exact graphics.library rasterization remain open.

## Planet Zybex fixture

Use **Game-over text (fixture)** in the
[Planet Zybex demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex.html).
Original lines 189–199 select screen 2, set colours and Gr Writing 0, then draw
four blue offsets around a light-blue GAME OVER. A declared blank 320×160 screen
and Ink background 0 replace setup. Key/button guards advance to an explicit
opaque comparison and then restore the original transparent passes. The original
AMAL/fade/audio/manual Update/score paths are omitted; this is not game-over
execution in a running game.

`tools/reference/planet-zybex-game-over.py` independently rasterizes the five
literal text passes using the pinned public-domain basic font in
`test/fixtures/font/`, with its own palette and PNG encoder. Three indexed/RGBA
hashes and PNGs cover the outline, its opaque overwrite and exact restoration.
Unit checks also cover mode validation, background pens, patterned lines, Print
isolation and Bob/double-buffer restoration. Six PAL/NTSC browser frames compare
Canvas with independent pixels and actual WebGL with the shared reference;
CPU presentation is forbidden during GPU checks. Live-page checks use real keys
and retain fullscreen/disposal checks. These checks do not establish Amiga capture
or native font/raster parity.
