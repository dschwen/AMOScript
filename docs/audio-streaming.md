# AMCAF PCM streaming bridge

The AMCAF controller and sample fetcher are portable. The stream bridge emits
synchronous, finite, per-voice PCM blocks; the optional Web Audio adapter queues
those blocks alongside ordinary AMOS samples. These components do not themselves register
`Pt Play`; the [VM integration](amcaf-vm.md) now supplies command registration
and driver clock ownership.

## Pure bridge

`lib/amos/amcafStream.js` exports
`createAmcafStream(decodedModule, {sequence, pitch, pcm}, options)`. Pass the
three AMCAF factories and optional `sampleRate`, `standard` and synchronous
`host.command`. No AudioContext, timers or browser APIs are required.

The caller renders elapsed output frames with `render(count)` and applies
sequencer boundaries with `tick()`. Each nonempty render emits:

```js
{
  type: 'pcm',
  stream: 1,             // incremented after Pause/Resume
  frame: 0,              // first output frame, contiguous within this timeline
  sampleRate: 48000,
  mask: 15,              // independently owned Paula channels
  channels: [ch0, ch1, ch2, ch3] // equally sized Float32Array records
}
```

`amcafPcm.renderVoices(count)` advances exactly the same fetch cursors as its
stereo renderer, returning four separate buffers. Each already includes the
latched volume and one-half channel gain. Summing channels 0/3 and 1/2 reproduces
the stereo renderer. Stream render calls cap each block at 65,536 frames.

`setMask(mask)` stops newly disabled host channels. All four sample cursors keep
advancing during future renders, including disabled channels, so a caller can
lend voices to raw sample effects without resetting the music state. Re-enabling
a channel lets its next PCM block reclaim it. AMCAF-specific Pt Sam/Raw command
semantics are still to be integrated and are not inferred from this generic API.

`setVolume` updates the sequencer's master value; its native register latches
still govern when PCM volume changes. Pause silences selected channels and
freezes sequencer/fetch state. Resume retains that computed state while opening
a fresh output timeline at frame zero. Stop is terminal. This preserves computed
phase, not the exact audible phase of already queued lookahead audio.

A host can synchronously Stop from a command callback. Other recursive mutation
or rendering rejects; failures halt the bridge and attempt one stop notification.
Promise-returning sinks reject. Emitted buffers are newly owned output, not views
into the module's sample storage. The factory embeds with `toString()` without
imports, like the underlying controller and PCM renderer.

## Optional Web Audio adapter

`lib/amos/webAudioStream.js` exports
`createWebAudioStreamHost(context, createSampleHost, options)`. Supply the existing
`webAudio.createWebAudioHost` as `createSampleHost`. The caller owns context
gesture activation and closure. Construction and commands are synchronous.

Each selected channel has its own queued native AudioBufferSourceNodes, connected
to the usual left/right Paula pair. A newly received timeline anchors its first
frame at `context.currentTime + latency`; the default latency is 40 ms and can
be set from 0 through 250 ms. Adding a channel to an existing timeline shares its
anchor. Subsequent blocks must be contiguous and retain their sample rate.
New timelines and channel stops retire old sources, including future nodes.

Blocks that arrive late retain the original anchor. Entirely expired blocks
advance the stream position without playing; partial blocks start at the next
remaining sample boundary. The adapter does not replay old chunks or extend the
song to hide an underrun. Pause/Resume or activation after a mute can establish a
fresh anchor because host Stop clears the old queues.

Every block validates all four arrays, PCM values, lengths and timeline metadata
before changing channel ownership. Sample rates are 8–192 kHz and values must be
finite in [-1,1]. The default maximum future buffer end is one second ahead,
configurable from 0.1–2 seconds; each channel also caps at 128 live nodes.
Expired nodes are retired synchronously even if native `onended` delivery lags.
Malformed blocks, gaps, rate changes and queue overruns reject. Runtime graph
failures retire affected streams and propagate to the caller.

Ordinary `play` takes over only its mask's PCM channels. Subsequent PCM on those
channels explicitly reclaims them; the bridge's mask must exclude voices lent
to an effect for its duration. Ordinary samples use one-half volume normalization
to match the PCM mixer. The existing sample host remains unchanged when used on
its own. Filter commands route both paths through their existing-style lowpass
stages. Loop settings apply to ordinary samples, while PCM repeat decisions are
already rendered. A `voice` volume/rate update targeting PCM rejects: make those
changes in the controller before rendering future blocks instead.

Stop/disposal cancel both queued and sounding nodes without closing the supplied
context. Disposal is idempotent; late source completions cannot affect replacement
entries. The browser audio session can compose around this host to drop muted
blocks and reject retired program bindings. The adapter itself expects its caller
to invalidate retired callbacks, rather than guessing which VM owns a command.

## Browser preview and evidence

[demos/amcaf-pcm.html](../demos/amcaf-pcm.html) now streams the live synthetic
controller at a declared 50-Hz clock instead of looping a pre-rendered buffer.
Play creates and resumes an owned AudioContext while user activation is present.
Pause/Resume, repeated Play, Stop and page disposal manage engine, timers, graph
and context ownership. The preview bounds catch-up at 200 ms and requests a
restart if a background timer falls further behind. This is a preview host
policy, not an AMOS timing rule.

The browser probe compares eight PAL/NTSC repeat/pitch/stereo cases, plus three
native graph cases for channel takeover, expired-block recovery and filtering.
The expected PCM comes from separate absolute-phase formulae/literal values.
All eleven comparisons currently match with zero maximum difference. These are
portable/native Web Audio checks, not Amiga execution captures.

Headless stream checks also run both external Ghostlight modules through their
first end signal at an explicit 50-Hz clock: 1,536/5,376 blocks of 160 frames at
8 kHz, respectively. All four PCM arrays remain finite, with per-voice peak
magnitudes 0.1611328125 and 0.5. No private source, assets or generated audio are
included in the repository.

The [VM integration](amcaf-vm.md) now supplies fractional CIA/VBL deadlines,
cumulative frame rounding, Pt Play/Stop/Volume/Cia Speed, bank guards and automatic
page-builder host selection. Pt Sam/Raw ownership and whole-game compilation
remain open. The direct bridge tests above remain separate from live VM evidence.
