# Sample playback and music-extension subset

Wonderland's five distinct music-extension encodings now decode and execute:
`Led Off`, `Sam Bank`, `Sam Loop Off`, two-argument `Sam Play`, and masked
`Sam Stop`. The original first fifteen source lines execute through bank loading
and sample setup. The extended title fixture now runs 64 lines; the complete
program still stops at `Using` on line 285. The original menu now runs
with keyboard/gamepad controls in a [declared fixture](joysticks.md).

## Source and token contracts

The bounded `$004e` extension token contains a slot byte, internal reference byte
and big-endian offset word. `lib/ExtensionTable.js` records only implemented
slot-1 Music commands. The decoder preserves these fields and the original
physical source location. Unknown slots, unimplemented offsets and truncated
payloads reject; diagnostic metadata never enables commands automatically.

| Music offset | Supported form |
| --- | --- |
| `$008a` | `Sam Bank bank` |
| `$009a` | `Sam Loop On` (all voices) |
| `$00b4` / `$00c6` | `Sam Loop Off` / `Sam Loop Off mask` |
| `$00de` / `$00ee` / `$00f8` | `Sam Play sample` / `Sam Play mask,sample` / `Sam Play mask,sample,frequency` |
| `$01ca` / `$01d6` | `Led On` / `Led Off` |
| `$0246` / `$0256` | `Sam Stop` / `Sam Stop mask` |

The source table's `$00ac` masked-loop-on entry declares no argument while its
handler reads one. That inconsistent encoding remains rejected pending reference
verification. The host/runtime `samLoopOn(mask)` method supports a checked
numeric voice mask without claiming that source encoding is verified.

The original [music-extension source](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/extensions/%2BMusic.s)
establishes selection, descriptor addressing, loop bits, voice masks, clocks and
default volume. `InSamBank` selects a number 1–16 without requiring a loaded bank;
`GetSam` validates it when playing. Default selection is bank 5, loops are off
and default volume is 56/64. Masks select bits 0–3; other bits are ignored.
Starting a voice replaces its current sample. Loop changes affect held sources.

## Sample bank subset

`lib/amos/audio.js` reads a generic data bank whose name starts with `Samp`, as in
the original `GetSam`. Its payload contains a big-endian word slot count and
relative long offsets. A zero offset is an undefined sample. Each supported record
has an 8-byte name, word frequency, long byte length and signed 8-bit PCM data.
Selection is one-based. The reader checks table bounds, word alignment, offsets
outside the table, record/payload bounds, positive frequency and positive even
length. Individual PCM payloads are limited to 16 MiB. Odd lengths and very low
rates requiring a period above 65535 reject explicitly. Data is copied per play;
bank swaps, reloads and edits are observed on the next play rather than cached.

All six original Wonderland records decode: lengths 2048, 2486, 180, 3862, 5148
and 6960 bytes, each named `:Dithell` and stored at 4000 Hz. Playback uses the
source's PAL clock 3546895 or NTSC clock 3579545, integer period
`max(124, floor(clock / frequency))`, and resulting rate `clock / period`.
An explicit `Sam Play` frequency must exceed 500 Hz. Set `audioStandard: 'NTSC'`
for NTSC; the default is PAL, independently of runtime `vblHz`.

## Runtime and browser adapter

Generated modules embed the pure audio controller and require no runtime imports.
Headless execution validates and decodes commands without producing sound.
An optional synchronous `audio.command(event)` host receives `filter`, `loop`,
`play` and `stop` events. Play includes the copied unsigned byte storage of signed
PCM, sample metadata, voice mask, period/rate, default volume, loop mask and filter
state. Invalid/promise-returning adapters fail with source context.

`lib/amos/webAudio.js` exports `createWebAudioHost(context)` through CommonJS or
the browser global `AMOS_WEB_AUDIO`. The caller creates and activates its own
AudioContext from a user gesture, then passes the adapter to the program:

```js
const context = new AudioContext();
await context.resume(); // Inside the user's play/start action.
const host = AMOS_WEB_AUDIO.createWebAudioHost(context);
const program = create({ audio: host, files: preloadedFiles });
program.tick(1000);
// On exit:
program.stop();
host.dispose();
await context.close();
```

Use one host per live program for isolated voices. The adapter converts PCM to
Float32, applies the Paula-derived playback rate and routes channels 0/3 left,
1/2 right, following the [Hardware Reference Manual](https://www.amigarealm.com/computing/knowledge/hardref/ch5.htm).
`Led Off` bypasses filtering; `Led On` uses a two-pole Web Audio low-pass with a
default 3300 Hz cutoff (configurable `filterFrequency`). That cutoff/response is
an approximation, not a measured Amiga analog circuit model. Web Audio's native
resampling likewise does not reproduce Paula's DAC or exact interrupt timing.

Stop, program termination and runtime failures silence voices. Resume continues
execution without restarting interrupted samples. `Sam Stop` can stop selected
voices while the program waits. Disposal is idempotent and disconnects owned
nodes; it does not close the caller-owned context. Cleanup also works after an
OfflineAudioContext finishes and closes. Natural source completion releases nodes.

## Verification and remaining gates

The [independent-byte fixture](../test/fixtures/conformance/music-samples.json)
covers original extension and sample-bank bytes with source-analysis evidence.
Unit tests cover all supported overloads, malformed/truncated records, rate/mask
rules, bank selection, original PCM bytes, isolation, host failures and cleanup.
The original fifteen-line startup fixture tests both absent and preloaded bank 5,
including the unchanged `AMOSPro_Productivity2:Wonderland/...` filename.

The shared browser [music demo](../demos/music.html) compares all six original
samples and stereo channels against independently decoded PCM in native offline
Web Audio control graphs, with a 1e-6 maximum difference. Two additional cases
check looping and disabling a loop; replacement, selected stopping, program Stop
and disposal are checked too. The standalone demo has explicit audition buttons
for all six samples and Stop, exercised in Chromium. No sound starts automatically.
It appears in the [demo index](../demos/index.html) with an
[HTML Preview link](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/music.html).

These are source-derived language and browser-adapter checks, not Amiga audio
captures. Chip/DMA contention, interrupt latency, hardware analog output,
envelopes, volume commands, synthesized effects, tracker music, speech and other
sample-bank forms remain open. Wonderland gameplay still needs the language,
display and input work recorded in [its milestone plan](wonderland.md).
