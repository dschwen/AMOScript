# AMCAF Protracker implementation

AMCAF `Pt Play` uses a different player from AMOS `Track Play`. The first
implementation stage is a pure pitch kernel in `lib/amos/amcafPitch.js`.
It is not registered as `Pt Play` yet and does not start sound or own timers.

## Source and implemented pitch rules

The pinned AMCAF 1.50beta4 disassembly is in
`tools/reference/amcaf-v1.50beta4/ira.s`. Period words at file offsets
`$974c..$9bcb` and the sine bytes at `$972c..$974b` are preserved literally.
Finetunes use the original order 0..7 followed by -8..-1. Equal-temperament
formulae and the existing AMOS player's cleared finetunes would give different
notes.

The kernel implements ordinary note tuning (`$8db4`), tone-portamento target
selection (`$90ca`), pitch slides (`$903c/$908a`), arpeggio (`$8fc6`) and the default sine vibrato
(`$91c0`). Target selection really multiplies the raw finetune by 74 bytes,
where ordinary tuning uses 72. For example, raw note 428 with finetune -1
produces ordinary period 431 but portamento target 363. Preserve this native
quirk. Negative target finetunes back up one table entry after their search.

Slides wrap a full 16-bit word before clamping its low twelve bits. Sliding
113 upward by 255 consequently gives stored word 65394 and output period
3954. Vibrato retains its speed and depth nibbles independently, uses the
original integer sine products, and wraps its phase byte. It returns output
period and new memory/phase without changing the base period.

All operations are pure, with frozen result records and checked numeric inputs.
Native searches can run beyond the period table into mutable player records;
the portable kernel rejects those addresses rather than inventing notes.
The factory can be embedded with `toString()` without imports.

## Validation and remaining work

`test/amcaf-pitch.test.js` checks literal tuned notes, the unusual target stride,
word wrapping, independent vibrato nibble memory, signed phase, input bounds and
standalone factory isolation. These are source-derived vectors, not Amiga audio
captures. The new kernel is not connected to the standard AMOS player.

Arpeggio preserves contiguous-table spill and returns `null` when the native
37-entry search would leave the hardware period unchanged. Out-of-table reads
reject, including speculative shifted reads made before each comparison.

Still required: portamento stepping, row/instrument selection,
volume commands, order flow, owned PCM and repeat descriptors, CIA/VBL scheduling,
shared voice arbitration, bank lifetime guards and browser lifecycle tests.
Instrument-only changes may change repeat pointers without restarting the initial
sample; the host contract must preserve that behavior. Ghostlight's private music
and assets remain outside the public repository. `Pt Play` remains the first
whole-file compilation blocker.

A read-only scan of the supplied private modules found 145 instrument changes
without a note in the game song (zero in the title song), and no instrument
changes accompanying portamento notes. Thus repeat-pointer changes are a real
benchmark requirement, not merely a hypothetical compatibility concern. These
counts describe encoded order traversal, not a completed playback trace.
