# Planet Zybex: vertical completion and level-3 entry

The [full-game page](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex-game.html)
now has a frozen input route through level-2 completion, its full docking
sequence and the first ten horizontal fields of level 3. Five lives survive;
the score is 820 at that checkpoint. The replay changes no VM variables, IPs,
AMAL strings or bank pixels.

## Three source-level docking corrections

The supplied program's vertical docking code still used the horizontal loop's
rectangle at lines **1494, 1499 and 1506**:

```text
Screen Copy 1,LOP,0,LOP+320,160 To Logic(2),0,0
```

At docking, LOP=480 and the source bitmap is only 320 pixels wide. The native
`Sco4` path returns immediately when the source X origin is outside `EcTx`;
see [AMOS-Professional-Official +Lib.s, revision 533b4b1](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BLib.s).
The existing checked Screen Copy implementation already behaves correctly.
Those ignored copies allowed swaps to alternate earlier row-479/480 views.

The current playable source instead uses:

```text
Screen Copy 1,0,LOP,320,LOP+160 To Logic(2),0,0
```

This matches the source's vertical gameplay copy. The corrected program is
[examples/PlanetZybex/current/Zybex.AMOS](../examples/PlanetZybex/current/Zybex.AMOS),
with a checked current manifest. The original parent source stays frozen; all
seven asset files and embedded banks retain their original bytes. Exactly three
physical lines change, with identical header, line lengths and byte locations.
There is no compiler special case, relaxed clipping or live bank patch.

`tools/fix_zybex_docking.js` reproduces the correction from the pinned upstream
hash into a new output file. It preserves cached operand bytes and does not run
as part of compilation. Unit tests compare every line and trailing bank byte,
verify source hashes and reconstruct the three statements. Separate striped
bitmap cases prove that each original call remains a no-op, while each corrected
call copies row 480 into Logic and leaves Physic untouched until an ordinary swap.

The full-game launcher and its shared browser verification factory now compile
the current source. Existing bounded fixtures continue to embed the frozen
original; their declared paths do not execute these docking statements. The
loss/restart pixel/audio expectations remain valid because their code is unchanged.

## Input-only progression

The existing horizontal route and first 25 vertical fields are retained.
`progression-input.json` now adds a second mask/count sequence for the rest of
level 2. Fire stays held while fixed arrow presses avoid terrain and enemies;
read-only planning found the route, but the committed replay contains no planner
or adaptive mutation. Current and upstream source hashes are recorded.

The source clamps vertical scrolling to 480, reaches the actual Zone, removes
ship AMAL and performs these final updates:

| Stage | Total Update | Vertical Update | Sprite image |
| --- | ---: | ---: | ---: |
| Last pre-limit field | 1185 | 480 | 23 |
| Zone reached, source row 480 | 1186 | 481 | 22 |
| Dock hold | 1187 | 482 | 22 |
| Dock animation | 1188–1190 | 483–485 | 22, 21, 20 |
| Horizontal ship restored | 1191 | 486 | 2 |
| Level 3 first field | 1192 | — | 3 |
| Level 3 movement checkpoint | 1201 | — | 2 |

The source then loads the real level-3 bank, replaces the hidden 320×640 world
with a 960×160 world and installs 25 AMAL channels. Five neutral/fire fields and
five right/fire fields verify the new horizontal mode; the ship finishes at
hardware coordinates 281,174 with five lives. Exactly three asset reads load
levels 1, 2 and 3. Each world uses a different owned bank object.

The release Update at line 1509 immediately proceeds into level-3 loading before
the VM yields. Its snapshot is observed synchronously after that Update, before
the world is replaced; no Stop, variable edit or instruction guard creates that
frame. Other captures follow ordinary clock callbacks. The existing explicit
Stop/Resume at horizontal field 300 remains covered.

## Pixels, browser checks and limits

The independent Python reference now decodes levels 1–3. It adds fourteen raw-map
strips for vertical corridors, docking and horizontal re-entry. The sampled
regions exclude setup pastes and known Bob/Sprite regions; the late vertical
strips use the left 32 lowres columns to exclude Bob 31 at x=70. Corrected docking
copies must keep source row 480, rather than alternating old buffers. Expected
bytes come from packed assets, not production decoder/rendered outputs.

Frozen coordinate/score checkpoints are execution regressions, not independent
whole-VM traces. Whole-frame GPU/reference comparisons cover each captured scene;
independent full moving composites remain open.

PAL/NTSC keyboard and injected Gamepad progression each run **1,201 Updates**,
including 486 vertical Updates and ten level-3 fields. Each checks 28 independent
strips and actual GPU output. Combined with loss/restart, the full-game page has
**eight runs, 6,480 Updates, 188 independent regions and 152 GPU comparisons**,
retaining two native Web Audio shot comparisons. The separate development
fixtures bring total Zybex GPU comparisons to **326**. Every capture is available
in the page's collapsed browser checks.

Regenerate with `python3 tools/reference/planet-zybex-progression.py`, rebuild
with `npm run build:demo`, and verify with `npm run check` and
`npm run test:browser`. The native clock/capture limits in
[earlier progression](planet-zybex-progression.md) remain. Level-3 completion,
later levels/victory, wider independent moving/audio comparisons and actual
Amiga display/audio/timing captures remain open.
