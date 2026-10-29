# Planet Zybex: level-1 docking and vertical entry

The [full-game page](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex-game.html)
now has an input-only regression through level-1 completion and the first 25
vertical fields of level 2. All five lives survive. The original docking sequence
uses images 20, 21 and 22; the next level replaces the world bank and hidden
bitmap, installs eighteen AMAL channels and retains the ship's arrival position.
No game source, VM state, AMAL strings or bank pixels are changed by the replay.

## AMAL vertical coordinate correction

The native `AmYS` and `AmYH` routines use the same `EcWY`/`EcYBase` arithmetic as
`CXyScr` and `CXyHard` in
[AMOS-Professional-Official +W.s, revision 533b4b1](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BW.s).
Within the supported non-laced profile, AMAL and Basic conversions must agree.
The AMAL adapter instead added 50 to YS and subtracted 50 from YH. This displaced
hunter targets and vertical missiles by fifty rows.

AMAL now delegates all four conversions to the existing display coordinate
helper, after its native low-three-bit screen alias/missing-screen lookup. This
preserves word arithmetic, hires X scaling, source offsets, current selection
and View. Ten mode/value cases compare all four functions, including negative
values, word edges, explicit screen windows and alias 9 → 1. Existing Basic
coordinate behavior and Sprite placement are unchanged.

The independent hunter reference now uses `YS(2,130)=80` for its hidden screen
with origin Y=50, giving a -36 vertical Move from Y=116. The original hunter
strings, prepared inputs, shared random stream, delays and beam cases stay
unchanged. Their state/hash/PNG expectations were regenerated from that corrected
source-derived target. This fixes the conversion, rather than shifting a game
asset or changing its collision checks.

## Frozen joystick route

`test/fixtures/planet-zybex/progression-input.json` contains 700 joystick masks as
mask/count runs. Fire stays held while directional presses avoid terrain and
moving enemies. A final held direction reaches the actual source Zone after the
horizontal scroll reaches 640. The route was found by read-only observation and
terrain/enemy planning; discovery is not a correctness oracle. The committed
replay only sends the frozen controls. It does not include the planner or an
adaptive game-state intervention.

`test/helpers/planetZybexProgression.js` checks these source-driven stages:

| Stage | Update call | Evidence |
| --- | ---: | --- |
| Departure | 1 | Original ship moves and begins its two-frame animation |
| Enemy corridor | 300 | Real enemies/firing and a Stop/Resume with fresh input |
| Dock approach / scroll limit | 600 / 640 | Original map scrolling and clamping |
| Dock zone reached | 701 | Ship at hardware 336,174; lives 5; score 470 |
| Dock hold / images 20,21,22 | 702–705 | Original waits and For loop; ship AMAL removed |
| Vertical entry | 706 | New 320×640 level-2 bank/bitmap and eighteen AMAL channels |
| Vertical movement | 711 / 716 | Five up presses, then five left presses, with fire |
| Vertical scroll | 730 | 25 vertical fields; ship 311,149, image 22; lives 5 |

The final visible vertical copy starts at source row 24. The program has already
advanced RN to 25 while waiting for the next VBL; the test keeps that distinction.
Checkpoint positions/scores are frozen execution regressions, not independent
whole-VM traces. The first-level score remains 470 during this bounded level-2
prefix. Two actual file reads load level1_screen.abk then level2_screen.abk;
replacement uses a different owned bank object. Stop at field 300 clears input
and timers; 100 ms of host time leaves the stopped VM unchanged.

PAL and NTSC each replay through direct headless input. Browser checks repeat
both through keyboard events and injected standard Gamepads. Each run performs
730 Updates, including the source docking holds and 25 vertical fields. The
clock retains the declared 1 ms callback floor and portable Basic/AMAL seed/beam
choices described in [the full-game replay](planet-zybex-game.md).

## Independent pixels and browser coverage

`tools/reference/planet-zybex-progression.py` independently decodes the two packed
maps. Fourteen checkpoint strips compare the visible source scroll with raw map
pixels: the upper eight rows of the left 32 lowres columns in level 1, and the
full-width upper 32 rows in level 2. Those strips exclude the known Bob/Sprite
regions and level setup pastes. No production decoder or rendered image supplies
the expected bytes. Separate frozen checkpoint assertions and GPU/reference
comparisons cover the rest of each scene; these are not independent full moving
composites.

Four browser progression runs add **56 independent strips and 56 actual GPU
comparisons**. Combined with the original loss/restart cases, the full-game page
now runs eight replays, **4,596 Updates, 132 independent regions and 96 GPU
comparisons**, retaining its two native Web Audio shot comparisons. Older
background/enemy/ship fixtures remain required, bringing total Zybex GPU
comparisons to **270**. All cases and captured docking/vertical frames are in the
full-game page's collapsed browser-check section.

Regenerate references with `python3 tools/reference/planet-zybex-amal.py` and
`python3 tools/reference/planet-zybex-progression.py`; rebuild with
`npm run build:demo` and verify with `npm run check` / `npm run test:browser`.
Level-2 completion/docking, later levels/victory, wider independent moving-scene
and audio coverage, and native Amiga timing/display/audio captures remain open.

## Vertical-completion update

The [current-source replay](planet-zybex-level2.md) now extends this route through
level-2 docking and ten horizontal level-3 fields. Three AMOS docking statements
are corrected in a separate current copy, preserving the upstream file and
compiler behavior. The expanded page has eight runs/6,480 Updates/152 GPU
comparisons; total Zybex GPU comparisons are 326. Earlier 25-field/270-GPU numbers
above describe this retained entry milestone.
