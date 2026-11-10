# AMCAF Protracker VM integration

The `amcaf-1.50beta4` compilation profile now registers four statements:

| Offset | Statement | Portable subset |
| --- | --- | --- |
| `$108e` | `Pt Play bank` | Checked chip `Tracker ` bank produced by Track Load |
| `$10a8` | `Pt Stop` | Stop the owned AMCAF player and cancel its wake |
| `$10c6` | `Pt Volume value` | Native signed-long/low-word clamp; delayed register latches |
| `$10f2` | `Pt Cia Speed value` | Zero selects VBL; 32..255 select CIA tempo |

Slots remain explicit and relocatable, for example `--extension
8=amcaf-1.50beta4`. The cached two-argument Pt Play overload, native raw addresses,
M!K! files and other bank forms remain gated. This does not alias AMOS Track Play:
finetunes, PCM bytes and repeats retain AMCAF semantics.

## Clock and rendering

`lib/amos/amcafPlayback.js` connects the tick controller and streaming bridge to
the driver's existing owned tracker wake. It reads the driver's fractional
field clock, including during Wait Key and other waits; it does not use rAF,
instruction throughput or an independent host timer. Normal AMOS Track Play
retains its whole-field behavior. Emitted factories include the five AMCAF
helpers only when their compilation profile is selected.

CIA mode starts at native tempo 125. AMCAF R179 supplies dividend 1,773,447 for
PAL and 1,789,773 for NTSC; the portable profile computes the timer latch with
integer division by BPM. The [Commodore hardware timing example](https://amigadev.elowar.com/read/ADCD_2.1/Hardware_Manual_guide/node02E1.html)
gives CIA clocks of 709,379/715,909 Hz, and its
[interrupt specification](https://amigadev.elowar.com/read/ADCD_2.1/Hardware_Manual_guide/node0142.html)
defines timer underflow as counting past zero. The implemented interpretation
therefore uses `(latch + 1) / frequency` per interval. It models reload and ISR
ordering, not bus cycles, resource allocation or measured interrupt latency.

A timer reload happens before that tick's row effects. An Fxx tempo change in
the ISR updates the following reload; the already loaded interval remains.
An explicit Pt Cia Speed while CIA mode is active changes the pending latch,
retaining the current deadline. Switching mode rebases the next deadline;
VBL mode always uses the next global field boundary. Fxx still changes the
reported tempo in VBL mode but not its interval. Only the checked speed range
above is supported; unusual native signed-word/wrapped forms reject.

PCM is rendered for elapsed intervals before applying the next tick. Output
frame counts use cumulative time and one floor operation, avoiding the drift
from rounding every fractional interval separately. The stream renderer uses
48 kHz in the VM. The browser adapter's buffering adds output latency; computed
music/fetch phase is not a claim of exact audible phase at Stop. Pause freezes
the computed controller and fetch cursors. Resume keeps that state and opens a
fresh host timeline, rebasing deadlines to the current field clock. Catch-up
rejects gaps over five seconds or more than 250 ticks in one advance.

## Ownership and failure

A valid Pt Play replaces the existing tracker only after module/player
validation. The native routine stops first; preflight-before-replacement is the
portable error policy. Pt Play during AMOS Music rejects. AMOS Track Play can
replace AMCAF through ordinary tracker cleanup; Pt Stop during standard Track
Play rejects. Standard sample/voice commands during AMCAF are explicitly gated
until Pt Sam/Raw ownership is implemented.

The active bank uses the shared Tracker identity and checked bank-memory guard.
Poke/Bload/bulk writes reject while playing. Replacement, erasure and shrink
stop playback and cancel its wake. Unlike standard Track Play, AMCAF does not
zero sample prefixes or clear finetunes in the bank. Bank bytes remain unchanged.
The bounded profile owns decoded PCM; mutable active-bank audio is not claimed.

`state.tracker.engine` identifies `amcaf`; its `position` is a frozen clock/player
snapshot. Pt Volume persists between songs in the factory and updates controller
state without immediately rewriting latched output volumes. Pt Cia Speed's mode
persists; a new Pt Play initializes tempo 125, like the recovered player.

Stop, End, failure and bank retirement use existing driver cleanup. A host can
synchronously Stop during a PCM callback: the clock freezes immediately and
defers the stream's Pause until the in-flight render returns. It cannot execute
another old tick afterward. A retired player cannot overwrite a replacement's
state. Startup notifications are also checked for Stop/retirement before the
new player commits. Audio errors from later wakes retain the original Pt Play
line/byte location and cancel all owned work.

## Browser application and validation

The page builder detects the AMCAF profile and includes the composed streaming
host automatically. Existing pages without that profile keep the standard host
and its gain. Gesture activation, mute, fullscreen, Stop/Resume, Restart and
retired program bindings use the existing application session. The compiler
module remains browser-independent and runs without an audio adapter.

[demos/amcaf-vm.html](../demos/amcaf-vm.html) embeds a synthetic compiled AMOS
application built with the normal page builder. It uses Track Load, Pt Play,
Wait Key and Pt Stop. The native audio check compares its opening 128 samples
against independently addressed sample bytes and a direct phase formula; maximum
difference is zero. Browser interaction checks verify actual source starts,
Stop/Resume, Restart and disposal in the generated application. No private game
source/assets are included.

Unit tests cover standalone modules without require, relocated token profiles,
PAL/NTSC fractional deadlines, cumulative output frames, reload timing, VBL mode
changes, volume latches, unchanged banks, active writes, erasure, host Stop and
source-located failure cleanup. This is portable/source-derived evidence and
native Web Audio delivery, not an Amiga execution capture.

Both private modules were also run inside the synthetic compiled harness through
their first native end signal using the default PAL CIA clock: 1,536 ticks /
1,474,603 output frames for the title and 5,376 ticks / 5,161,112 frames for the
game tune at 48 kHz. Each tick emitted one block, bank bytes remained unchanged,
and Stop left no pending wakes. These are original music modules in a declared
synthetic AMOS harness, not original full-game execution or independent captures.

The complete unchanged Ghostlight source now compiles with all 18 extension
encodings. [Amos Pri/Raster Wait](extension-timing.md), [Smouse Key](smouse-key.md),
[Pt Sam Stop](amcaf-sample-stop.md) and [Pt Raw Play/Pt Sam Bank](amcaf-raw.md)
all have bounded implementations. [Interlaced Unpack Screen](interlaced-unpack.md)
now creates the atlas and the private WebGL page reaches level 1 with music.
A bounded input check uses a match without an error; sustained gameplay and
completion remain unverified.
