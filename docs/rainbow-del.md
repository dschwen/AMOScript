# Rainbow Del and Roller II return setup

`Rainbow Del` (`$0dc2`) deletes all rainbow tables. `Rainbow Del n` (`$0dd4`)
deletes slot 0–3; any negative integer selects all slots as in the source.
Deleting a valid undefined slot or an already-empty set is a no-op. Positive
selectors above 3 reject before mutation; native wrapped positive aliases remain
gated. The separate original arities use ordinary numeric conversion, including
DATA/array/procedure and boxed values, evaluated once with source-context errors.

Deletion removes the owned table and active placement. Other slots keep their
identities, colours and ranges. Deleting the winning slot reveals a lower-priority
overlapping rainbow; without one, the current screen palette supplies the colour.
It does not restore an old captured palette or write indexed bitmap pixels.
A deleted table is unavailable to Rain/placement queries, and recreating the slot
allocates fresh state rather than reusing its old colours or placement.

Rainbows are per-program display state and can be deleted without an open screen.
Changes affect the same live palette-row selection used by Canvas and the physical
copper snapshot, including while Auto View Off stages geometry. Deletion neither
commits View nor changes screen selection, buffers/cursors, input or palette/fade
jobs. Existing immutable snapshots retain their captured palettes. A fade running
behind an active rainbow continues, and removal reveals its current colour.
NTSC active placement, pattern strings, broader mode/timing parity and native
captures keep their existing gates.

Source evidence is pinned to AMOS-Professional-Official revision
`efddf2c9a09bf61a45b7b096a9be84630853c2b1`: `src/lib/screens.cpp`
`lib_in_rainbow_del0/1` and `ec_d1`, and `src/w/rainbow.cpp` `delete_one`/
`delete_rainbow`. The source clears an allocated slot's range/buffer, tolerates
an unallocated valid slot, and scans all four slots for negative selectors.
These are source-derived semantics; exact copper rebuild/VBL timing has not
been established by an external Amiga capture.

The [browser demo](../demos/roller2-rainbow-del.html) runs unchanged Roller II
line 557: Screen 1, HOPSCREEN, Rainbow Del 0. Its HOPSCREEN procedure is a declared
Wait Key guard; the original floating-point bounce/sprite animation is excluded.
Prepared screen 1 is 320×256, filled with index 1 and base colour `$135`. Slot 0
provides five grayscale rows at hardware y=250; slot 1 supplies ten red rows at
the same origin. The initial frame shows their priority, the original deletion
reveals red, and a synthetic bare delete-all restores the base colour. The fixture
stops at separate gates before subsequent game/editor return statements.

`tools/reference/roller2_rainbow_del.py` independently builds all three PAL PNGs
and RGBA hashes from explicit row-colour expectations, including rows spanning
the PAL line-255 fence. Four headless groups check absent/all/specific deletion,
atomic selector errors, recreation/factory isolation, screen-free operation,
typed arguments/arities, immutable snapshots, live-before-View/fade behavior and
the original call's ordinary procedure return. All indexed pixels remain intact.

The shared browser scenario checks three independent Canvas images and three
actual GPU frames with CPU presentation disabled during GPU rendering. It also
checks the surviving slots and procedure/selection state. The offline demo
supports stepping, fullscreen and Restart while retaining the container. Its
HTML Preview link is in the gallery. This establishes fixture and CPU/GPU parity;
full editor return, HOPSCREEN animation and native execution remain separate work.

Whole-source compilation now stops at Edit `$0670`, original line 956,
byte 53096. Four of 194 encodings remain unrecognized. Recognition is separate
from full-game/editor behavior and AMOS Music end-state acceptance.
