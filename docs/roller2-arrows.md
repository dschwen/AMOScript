# Original Roller II arrows and rebound

The [arrow demo](../demos/roller2-arrows.html) extends the connected pause/progression
fixture with unchanged PFEIL 930–947 and N34 767–768. Their labels replace the
previous handler guards. Earlier movement/colour/progression/pause demos retain
their declared bounds. No map, variable, instruction-pointer or filename edits
advance this fixture.

After real first-level completion, bonus and level-2 ready input, Right enters
tile 38 at (9,1). PFEIL moves one pixel per iteration for sixteen iterations,
then updates the logical cell and changes direction down. Ordinary floor sliding
continues to the wall at (9,4). Left from there enters tile 36 at (7,4), turns up,
then tile 35 at (7,3) turns left; the wall stops the ball at (5,3). Arrow speed
is independent of BLSPD. Each source turn plays its original sample and returns
through BEWEG/SAS$ dispatch. The source's alternating image-1 slot is empty in the
original bank; the existing null-image contract preserves the shown ball.

From that stop, Up reaches (5,1). Left selects original N34 at (4,1), immediately
reversing direction without consuming it. Mismatched HCWEG at (7,1) reverses the
ball back again. The source continues between them without returning to JOAB,
so a new input direction does not interrupt that slide. All original level-2
bytes, score 227, NOI 3 and ball colour 1 remain unchanged in this bounded route.

PFEIL's original deadline branch remains intact. A finite headless replay waits
at the real level-2 input loop until Timer 1450, then enters the first arrow.
When fewer than forty fields remain, original line 939 executes Boom, sets J=16
and jumps to the explicit game-over outcome/Wait Key guard. This exercises actual
synthesized PCM commands; it does not run the game-over screen or AMOS Music tune.
The standalone [Boom demo](boom.md) auditions and independently checks the effect.
The arrow preview is silent.

`tools/reference/roller2_arrows.py` uses independent raw asset/portable-font
oracles to compose a seventh one-pixel-step frame and both wall-stop frames.
It writes full PNG/RGBA hashes and the sixteen first-arrow positions. The injected
clock captures are 13140 ms (hardware 263,66; logical 8,1), 14000 ms (272,114;
logical 9,4), and 15400 ms (208,98; logical 5,3). Logical cell updates follow the
last source wait, so the pixel and logical positions deliberately differ during
entry. These expectations are not native timing or Amiga captures.

Four headless groups cover exact positions/pixels, all three turns, original
N34/mismatched-HCWEG rebound, bank/score/stack integrity, the real Boom timeout,
and host Stop/Resume during a one-pixel step without duplicated turning effects.
Keyboard and injected Gamepad browser replays compare thirty-two one-pixel
positions, twenty independent Canvas images and ten actual GPU frames, with CPU
presentation disabled during GPU renders. The live WebGL demo retains fullscreen,
host Stop/Resume and Restart. Enter is keyboard joystick fire; Space reaches the
original pause path. Live checks release direction after entry, allowing native
sliding and arrow changes to complete without adding repeated joystick input.

Other obstacle handlers, game-over/win routines, end tunes, editor/highscores and
full-game progression remain open. The separate [Fill/Copy contract](bulk-memory.md) now covers original editor
transfers and the [selection preview](set-line.md) covers Set Line. Writing and
later language forms are still compiler gates; the full original program is not yet compilable.
