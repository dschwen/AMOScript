# Original Roller II colour collections

The [colour demo](../demos/roller2-colours.html) extends the connected original
movement fixture with unchanged BCL 103–111, GAMED 112–115, KCWEG 743–752 and
HCWEG 754–765. Their source labels replace the earlier colour-handler guards.
The source's `Gosub ZAEHLHOCH` reaches a new explicit outcome/Wait Key guard
before bonus scoring and level loading. All other selected routine/handler guards
retain their declared bounds. This is colour collection, not a completed game or
native level progression.

From the original level-1 start, right slides through the floor to the first
colour tile. KCWEG checks the required ball colour, plays the source sample,
changes BC to the tile's background colour, calls BCL, pastes a random floor icon,
Pokes the tile number to 1, adds ten score, calls GAMED, decrements NOI and returns
to JOAB. Repeating right collects the five tiles at row 9, columns 9–13. The ball
stops one cell before each collected tile, ending at (12,9), score 50 and NOI 0.
Its colours change 1→2→3→4→5→1. The bonus guard retains one ordinary Gosub frame;
it does not return into level loading.

HCWEG uses the same palette/writeback path, awards twenty points and reverses
the direction before continuing movement. A mismatched HCWEG tile reverses
without collecting; mismatched KCWEG returns to input without collecting. BCL's
seven original branches affect only palette entries 17–19. Blank entries retain
their register positions and never fade unrelated colours. See
[sparse Fade lists](roller2-intro.md#explicit-fade-palette-lists).

Tile writes change only the five number bytes at bank offsets 189–193. Original
background-colour bytes and time/position metadata remain unchanged. The random
visual fill is independent of the stored tile number: under the declared initial
seed/beam choice, icons 1,1,1,2,1 are pasted, while all five Pokes store 1. The
original masks apply to the existing indexed bitmap; the oracle does not redraw
the edited map to approximate those pastes. No files or browser persistent storage
are written.

## Sparse Fade and source evidence

The parser now accepts leading, interior and trailing blank colour fields in
explicit Fade lists, preserving each register index. Lowering emits null markers
for omissions; the shared controller validates all supplied integer/boxed-integer
values before replacing the fade and skips the omitted entries. Lists still
accept at most 32 fields, including omitted ones. An all-omitted explicit list
replaces/cancels the previous fade without changing colours. Native float colour
bit-pattern forms, Fade To bank/masks and wider speeds remain gated.

The source-derived omission rule follows `src/interp/graphics.cpp` colours,
unchanged and fade at AMOS-Professional-Official revision
`efddf2c9a09bf61a45b7b096a9be84630853c2b1`: explicit lists begin with a no-change
palette, and negative/omitted values retain their entries. Existing captured
palette goals, next-VBL start, component steps, Flash-before-Fade ordering,
replacement and Stop/Resume behavior are reused. Native timing/captures are not
inferred from this syntax support.

## Independent and browser evidence

`tools/reference/roller2_colours.py` uses only independent raw AmIc/AmSp/AmBk
oracles, the arbitrary-precision RNG oracle and pinned public-domain font8x8
rows. It writes `colours.json`, a first-component transition PNG and five settled
colour/score PNGs, with complete image and bank-payload hashes. The supplied
reference clock starts input at 5400 ms; the first transition at 5920 ms has
logical score 10 while the old score glyph is still displayed, because original
GAMED has not completed its VBL wait. Settled captures at 6600, 8000, 9400, 10800
and 12200 ms release input between collections. At the final bonus guard the
last printed countdown stays 29 rather than continuing to update. These are
portable-font/source/asset expectations, not Topaz or Amiga execution captures.

Three sparse-Fade headless groups verify field positions, the exact list bound,
all-omitted replacement and failure before job replacement. Five original-game
groups compare every pixel/hash and RNG result, unchanged unrelated palette
registers, all BCL branches, both HCWEG outcomes and mismatched KCWEG. Prepared
original maps 3 and 2 occupy the requested level-1 adapter slot for HCWEG tests;
a separate declared synthetic starting-colour byte tests KCWEG rejection. These
do not claim native level selection. Stop/Resume during a partial colour fade
reconciles elapsed fields without duplicating random draws, score or map writes.
Sample assertions identify bank-6 commands separately from simultaneous MOD
voices and check original voice rotation/frequency overrides.

Keyboard and injected Gamepad browser replays check all five collections each,
fourteen independent Canvas frames and seven actual WebGL comparisons with CPU
presentation disabled. The live demo preserves fullscreen, Stop/Resume and
Restart; holding Right exercises rapid successive source fades. A finite replay
alone records audio events; the live preview is silent and does not accumulate
an audio log. The optional audible menu demo is retained. The gallery links every
shared browser test through HTML Preview, and all assets run offline.

The separate [progression fixture](roller2-progression.md) now implements original
ZAEHLHOCH and real next-level loading. This colour fixture retains its bonus guard.
Next extend reached colour/obstacle/exit paths. Full compilation still stops at
Boom, with fourteen token encodings unrecognized. Pause, death, highscore/editor
and native capture gates remain open.
