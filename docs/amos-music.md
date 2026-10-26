# AMOS Music end-tune foundation

`lib/amos/musicBank.js` decodes owned Music-bank payloads, and
`lib/amos/music.js` plays a checked subset through explicit field steps and the
existing synchronous audio-host protocol. The direct-player
[demo](../demos/roller2-amos-music.html) auditions Roller II's original `Over.mus`
and `Ywon.mus`. This is actual sample playback, separate from MOD tracker music.
**VM Music, Mvolume and Music Off remain unsupported.** Whole-source compilation
still stops at slot-1 Music `$0058`, original line 992, byte 54,202; three source
encodings remain unrecognized.

The implementation follows `src/ext/music.cpp` and `src/ext/music_play.cpp` in
the AMOS-Professional-Official source checkout at commit
`efddf2c9a09bf61a45b7b096a9be84630853c2b1`. The fixtures are source-derived
expectations, not Amiga recordings or an emulator execution capture.

## Decoder and playback contract

The decoder accepts the payload after the 20-byte AmBk wrapper. It checks section,
instrument, song-order and pattern-stream ranges, even offsets and terminators.
Sample descriptors retain independent initial-fetch, repeat and stored lengths;
all byte arrays are copied, including when the caller passes a Node Buffer.
Tables are bounded to 256 entries and the payload to 16 MiB. This profile requires
one final end marker per stream; older layouts and broader aliases are gated.

Each player copies orders/streams and owns initial-plus-repeat sample buffers.
Supported pattern commands are end/next pattern, volume, tempo, instrument,
slide-up and delay. Unsupported commands, old note pairs, missing instruments,
invalid tempo and loops without delays reject before host audio. Initial fetches
shorter than one field also reject: the native player sets repeat registers on
the next VBL, and exact short-fetch DMA behavior is not modeled. Both original
tunes fit these bounds.

PAL uses clock 3,546,895 and counter base 100; NTSC uses 3,579,545 and base 120.
Tempo starts at 17, independently of the song header. Over switches it to 16.
The field counter decides between logical steps and effect/volume updates;
effects do not also run on logical-step fields. Instrument/volume commands update
logical gain, with hardware gain taking effect on the next non-step field. Master
volume is 0–63, default 56, with the native multiply/shift scaling. Fresh channels
start silent, so first-field notes have zero gain until that update. Slide-up
uses unsigned-word arithmetic and the source period clamps 113–856.

Repeat buffers may lie outside the initial fetch. Over uses external four-byte
silent repeats. Ywon's strings4 instrument fetches 1,220 bytes then repeats a
separate 3,410-byte region. Playback appends that repeat and uses explicit host
loop bounds. It neither truncates the initial fetch nor plays unused stored tails.
The controller emits synchronous play/voice/stop commands, has no timers, and
accepts monotonic bounded `advance(field)` calls. Host failure stops playback.
Stop is terminal; master volume updates held voices without retriggering notes.

The demo uses browserAudio for gesture activation, dropped muted events, binding
ownership and context disposal. Play starts fresh, Stop mutes, Restart resets,
and hidden pages stop instead of replaying stale fields. A monotonic 50 Hz clock
advances the PAL player independently of requestAnimationFrame. Manual stepping
works silently without creating an AudioContext.

## Evidence and remaining work

`tools/reference/roller2_music.py` independently parses raw assets and computes
field traces into `test/fixtures/roller2/music.json`. Tests compare every note,
held period and hardware-volume state until every voice first wraps:

| Tune | PAL fields | NTSC fields | Note triggers per standard |
| --- | ---: | ---: | ---: |
| Over.mus | 10,000 | 12,000 | 3,392 |
| Ywon.mus | 13,177 | 15,812 | 5,731 |

Counts include the first wrap triggers. All 25 original instrument PCM regions,
repeats and stored payloads have independent hashes. Seven unit groups cover
full traces, ownership, malformed banks, master gain, slide clamps, host failures
and rejected profiles. The browser repeats the four full traces and compares all
25 instruments against independently read raw PCM in native OfflineAudioContext
stereo/loop graphs, with zero sample difference. The sustained-loop golden buffer
ends at the repeat boundary: unused stored tails would change Web Audio's
resampler boundary interpolation. These graph comparisons are browser evidence,
not Paula/analog parity. Interactive gallery tests cover Play, Stop, song changes
and owned-context closure.

Next connect checked Music banks to VM commands and driver-owned VBL wakes,
shared sample voices, bank retirement/mutation guards, Stop/Resume and terminal
cleanup. Only then integrate original end-state source routines. Multiple stacked
songs, other effects, live mutable banks, exact DMA/register timing, native pause
phase and hardware audio captures remain open. No full game or end-state run is
claimed by this direct-player fixture.
