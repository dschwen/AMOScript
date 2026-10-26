# Original Roller II bonus and next-level loading

The [progression demo](../demos/roller2-progression.html) extends the connected
colour fixture with unchanged ZAEHLHOCH lines 1106–1111. Its ordinary Return
reaches the original Goto LEVLOAD, checks Exist, loads the real `RII:levl/2`
bank, refreshes the status rows and calls GAMEDISP. Fire at the next ready prompt
continues original metadata reads, BALLFARBEN, sprite placement, fade, border and
Timer setup into the second-level input loop. No variable, instruction-pointer,
map or filename edits advance the program. Earlier demos retain their guards.

ZAEHLHOCH increments LV before capturing its inclusive For bound
`((TM*50-Timer)/10)+30`. Every iteration increments HI, prints the score and plays
the original sample through the rotating four voices. The deterministic replay
releases Right between the five first-level collections. Bonus begins at 11024 ms,
Timer 282; integer division produces upper bound 176. The 177 iterations raise
score 50 to 227. This is an injected-clock expectation; live input timing changes
the bonus. The bound remains captured when Stop/Resume advances the host clock.
Exact native busy-loop timing remains open.

The second-level load replaces bank 10 and retires its old virtual addresses.
The full new 490-byte payload equals the original level-2 file; its three colour
tiles, start (8,1), colour 1 and time limit 30 come from that file. The ordinary
Gosub stack is empty after bonus return. The missing-next-file test follows the
original Exist/FDZ branch to the declared win guard without reading a missing file;
it does not run the win routine or its AMOS Music tune.

`tools/reference/roller2_progression.py` independently composes the final level-2
board, status score/level/countdown, border and low-four-plane ball using raw
AmIc/AmSp/AmBk assets and pinned portable glyphs. It imports only the independent
Python oracles. The 13000 ms final frame prints countdown 29. The complete PNG,
RGBA hash and payload hash are checked in. These expectations are source/asset
analysis with the portable font and hardware origin, not Topaz or Amiga captures.

Three headless groups cover every bonus score and sample voice, bank retirement,
next-file selection, complete second-level pixels, Stop/Resume during bonus and
the missing-file branch. Keyboard and injected Gamepad browser replays compare
fourteen independent Canvas images and seven actual GPU frames, with CPU
presentation disabled during GPU rendering. The live WebGL/fullscreen demo
supports Stop/Resume and Restart; it is silent. Its finite replay alone records
audio events. The existing metadata-only level demo remains separate.

Other tile handlers, pause, game-over and win remain explicit guards. The demo
ships only levels 1 and 2; it does not claim complete gameplay or all-level
progression. The separate [pause fixture](roller2-pauses.md) now runs original PAUSE/IPause;
this progression fixture retains its pause guards. The [arrow fixture](roller2-arrows.md) now runs PFEIL/N34 with the original
Boom timeout. Next implement remaining handlers and end-game music. Whole-program compilation still stops at Fill (line 325).
