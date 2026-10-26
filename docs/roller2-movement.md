# Original Roller II first movement

The [movement demo](../demos/roller2-movement.html) runs the connected original
startup/menu/ready/ball setup and JOAB input, then unchanged BEWEG and THE_MOVING
641–661. Original 646 uses the source SAS$ table, not a synthetic floor dispatch.
Original PHALT 663–676, GSPHALTJOAB 959–961 and Lasttest 1181–1187 are included.
Other SASINIT destinations have named outcome/Wait Key guards; pause and game-over
remain guarded. Earlier menu/input/ready fixtures retain their declared bounds.

A prepared input replay selects Game and presses/releases ready fire, ending at
the native starting board state. Subsequent keyboard/Gamepad input is live. No
variable/IP writes or tile edits advance the connected first-level replay. From
(5,9), right starts a slide through floor cells 6–8 and reaches the KCWEG guard
before the colour tile at (9,9). The ball stays at (8,9); the collectible, score
and colour effects are not run. Up/down/left hit actual neighboring walls.

THE_MOVING advances the hardware sprite by BLSPD=2 over eight VBL steps per cell,
then updates the logical cell, calls Lasttest and checks the next tile. Releasing
the joystick does not stop an in-progress floor slide. Walls use the original
sample command, cyclic Add, Wait Vbl and JOAB return without moving the ball.
GSPHALTJOAB calls original PHALT and returns to input on a stop tile. Lasttest
changes a departed tile 18 to wall 33, pastes its original icon and plays the
source sample before returning. The explicit next-handler guard does not replace
these paths.

[String branches](string-branches.md) and [integer Add](add.md) provide the required
language semantics. Numeric/expression label forms beyond main ASCII strings,
procedure string-branch visibility, slow/colour/collectible/arrow/exit handlers,
edge pre-read behavior, full pause/death and whole-program compilation remain
open. Native BEWEG reads neighbor bytes before its bounds check; this subset does
not silently repair source ordering. The tested first-level corridor meets real
walls/guards before an out-of-bank read. Full compilation still stops at Fill (line 325),
with thirteen encodings unrecognized.

## Independent evidence

`tools/reference/roller2_movement.py` imports only independent Python raw-asset
oracles. It reads the original map, derives the 24 two-pixel steps and guard
metadata, and composes four independent complete images using the portable font,
source palette/rainbow and low-four-plane sprite. `movement.json` stores positions,
cell ownership, image hashes and guarded destination. Logical cell changes follow
the final Wait Vbl, so the last sprite step precedes its cell update. These are
source/asset expectations on the declared 50 Hz clock, not native instruction/
DMA timing or Amiga captures.

Four headless groups verify all 24 positions and four PNGs, release-during-slide,
wall blocking and sample voice masks 1/2/4/8, ordinary Gosub stack cleanup,
unchanged level-1 bytes and mid-slide Stop/Resume/factory independence. Prepared
alternate-map checks place the original unmodified maps 9 and 4 in the requested
level-1 adapter slot: map 9 reaches its actual stop tile; map 4 leaves a collapsing
floor, changing only byte 91 from 18 to 33 before stopping at a wall. LV and the
requested filename stay 1 in these declared adapter fixtures; they do not claim
native level progression. Audio assertions select bank-6 sample commands, not
simultaneous tracker events.

The browser scenario runs keyboard and injected Gamepad input through wall bumps
and a slide, checking 48 field positions, twelve Canvas images and six actual
WebGL comparisons with CPU presentation disabled. A wall prefix shifts its clock
by 100 ms; the countdown remains 34 throughout the recorded images. The live
preview defaults to WebGL, labels Canvas fallback, retains fullscreen across
Restart, and verifies a mid-slide Stop/Resume. Its field clock advances from host
timers independently of requestAnimationFrame, including while the VM is stopped;
the paused sprite stays fixed and source Timer may advance. Live preview omits
an audio adapter/recording log; finite replay alone collects sample events. Sound
controls remain in the menu demo. Every browser check is available offline and
linked through HTML Preview from the gallery.

Next implement KCWEG/BCL and its actual colour/score/tile-writeback dependencies,
then extend original trajectories through collectible interactions. The stopped
colour-handler guard is not a completed game.

The separate [colour fixture](roller2-colours.md) now replaces KCWEG/HCWEG
guards with original handlers, BCL and GAMED, reaching the level-bonus guard
after all five first-level colour tiles. This floor inspector retains its
original colour-handler boundary.
