# Synthesized Boom

Slot-1 Music extension offset `$0074` now compiles its no-argument Boom command
through the ordinary extension AST/IR/runtime path. It needs no sample bank and
does not change Sam Bank, Sam Loop or Led state. The [audible demo](../demos/boom.html)
compares each voice and the combined stereo mix against independent PCM before
exposing gesture-controlled Play and Mute/Stop buttons.

## Source model and portable choices

The implementation follows AMOS-Professional-Official revision
`efddf2c9a09bf61a45b7b096a9be84630853c2b1`, `src/ext/music.cpp` Shout,
play_voice/play_sample, noise initialization and EnvBoom, plus
`src/ext/music_play.cpp` env_next and ext_music_vbl. `extensions/+Music.s`
records the exact no-argument token. This is source analysis, not native reference
execution or an Amiga audio capture.

Shout starts voices 3,2,1,0 with notes 36,37,38,39. The integer note-frequency
calculation gives 1122,1190,1259,1336 Hz; Paula-clock division gives PAL periods
3161,2980,2817,2654. NTSC uses its separate clock. Noise initialization fills 255
big-endian words. Each active VBL replaces eight words backwards through that
shared 510-byte buffer. The source recurrence wraps the seed-plus-beam to a word,
multiplies by `$3171`, shifts eight and retains a word. Noise mutation and musical
Rnd have independent state.

The native beam is not reproducible from a browser clock. This bounded renderer
uses a constant word: options `audioNoiseSeed` (default 0) and `audioNoiseBeam`
(default `$0101`) must be integers 0–65535. These are explicit portable choices;
zero seed/beam produces silence. The noise state belongs to each factory and
advances lazily against the injected field clock, bounded by the finite active
envelope. Repeated Boom calls continue the owned noise history. Snapshots and
host PCM are copies; observing them does not alter a later onset volume. Other play/stop masks retire the replaced noise voices.

EnvBoom is `{1,64,10,50,50,0,0,0}`, with the supported default voice volume 56.
The controller follows signed integer division and the source's fixed-point
fraction resets between stages. Its goals are 56 after one field, 43 over ten
fields and 0 over fifty fields. The initial hardware volume is retained until
the first VBL; existing play/voice commands supply the remembered channel volume.
The last envelope field stops noise regeneration before another eight-word update.
Sam Loop commands exclude Boom voices and cannot loop the finite effect.

Each voice renders its bounded initial 510-byte fetch as 44.1-kHz float PCM,
using sample-and-hold reads from the appropriate field's noise buffer and integer
envelope volume. The onset's fractional field phase is included. The browser
adapter copies normalized finite float samples into its AudioBuffer, using the
existing stereo routing, filter and owned-voice replacement. Existing signed-byte
sample/MOD PCM retains its original conversion. Invalid float PCM rejects before
replacing current voices. Browser audio continues asynchronously while AMOS waits;
no requestAnimationFrame clock or silent command placeholder implements playback.

This is a finite portable synthesis contract. Exact Paula fetch/interrupt-tail
behavior, live beam values, analog reconstruction and DMA scheduling remain open.
The baked effect is not a general mutable wave/envelope engine. Live external
rate/volume changes during a baked Boom use the existing host voice controls and
are not claimed as native envelope/Tracker restoration parity. There is no
phase-restoring resume of held effect samples: host Stop, End/failure, replacement
and disposal silence/cancel them, as with existing held sample effects. Resume
does not replay a queued Boom. The retained script-based driver can still run without loading the optional
Boom renderer; requesting Boom then reports the missing script explicitly. Generated
modules always embed it and need no imports. General Bell/Shoot/Play/Wave/Envelope commands and
The separate [AMOS Music player](amos-music.md) now supports the end tunes.

## Evidence

`tools/reference/boom.py` independently uses Python integer arithmetic and
Fractions to transcribe the noise, pitch and envelope equations. It writes PAL,
partial-field and NTSC hashes, all 62 logical envelope levels, and four default
little-endian float PCM files. Five headless groups verify every PCM hash,
standalone execution without imports, masks and state, per-factory history,
owned snapshots, finite loop behavior, configuration bounds and source-context
failure cleanup. Synchronous host Stop or a newer Boom invalidates pending older
voice starts, preventing stale voices after cancellation. The native Web Audio probe compares the four separate voices
and combined stereo output against independently built control graphs using
those files; it also checks Stop/disposal silence and invalid-float rejection.
Those are browser graph comparisons, not Amiga captures.

Boom removed the earlier full Roller II compiler gate at line 161. The complete
source now compiles with all 194 encodings recognized. That does not establish
full gameplay. The [arrow fixture](roller2-arrows.md) includes original PFEIL's
Boom timeout rather than omitting that branch.
