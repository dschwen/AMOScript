# Roller II browser runner

The [live demo](../demos/roller2-game.html) embeds the 65,966-byte
[source-corrected program](../examples/Roller2/current/movement-edge-fix.md) and the [current supplied asset manifest](../examples/Roller2/current/README.md).
The original executable is retained unchanged in the frozen fixture set. The
playable AMOS file moves its existing board-edge check before two map reads;
the final help-page position calculation is also corrected on line 1129.
Only lines 642, 645 and 1129 differ from the frozen source. No compiler or memory workaround is used. The
refresh includes changed title, scores, help and levels, plus the restored
`iffp/roller hi` and `iffp/roller bounce` images. All game procedures remain
present; no compiler/runtime special cases are used.

The [HTML Preview link](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-game.html)
is in the gallery. WebGL2 is the default, with fullscreen, keyboard/Gamepad input
and optional gesture-activated sound. Enter fires, arrows move, Space reaches the
original pause screen, and M/F toggle music/effects. H opens title-menu scores.
Escape exits fullscreen before a later Escape reaches AMOS. Restart preserves
the container and rebinds the owned audio session. Errors still require Restart.


The large red **Play Game** button launches the live host directly, requests sound
and fullscreen in the same browser click, and leaves the original intro waiting
for input. Press a key to continue to the menu, then select Game or Editor yourself.
It does not run the verification replays first. Repeat clicks reuse the running
session; no automatic key or joystick input is injected. The
shared checks and captured frames remain under a collapsed **Browser checks and
captured frames** section. The original sound/fullscreen controls remain available
when a browser denies either API. No VM variables, IPs or assets are patched.

The optional Touch Auto/On/Off control enables a five-button joystick cross in
fullscreen. Auto appears on touch/coarse-pointer devices; On also lets desktop
users try it. It feeds port 1 independently of text/mouse input. See the
[page-building tutorial](game-webpage-tutorial.md), including a command that builds
this source and current asset manifest into a smaller standalone game page.

## Current acceptance path

`test/helpers/roller2CurrentReplay.js` runs the complete source and current assets:

1. Logo, input, initialization and current title with continuing MOD music.
2. Current level-1 ready prompt and starting ball at (5,9), with six collectible
   tiles. Right collects the original colour tiles and reaches the warp tile.
3. The source follows its warp/bonus path into actual level 3. The declared 4 ms
   cooperative clock produces score 278. Ready input starts that level's ball.
4. The level-3 input route collects the bottom-right time bonus, increasing TM
   from 20 to 30 and removing that tile. The ball stops at (17,11); a second Down
   bumps without another pickup or invalid read. The resulting score is 299.
5. Host Stop freezes audio positions and removes owned wakes. The injected clock
   advances past the source Timer deadline; Resume rebases audio and the original
   game loop follows its Timer-expiry branch.
6. Original Boom/fade effects, tracker stop/bank-22 erasure, game-over image load
   and AMOS Music start.
7. Original input exit, Mvolume fade, Music Off/bank-3 erasure, restored high-score
   image loading and the post-game score scroll. Score entry is skipped naturally
   because the replay's score is below the current lowest saved score.
8. The original scroll returns to the title, reloads bank 22 and restarts MOD
   music, then original input starts a fresh level-1 game with score zero.

Only physical input and host Stop/Resume are injected during execution. No
variables, IPs, targets or bank bytes are edited. The edge-guard correction is
already present in the AMOS source before it is compiled. The long host stop tests the existing
contract that AMOS Timer keeps running while VM/audio execution is stopped. It
is not a claim about native busy-loop timing or uninterrupted hardware gameplay.

Keyboard and injected browser Gamepad paths both pass. Thirty Canvas frames
match CPU presentation and fifteen actual GPU frames match immutable physical
snapshots, with CPU presentation disabled during GPU rendering. Six independent
image-region checks compare the logo, current title and returned title in both
input modes. The current title PNG is decoded independently by Python from the
supplied ILBM. New board/score-scroll frames have CPU/GPU parity evidence; they
are not external Amiga captures. The tunnel demo separately verifies its supplied
assets against 48 independent animation hashes and five GPU comparisons.

A separate input-only editor replay follows the original title-menu click,
opening fade and editor loop, then places tile 3 at cell (2,2) and moves the pointer
onto the foreground panel. It then presses T, follows the panel below the field
into the edited level, exits with Escape, acknowledges the source key prompt and
returns to the editor with its map restored. Ten additional Canvas frames and ten
GPU comparisons cover the overlapping windows, field-edge clipping, late DMA,
right-edge sprites and returned panel.
See [screen priority](screen-priority.md) for the source-derived slice rules and
remaining bounds. The live runner reports the editor phase and accepts pointer
input; real-time gallery checks also enter it from the title, test the level and
return after leaving fullscreen.

Live gallery checks also cover real-time game entry and timeout, fullscreen,
sound, Stop/Resume, score scroll/menu return, fresh-game selection, Restart,
separate H/scores entry and owned context/fullscreen cleanup.

## Asset versions and retained regressions

`examples/Roller2/current/manifest.json` pins 34 files by size and hash. Changed
and newly supplied files are stored there; identical files share the earlier
pinned bytes. The earlier `examples/Roller2/manifest.json` remains frozen so the
bounded display/gameplay fixtures retain their independent expectations.

The older `roller2Replay.js` regression therefore still exercises level-2 arrows
and the historical missing-image error using only the earlier asset set. The
playable demo uses `roller2CurrentAssets.js` and `roller2CurrentReplay.js` instead.
The missing image is no longer a blocker in that demo. This distinction preserves
old error-cleanup coverage without presenting it as current game behavior.

Original line 1007's `Rainbow 0,1,380,24` remains a bounded off-field placement.
Native RainDo/RainA1 stores a word Y and clamps the lower bound to 28, without a
PAL field-end clamp. Y 0–65,535 and height 0–312 are accepted when the effective
end does not wrap. Off-field ranges retain metadata but emit no visible palette
writes. Wrapped ends and active NTSC rainbows remain open. See [display contract](title-display.md).

## Remaining limits

Browser files are synchronous prepared byte strings, with case/volume mapping in
the adapter. Writes, if reached, stay in session memory across Restart and vanish
on page reload. The accepted replay performs no writes; IndexedDB is still planned.

High-score name entry/writeback, editor save/load/requesters and wider actions, help/win flows, other handlers,
later-level completion and external Amiga execution/audio captures remain open.
The refreshed assets fix the reached resource failure; passing this bounded path
does not establish full game or general AMOS compatibility.

The live **Play Game** path now uses compact, labelled icon controls and hides
routine runtime diagnostics. The browser-check host offers a collapsed Debug
menu for exporting new/modified session files and inspecting source errors.
Standalone builder pages enable those diagnostics only with `--debug`; see
[debug builds and exports](game-webpage-tutorial.md#debug-builds-and-downloading-session-files).

[Play the full Roller II debug build](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-game-debug.html)
for a standalone application page with the current source/assets and Debug enabled
from launch. It is generated with `build_game_page.js` by `npm run build:demo`,
requires no verification replay, and is linked from the regular game and gallery.

The [help-page regression](../demos/roller2-help.html) runs all seven icon pages,
the original timed demonstrations and return to the menu. The final four entries
use a corrected base of 48 on source line 1129; see the
[source fix and evidence](../examples/Roller2/current/help-page-fix.md).

The supplied level-3 refresh removes the stop tile at (17,7), so the current
replay slides directly from (17,6) to the time bonus at (17,11). Its metadata now
starts with TM=20; the pickup raises it to 30. The current input-only result is
score 299. Earlier map-specific expectations (TM=20 after pickup, score 301)
are historical and do not describe the refreshed map. Frozen assets stay intact.
