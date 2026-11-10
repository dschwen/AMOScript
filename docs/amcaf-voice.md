# AMCAF voice control and raw module banks

[Play Hawkeye](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-hawkeye.html)
loads the original packed module from the AMCAF distribution in a declared
compiled harness. Press keys to disable voice 1, re-enable it, then stop.
The original Protracker interfaces now compile their status/VU queries but still require core formatting and graphics;
this harness is not counted as a second completed original example.

## Banks and validation

`Pt Play bank` accepts a complete four-channel `M.K.` MOD in a generic chip bank.
`Imploder Load file$,-bank` and `Wload file$,-bank` therefore feed playback directly.
Existing Track Load banks retain their exact MOD-plus-32-workspace convention.
Fast-memory banks, object banks, raw address selectors and the alternate `M!K!`
signature remain outside this subset.

Decode/player construction completes before replacing the current player. A bad
module leaves the old music and bank identity intact. Valid playback captures
owned pattern/sample data, preserves all source-bank bytes, and protects the
actual bank identity against Poke/Bload/bulk writes. Bank replacement/erasure/
shrink stops playback through the existing ownership boundary. No Work bank is
renamed or padded to impersonate Track Load output.

## Pt Voice

The recovered R106 routine at `$60c2` uses four bits to enable music voices.
It clears Paula DMA and volume for every excluded voice, and stores four user
flags. The tick routine at `$8b90` combines those flags with raw-effect ownership;
register/DMA writes test that combined mask. The implementation retains the low
four bits of the AMOS integer, including negative and larger positive values.
The per-program mask starts at 15 and persists across Pt Stop and new Pt Play.

The driver-clocked player renders elapsed PCM before applying the command,
including a fractional field. It leaves the tick deadline, order, row and effect
processing running. Disabled voices stop fetching and stop accepting music
register/DMA intents. Re-enabling permits later writes but does not restore a
previous sample phase: another actual note trigger is required. Instrument-only
rows and portamento notes do not restart the voice. A disabled Cxx does not store
its volume, matching the conditional native path at `$93d0`.

Raw effects retain their lease countdown when Pt Voice disables their DMA.
They remain silent until lease expiry; a later explicit raw-play request may
start another effect independently. Pause freezes the song and keeps the user
mask. Resume rebases the host timeline without changing the selected voices.
Filter and PCM host notifications share deferred Pause handling, so synchronous
host Stop cannot re-enter the stream or continue another old tick.

## Additional effects required by Hawkeye

The supplied module needs E0 and EA, alongside previously implemented effects.
The shared fine-volume-down branch EB is also implemented and checked.

- E0 uses parameter bit zero: zero enables the filter, one disables it. The
  native global filter write repeats on intervening ticks and remains independent
  of the per-voice music mask. Filter intent goes through the existing audio
  controller/host, updating the shared flag and Web Audio filter routing.
- EA and EB add/subtract the low parameter nibble once on the row tick, clamping
  volume to 0..64. They update stored volume even while a voice is disabled;
  hardware output remains gated. They do not repeat on intervening ticks.
- Other E effects still reject during module validation, including in unused
  patterns. The change does not silently treat unknown effects as no-ops.

The browser filter is the existing portable low-pass approximation, not a
measurement of Amiga analog circuitry. Source timing, native Web Audio graphs
and original-hardware captures are distinct forms of evidence.

## Verification

[Run the browser checks](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-voice.html).
Four native offline Web Audio graphs compare closed-form constant-wave stereo
mixes before disabling, while disabled, after re-enabling without a trigger, and
after the next trigger. Partial-field flushing and uninterrupted music ticks are
checked separately. The reported maximum difference is zero for those graphs.

The original packed module validates and completes its first wrap: 62,068 decoded
bytes, 19,202 ticks, 6,653 note triggers and four filter writes. These counts also match the independent Python order/cell audit in
`tools/reference/check_amcaf_hawkeye.py`, whose input must match the pinned
expanded-module digest. It checks 75 orders, 4,800 rows, timing, note triggers
and filter writes without importing the JavaScript player. This is structural
source evidence, not native timing/audio captures. The actual page is also exercised with real Play/key/Stop/Resume input,
WebGL, the compiled bank loader and voice commands, and owned disposal.

Unit checks cover malformed module preflight, active Work-bank write protection,
mask persistence across songs, Pause/Resume, raw-lease silencing, row-only fine
volume, muted Cxx, and synchronous host Stop during both PCM and filter callbacks.

The application sound button reflects the actual AudioContext state. A failed or
suspended activation offers **Enable sound** and retries on one click; only a
running session offers **Mute sound**. Startup checks audio again after the
fullscreen transition. Dropped suspended PCM invalidates the old host timeline
before current audio resumes, preserving frame continuity without replaying
missed blocks. Browser checks assert non-silent source scheduling on the initial
Play and after prepared activation refusal and context suspension.
