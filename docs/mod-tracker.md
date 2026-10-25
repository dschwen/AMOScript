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

Music extension slot 1 registers these implemented tracker offsets:

| Offset | Form | Portable behavior |
| --- | --- | --- |
| `$026e` | Track Loop On | Per-program loop configuration enabled |
| `$0282` | Track Loop Off | Per-program loop configuration disabled |
| `$02ba` | Track Load filename,bank | Raw synchronous file bytes into a chip data bank named `Tracker `, followed by 32 zero workspace bytes; selects the destination bank |
| `$0296` | Track Play | Play the last Track Load destination |
| `$02a8` | Track Play bank | Play a named chip Tracker bank |
| `$02b0` | Track Play bank,pattern | Evaluate numeric arguments; the original player ignores the pattern argument |
| `$025e` | Track Stop | Stop an active tracker and all four shared voices; inactive tracker is a no-op |

`Track Load` accepts bank numbers 1–65535 and files up to 16 MiB through the
existing synchronous byte-string adapter. It deliberately does not parse the
file: native Track Load likewise stores raw data. The strict MOD reader can be
applied to the file portion separately. Host read/type failures leave the old
bank and selection unchanged in this portable subset; native intermediate
selection/allocation-failure behavior is not emulated. Successful replacement
retires old virtual addresses through the established bank installer.

Generated modules embed these operations without imports, and each factory owns
its tracker selection, loop and playback state. The bounded Track Play form takes
banks 1–65535 with the exact MOD-plus-32-workspace layout above; raw addresses and
other layouts reject. Track Play validates the module and supported effects
before replacing playback or mutating bytes. It then writes the original zero
longs at sample starts and clears sample finetunes in the mutable bank itself.
Explicit Track Play does not change the default bank selected by Track Load.
AMOS Music-bank `Music`/`Mvolume`/`Music Off` commands remain separate work.

Offsets and normal bank/loop behavior follow the pinned original
[`+Music.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/extensions/%2BMusic.s)
and [`src/ext/music.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/ext/music.cpp).
The literal sparse MOD fixture is independent of any production encoder. Unit
tests cover malformed headers/payloads, ownership, unused order slots, exact
original data, typed command arguments, bank replacement and instance isolation.
The load-inspector demo executes the original sample-load line and leading Track Load
statement, with an explicit End before the unimplemented remainder.

## Field-driven player subset

`lib/amos/tracker.js` now provides a pure, manually field-stepped controller for
decoded modules. It emits existing four-voice audio commands, with partial sample
loops and phase-preserving volume/rate updates supported by `webAudio.js`.
The supported effects are empty `000`, C volume, A volume slide, E filter,
F speed and D pattern break. Other effects reject with pattern/row/channel
context before any audio dispatch. This is intentionally bounded to the target's
effect inventory; arpeggio, portamento, vibrato and position jump remain open.

The first row executes on field six. Later rows use the current speed; A slides
run on intervening fields, with the upper nibble taking precedence and volume
clamped to 0–64. Instrument-only rows reset volume without restarting the sample;
notes without instruments reuse the selected instrument. E uses the parameter's
low bit (one disables the filter), F clamps to 1–31, and D ignores its row operand.
Finetune is ignored. The controller applies the native zero-long sample-start
writes to owned concatenated PCM, including spill through short/empty records.
Original decoded PCM and bank bytes remain unchanged in this direct-player API.
On a repeat offset, the initial fetch ends at the repeat end. One-word repeats
play the zeroed silent word. Sample DMA activation/reload within a field is an
approximation, not cycle-accurate Paula behavior.

The source's raw restart byte is preserved. Roller II stores 120, so looping
visits order slots 120–127 (all pattern zero), then wraps to zero. It does not
immediately restart at zero as many modern players would. Restart bytes above
127 fail when reached. Loop Off stops after 22 orders / 1,376 rows / 9,631 fields:
six initial fields plus 1,375 intervals at speed seven. Literal-cell tests cover
first-row delay, slides, speed clamps, filter, break, instrument reuse, PCM
ownership, stop/failure and instance isolation. These are source-derived traces,
not Amiga recordings.

[Play the original tune](../demos/tracker.html) directly with Play/Stop controls.
The shared browser scenario traverses the whole song without audio, then compares
a partial sample loop and mid-play volume/rate change against an independent
native OfflineAudioContext graph. It also compares every original instrument's
PCM, stereo route and repeat against native graphs made from independently read
raw sample headers/bytes. All ten instruments must produce nonzero output.
An independent raw-cell audit checks all 1,997 triggers (channel counts
1,108 / 226 / 80 / 583), including field, instrument, period and volume.

The initial adapter incorrectly used Web Audio's loop end for both the initial
fetch and repeat. Six instruments (1, 2, 5, 6, 7, 10), covering 1,276 triggers,
have a zero-offset one-word silent repeat. That made them loop over silence
before their sample bodies could sound. The adapter now appends the repeat PCM
after the full initial fetch when necessary, then loops only that appended
region. A single source preserves phase through rate/volume updates. Eleven
native graph comparisons cover all ten original instruments plus a non-silent
short repeat and voice updates. A twelfth comparison verifies that the compiled
original Track Play statement reaches Web Audio with the opening note's PCM,
period, volume and stereo route. Both pure-controller and generated-VM traces
match all 1,997 notes. These verify portable Web Audio behavior, not
Amiga audio capture parity.
The audible demo starts only on a click and runs a standalone compiled VM with
the bounded original load statements, Led Off (bytes 56–62) and Track Play 22
(394–406). A synthetic Wait Key keeps it alive. TRUE, Track Loop On and other
startup/gameplay statements remain outside this fixture. The demo offers one
song traversal, Pause/Resume and Stop; cleanup closes its voices and context.

## Driver clock, lifecycle and shared voices

The driver owns a separate wake for each next global VBL, independent of
requestAnimationFrame, VM instruction budgets, Wait/Wait Key, Timer assignments
and sleepScale. PAL/NTSC tests cover the field phase and separate audio-clock
choice. Natural song end leaves the waiting VM alive. End/failure cancel music,
palette and VM wakes and silence voices; asynchronous errors retain the starting
Track Play location. Ownership tokens make late callbacks inert even without
clearTimeout. Catch-up is limited to 250 fields per advance; larger stalls halt
with source context. Smaller timer stalls can still jitter/batch host audio
commands: sample-accurate scheduling and hardware captures remain open.

Host Stop cancels wakes, freezes the sequencer and silences audio. Resume rebases
the next field on the current global clock without replaying elapsed notes.
Held sample phase is not restored: sound resumes on subsequent note triggers.
This is an explicit host pause policy, separate from native Track Stop.

Sam Play and the tracker route through the same audio controller and four voice
identities. Samples replace the selected current voices; tracker nonzero held
periods and volume slides write those voices on later fields, and subsequent
notes replace their PCM again. Sam Stop leaves the sequencer running. Sam loop
configuration affects sample-owned voices and future samples, preserving tracker
repeat regions. LED/filter state is shared across both sources. Exact sample
interrupt/DMA contention, zero-period hardware writes and phase restoration
after host pause remain outside this portable subset.

Playing bank identity survives Swap. Replacement, erasure or actual shrink stops
the tracker before invalidating storage. The controller decodes an owned snapshot;
live pattern/PCM editing is not supported, so Poke/Bload into an active Tracker
bank reject before writing. Track Stop first to edit and replay. Direct external
mutation of the exposed banks map/data is outside the runtime command contract.
Per-factory tests verify independent players, PCM, defaults and timers.

## Remaining player gates

The original player differs from modern ProTracker defaults: F commands clamp
to speed 1–31 rather than selecting BPM, D commands break to the next pattern
without a row operand, and E commands manipulate the filter bit. Track Play
ignores its optional pattern argument, starts with speed six, zeroes sample
finetunes and writes a zero long at each sample start in mutable bank storage.
Model those source rules explicitly; the reader above preserves original file
bytes. The current target's F07/D00/E01 forms fit that subset. Tick/first-row,
volume-slide and sample-loop behavior now have bounded source-derived traces
and twelve native Web Audio control-graph comparisons. Hardware DMA/filter
response, wider effects and whole-game music integration remain gates. Actual AMOS/Amiga
audio captures remain a later validation gate.
