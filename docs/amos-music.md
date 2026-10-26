# AMOS Music end-tune foundation

`lib/amos/musicBank.js` decodes owned Music-bank payloads, and
`lib/amos/music.js` plays a checked subset through explicit field steps and the
existing synchronous audio-host protocol. The direct-player
[demo](../demos/roller2-amos-music.html) auditions Roller II's original `Over.mus`
and `Ywon.mus`. This is actual sample playback, separate from MOD tracker music.
The VM now implements Music `$0058`, Mvolume `$0196` and Music Off `$002c`.
All 194 Roller II encodings are recognized; the complete unchanged 1,199-line
program compiles to 2,528 instructions in a standalone factory. Full game
execution and integrated end-state graphics are separate acceptance gates.

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

## VM command and lifecycle integration

The [VM demo](../demos/roller2-music-vm.html) runs original load/play lines
990/992 or 1012/1014, a declared Wait Key audition boundary, original game-over
volume fade/Off/Erase line 1006 and a final Wait Key guard. Reusing 1006 for the
win tune is an explicit harness choice. FLOAD, end-state graphics, win logic,
highscores and menu return are excluded. Both demos have HTML Preview links in
the gallery.

Music requires a chip `Musi`-named data bank at number 3 and a checked song
number 1–65,535. Higher wrapped native selectors reject. Mvolume accepts the
shared AMOS integer conversion followed by a 0–63 check; the master setting
persists even with no active song. Music Off explicitly silences all four shared
channels, including when no Music song is active. Terminal cleanup only cancels
an active Music controller before the runtime's general audio silence.

A separate driver-owned wake advances fields during waits and cooperative
execution, independently of requestAnimationFrame. The driver advances due music
before an instruction; late/cancelled callbacks use ownership tokens. Catch-up
beyond 250 fields fails with the originating Music source location. Host Stop
freezes the position, cancels the wake and silences held samples; Resume rebases
to the next field without replaying elapsed notes or restoring held sample phase.
End, Edit and failure cancel playback and wakes before terminal notification.

Playback shares the existing four-voice audio controller. Sam loop settings
remain recorded but cannot change Music's reserved channels. This bounded profile
rejects stacked Music calls, Music/Tracker overlap and Sam Play/Stop or Boom
voice stealing during Music, before audio changes. Music Off followed by Music
starts fresh. Filter changes remain live. Bank replacement, erasure, shrink and
swaps involving bank 3 stop playback; checked Poke/Bload/Fill/Copy writes into an
active bank reject before mutation. These portable restrictions do not claim
native live-bank mutation or native song-stack behavior.

Eight VM test groups verify full-source standalone compilation, all four complete
first-wrap traces, original volume fade/Off/Erase, typed master volume, bank
lifecycle/write guards, source-context failures, terminal cleanup, stale callbacks
and Stop/Resume. The browser repeats those full traces and fade exits, then
exposes gesture-activated original-statement playback. Interactive gallery checks
exercise Pause/Resume, real-time volume fade, song replacement and context closure.

Next integrate the original end-state screens and returns into the connected game,
and exercise the complete compiled program through real input-only replays.
Multiple stacked songs, other effects, live mutable banks, exact DMA/register
timing, native pause phase and hardware audio captures remain open. No full-game
or complete end-state run is claimed by the bounded music fixture.
