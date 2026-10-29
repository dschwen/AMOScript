# At strings and Planet Zybex’s score display

`At(x,y)` (`$13c6`) returns an ordinary AMOS string. Each coordinate can be
omitted, with both comma positions retained: `At(2,)`, `At(,1)` or `At(,)`.
The result can be stored, concatenated, returned by a procedure or read from DATA.
Evaluating it does not select a screen, move the cursor or draw pixels.

The native `FnAt` encoding is `ESC,"X",48+x` followed by `ESC,"Y",48+y`.
Omitted coordinates produce no bytes; both omitted returns an empty string.
Coordinates use the shared integer conversion and accept 0–207. Explicit EntNul
(`-2147483648`) also omits that axis. The byte for 207 is `$ff`, not a decimal
string or Unicode escape. Both expressions evaluate once, left to right, before
encoding/validation. As in `FnAt`, y validates before x. Invalid values fail with
source context without drawing or moving the cursor.

The default-window writer interprets X/Y escape controls when Print or Centre
consumes the string. Coordinates are text cells; the other axis stays unchanged.
Window bounds are checked at consumption, so `At(70,)` can be stored on a
40-column screen and later printed on the 80-column score strip. An invalid
window position raises the existing cursor error. Already written characters
are not rolled back.

Partial escape sequences survive separate Print/write calls and Stop/Resume.
Their state belongs to each screen and resets on Screen Open. Autoback replays
from the same initial escape/cursor state and retains only the final logical
state, so controls are consumed once. Print comma tabs predict the moved cursor
from the emitted bytes without drawing or reevaluating expressions. Host write
callbacks still receive the original bytes. Print # keeps its raw device/file
semantics; it does not move the screen cursor.

Only X/Y positioning and the native no-operation escape letters A/F/G/H/L are
supported here. Other recognized uppercase escape commands fail explicitly;
non-uppercase escape selectors are discarded as in the native dispatch. General
window commands and their escape controls remain open. Graphics Text and Writing
modes keep their existing separate semantics.

Source evidence is AMOS-Professional-Official revision
[`533b4b1f5acd604814513f78e02c7b4796cb0531`](https://github.com/AOZ-Studio/AMOS-Professional-Official/tree/533b4b1f5acd604814513f78e02c7b4796cb0531):
[`+Lib.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BLib.s)
`FnAt`, and
[`+W.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BW.s)
`EscM`/`Esc`/`CEsc`, `LocaX`/`LocaY`/`Loca` and `AutoPrt`.
These are source-derived and portable-font expectations, not native captures.

## Mixed-resolution presentation

Planet Zybex uses a 640×10 hires, two-colour score screen at hardware y=211,
below a 320×160 lowres playfield at y=50. The presentation bridge now accepts
that separate hires strip alongside lowres priority slices on the same hardware
width. Overlapping windows retain the existing lowres/equal-width
contract. The separate strip has its own palette but still shares COLOR00.
Different backdrop colours (including future thunder transitions), HAM,
fine-scroll and unequal hardware-width priority layouts remain rejected.

The existing copper builder switches BPLCON0, fetch width, pointers and palettes
on real blank setup rows with unchanged write budgets. The one-row gap at y=210
is preserved. Indexed bitmap buffers remain authoritative; snapshots pack their
bitplanes into chip memory for both Canvas/reference rendering and WebGL. No
RGBA overlay or CPU fallback substitutes for GPU decoding. Earlier snapshots
remain immutable across later geometry changes and rejected layouts.

## Fixture and verification boundary

Select **Score display (fixture)** on the
[Planet Zybex page](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex.html).
It runs unchanged original score/playfield setup, level-1 load/display,
palette/priority/copy and both score statements. Prepared inputs are score 1234,
lives 5, offset 0; the next key supplies score 9876/lives 4. An explicit synthetic
Screen Swap makes the prepared playfield copy visible. Wait Key guards replace
the absent game loop. Default, AMAL, Synchro/Update and gameplay do not run.
No host edits are made to a running game’s variables, IP or assets.

`tools/reference/planet-zybex-score.py` independently decodes the packed level
and composes the lowres pixels twice horizontally, a real blank row and a hires
score bitmap using pinned public-domain font rows. Two PNGs and indexed hashes
are checked in PAL and NTSC: four Canvas/GPU frame comparisons. Screen hit tests
verify both raster regions. Live controls check real keyboard advancement,
return to background browsing, fullscreen and disposal.

Unit/integration checks also cover exact byte encodings, omitted axes, bounds,
string typing/storage, effectful expression order, per-screen split controls,
comma tabs, Stop/Resume, Autoback and rejected mixed-resolution overlaps. Rebuild
with `python3 tools/reference/planet-zybex-score.py` and `npm run build:demo`;
run `npm run check` and `npm run test:browser`.
