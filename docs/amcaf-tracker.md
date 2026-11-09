# AMCAF Protracker implementation

AMCAF `Pt Play` uses a different player from AMOS `Track Play`. The implementation currently consists of a pure pitch kernel in
`lib/amos/amcafPitch.js` and a tick/row controller in
`lib/amos/amcafSequencer.js`, plus a portable repeat-aware PCM renderer in
`lib/amos/amcafPcm.js`.
These are not registered as `Pt Play` yet and do not start sound or own timers.

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

Still required: VM integration of the streaming adapter, CIA/VBL scheduling,
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

## Tick and row controller

`createAmcafSequencer(decodedModule, createAmcafPitch)` owns copies of pattern
cells, order slots, instrument descriptors and PCM. It deliberately does not run
AMOS Track Play's destructive sample-prefix and finetune preprocessing. All
patterns, including unused ones, are checked before ticking. Supported effects
are 0, 1, 2, 3, 4, 5, 6, A, B, C, D and F; other effects and B parameters above
127 reject. Sample lengths and repeat ranges are checked; empty instruments
produce zero-length DMA intents rather than unchecked memory reads.

The first row is read at tick six. Intervening ticks advance effect state.
Portamento retains its speed but consumes a new 3xx speed only on the first
intervening tick. Effects 5xy and 6xy reuse portamento/vibrato memory while
applying their own volume slide. New ordinary notes reset vibrato phase;
portamento notes do not retrigger DMA. F00 is ignored; F01..1F change speed and
F20..FF change the reported BPM. B/D flow follows channel processing order;
D uses BCD row conversion, with values above 63 resetting to row zero. Song wrap
returns to order zero, independent of the MOD restart byte. The `ends` counter
also records native Bxx backward-jump end signals; it is not a stop command.

`setVolume` preserves AMCAF's signed-long/low-word clamping and does not rewrite
held hardware volumes immediately. Each voice retains separate base period,
output period, logical volume and output volume. Ordinary empty-effect ticks,
instrument selection and volume effects write volume; pitch-only effects can
leave an older master-scaled volume sounding until a later native volume write.

Each `tick()` returns frozen source-position metadata, a frozen state snapshot,
new-note `triggers`, and row-end `repeats` in reverse channel order. Repeat
records are returned even for channels with no new note. They describe a new
repeat pointer/length, not a request to restart a sample. New-note initial fetches
end at the repeat end when repeat offset is nonzero; otherwise they fetch the
whole instrument before repeating. One-word repeats retain their original bytes.
`sample(number)` returns a defensive PCM copy. Stop is terminal and ticking a
stopped controller returns null. Pitch failures stop the controller and retain
the executing tick/order/row in their error. No host callbacks or timers run.

`test/amcaf-sequencer.test.js` checks synthetic source-derived tick sequences,
combined effects, register latches, independent factories, standalone embedding,
pattern preflight, terminal failure and owned PCM. It does not compare audio
output against an Amiga or prove timing parity.

## Read-only external music check

Run `node tools/check_amcaf_music.js /path/to/title.mod /path/to/game.mod` to
advance external modules through their first native end signal. The tool caps
execution at one million ticks, reads files without copying them into the
repository, and prints module/trace hashes and intent counts. Its trace hash is
a JavaScript regression fingerprint, not an independent correctness oracle.

For the supplied Ghostlight modules:

| Module SHA-256 | Ticks | New-note intents | Instrument-only repeat changes | Next order/row |
| --- | ---: | ---: | ---: | --- |
| `9a2e74239eff2a2aa2380adc69c60efe6014acba2108aaf42f6901801acffbe2` | 1536 | 58 | 0 | 0/0 |
| `8539d1c2b2376928cd79f0aaa1241737f11e5cb1ea6d1dfa48dbe836a821ead5` | 5376 | 1153 | 145 | 2/0 |

The game song's B03 jumps back to order 2. Its entire 14-order first pass is
covered by the trace. These checks exercise sequencer execution, not Web Audio,
CIA scheduling, AMOS VM integration, browser playback or game completion.


## Repeat-aware PCM rendering

`createAmcafPcm(samples, {sampleRate, standard})` owns signed PCM copies and four
independent fetch cursors. Apply a sequencer frame at its tick boundary with
`apply(frame)`, then render elapsed output frames with `render(count)`. The
caller supplies time; the renderer starts no clocks, timers or host callbacks.
It can be embedded as a standalone factory without imports.

A note trigger latches an initial sample and length and resets only that voice's
cursor. A repeat intent updates its pending sample/start/length. It leaves the
currently fetched region intact, including when that region is already a loop.
At the next region boundary, fetching switches to the latest pending repeat and
carries fractional sample progress into it. Thus an instrument-only change can
switch from one instrument's repeat to another's without replaying either
instrument's attack. A later pitch change adjusts the advance rate without
resetting cursor position. Muting still advances the cursor. Zero repeat length
finishes the current fetch and then silences it; an empty note trigger silences
immediately. Nonzero one-word repeats preserve and play their actual two bytes.

The portable profile uses sample-and-hold output with PAL/NTSC clocks
3,546,895/3,579,545 Hz divided by the output period. It sums voices 0/3 into left
and 1/2 into right, with one-half gain per voice to keep each stereo pair bounded.
Volume uses the controller's latched output volume, not the current master knob.
This is not cycle-exact Paula word prefetch, DAC reconstruction or analog filter
emulation. Active period zero is explicitly rejected pending a verified hardware
contract; inactive voices can retain zero periods. Complete intents and register
values are checked before any pointer/register mutation. Duplicate voice intents,
invalid regions and nonmonotonic tick numbers reject. Render calls are bounded
at 1,048,576 output frames; stopping is terminal and subsequent renders are silent.
Changing render chunk sizes preserves the resulting PCM and cursor state.

`test/amcaf-pcm.test.js` checks these transitions with independently transcribed
sample bytes, pitch/volume changes, terminal cleanup, input ownership and
standalone embedding. The [browser preview](../demos/amcaf-pcm.html) runs eight
PAL/NTSC voice-routing comparisons against an independent absolute-phase formula
and delivers that output through native OfflineAudioContext stereo graphs.
It also offers Play, Pause/Resume and Stop controls for a live synthetic music preview.
Its explicit 50-Hz clock is a VBL preview, not a claim of CIA timing or AMOS VM
integration. Repeated Play, Stop, disposal and page exit retire owned sources and
contexts. No Ghostlight assets are included in the page.

Both private modules were additionally rendered locally at 8 kHz with 160 output
frames per sequencer tick through the first end signal: 245,760 frames for the
title and 860,160 for the game. Both channels had nonzero energy and finite PCM;
peak magnitudes were 0.3125 and 1 respectively. This is a bounded VBL-clock
execution check, not independent musical parity, live game audio or a native
capture. The existing AMOS Web Audio adapter and standard Track Play remain
unchanged. The live streaming bridge is now implemented separately; VM scheduling and
shared music/SFX command ownership remain the next integration steps. See
[audio streaming](audio-streaming.md) for the per-voice protocol, queue bounds,
eleven native browser comparisons and current timing limits.
