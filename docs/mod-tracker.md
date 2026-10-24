# MOD loading and tracker foundation

`lib/amos/mod.js` now decodes bounded four-channel, 31-instrument `M.K.` files.
It validates the header, order table, pattern/sample extents, instrument indices,
volumes, finetunes, loops and exact file end. Files above 16 MiB, alternate channel
signatures, 15-instrument variants and trailing data reject explicitly. Loop
lengths zero/one word are inactive; an active loop must fit its sample. Empty
sample headers remain valid. Restart is preserved as raw metadata; it is not
interpreted as a playback instruction.

The highest pattern across all 128 order slots determines sample placement,
matching AMOS Track Play's address calculation. The reader preserves note
periods, effects, unsigned sample-header volume, signed finetune and owned signed
8-bit PCM. It neither mutates input bytes nor aliases Node Buffer/subarray input.
This is a file reader, not a tracker player, mixer or Web Audio command stream.

`node tools/audit_mod.js examples/Roller2/music/mod.Roller_II_mus` reports the
actual module structure and effect inventory. Its twelve patterns and 22 orders
reference ten nonempty instruments, with 70,634 PCM bytes after offset 13,372.
The target effects are `Cxx` (491 cells), `Axx` (337), `E01` (21), `F07` (12)
and `D00` (one). Zero-effect/zero-parameter cells are omitted from those counts.

## Implemented AMOS commands

Music extension slot 1 registers only these new implemented offsets:

| Offset | Form | Portable behavior |
| --- | --- | --- |
| `$026e` | Track Loop On | Per-program loop configuration enabled |
| `$0282` | Track Loop Off | Per-program loop configuration disabled |
| `$02ba` | Track Load filename,bank | Raw synchronous file bytes into a chip data bank named `Tracker `, followed by 32 zero workspace bytes; selects the destination bank |

`Track Load` accepts bank numbers 1–65535 and files up to 16 MiB through the
existing synchronous byte-string adapter. It deliberately does not parse the
file: native Track Load likewise stores raw data. The strict MOD reader can be
applied to the file portion separately. Host read/type failures leave the old
bank and selection unchanged in this portable subset; native intermediate
selection/allocation-failure behavior is not emulated. Successful replacement
retires old virtual addresses through the established bank installer.

Generated modules embed these operations without imports, and each factory owns
its tracker selection/loop state. Track Play and Track Stop remain unsupported
extension encodings; loop configuration is not silently presented as playback.
AMOS Music-bank `Music`/`Mvolume`/`Music Off` commands remain separate work.

Offsets and normal bank/loop behavior follow the pinned original
[`+Music.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/extensions/%2BMusic.s)
and [`src/ext/music.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/ext/music.cpp).
The literal sparse MOD fixture is independent of any production encoder. Unit
tests cover malformed headers/payloads, ownership, unused order slots, exact
original data, typed command arguments, bank replacement and instance isolation.
The browser demo executes the original sample-load line and leading Track Load
statement, with an explicit End before the unimplemented remainder.

## Next: the AMOS player, not just a modern MOD library

Use a pure four-voice controller with a driver-owned field-clock wake, independent
of requestAnimationFrame. Extend the existing audio host with sample loops,
per-voice volume and period updates; starting a new sample every tick would
incorrectly restart its phase. Coordinate tracker and Sam Play ownership of the
same four voices. Track Stop, Stop/Resume, failure, bank replacement and factory
isolation must cancel/reconcile work predictably.

The original player differs from modern ProTracker defaults: F commands clamp
to speed 1–31 rather than selecting BPM, D commands break to the next pattern
without a row operand, and E commands manipulate the filter bit. Track Play
ignores its optional pattern argument, starts with speed six, zeroes sample
finetunes and writes a zero long at each sample start in mutable bank storage.
Model those source rules explicitly; the reader above preserves original file
bytes. The current target's F07/D00/E01 forms fit that subset. Tick/first-row,
volume-slide, sample-loop and filter behavior need independent expected traces
and native Web Audio comparisons before playback is claimed. Actual AMOS/Amiga
audio captures remain a later validation gate.
