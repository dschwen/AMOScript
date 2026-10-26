# Sample playback and music-extension subset

Wonderland's five distinct music-extension encodings now decode and execute:
`Led Off`, `Sam Bank`, `Sam Loop Off`, two-argument `Sam Play`, and masked
`Sam Stop`. The original first fifteen source lines execute through bank loading
and sample setup. The extended title fixture now runs 64 lines; the complete
program now compiles and runs/renders a bounded first-level loop for two nominal seconds. The original menu now runs
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

## Live game sound session

The [live Wonderland demo](../demos/wonderland-game.html) now connects its original
sample commands to Web Audio. Enable sound is an explicit user gesture; Mute
silences current voices. No live context is constructed during the automatic
replays. Three additional offline comparisons exercise the original collectible,
death and game-over commands, including the game's simultaneous left/right mask.
See [the live-game evidence](wonderland-game.md#original-game-sound).

`lib/amos/browserAudio.js` exports `createBrowserAudioSession(createHost, createContext)`.
Pass the existing `createWebAudioHost`; `createContext` defaults to constructing
an AudioContext and is injectable for lifecycle tests. The session owns that
context, unlike the lower-level host which leaves its caller's context open.

- `bind()` silences/replaces the previous program binding and returns the ordinary
  synchronous `{command}` adapter for factory option `audio`. Old bindings become
  inert; muted execution still updates the pure AMOS controller normally.
- `enable()` creates/resumes the context before its first await, so call it from
  a user action. It resolves to success/failure and reports errors through status.
- `mute()` stops voices and invalidates pending activation. Effects received while
  muted/suspended or before initial activation are dropped; enabling does not replay
  old samples.
- `status()` reports activation, context state and owned voice/sample counters.
- `dispose()` invalidates bindings/activation, disconnects nodes and returns a
  promise for closing the owned context. Repeated disposal is safe.

The live page keeps AMOS timing independent of sound activation. API absence or
activation rejection can leave the game silent with a visible sound status.
Synchronous playback adapter failures retain the ordinary VM failure/cleanup
contract. Restart preserves the user's enabled/muted choice while replacing the
program binding. Stop/Resume never replay interrupted AMOS samples.

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
sample-bank forms remain open. Remaining Wonderland paths and validation are recorded in [its milestone plan](wonderland.md).

Unverified slot-1 Sam Play base tokens (`0x00de`, count cache 0) now resolve
one/two/three numeric operands to these existing checked operations, as required
by original Roller II 624/636. Explicit cached overload arities remain strict.
The decoder preserves its field named `reference`; native verification uses this
byte for the parameter-count cache in these tokens. See [input source forms](roller2-input.md).

The separate [finite Boom synthesis contract](boom.md) now supports source-derived
four-voice noise/envelope PCM without a sample bank. Its float PCM path, explicit
portable beam choices and native capture/live-control limits are separate from
the existing signed-byte Samples records.
