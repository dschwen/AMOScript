# Planet Zybex: full-game page and loss/restart replay

[Play Planet Zybex](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex-game.html).
The page embeds the complete current `Zybex.AMOS` (three vertical docking copy corrections) and all seven supplied level
banks. Play Game activates sound/fullscreen and starts the original first level
without injected startup input. Arrows move, Ctrl fires; standard Gamepads and
optional touch controls use the shared browser host. Stop, Resume and Restart
use the shared compact icon controls. Repeat Play retains the VM; Restart
replaces it. The development fixtures remain on the
[separate preview page](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex.html).

## Tested path

`test/helpers/planetZybexReplay.js` executes the current source, using only host
input, clock advancement, observation hooks and Stop/Resume. It does not change
VM variables, IPs, AMAL strings, banks or screen pixels.

The replay starts neutral, moves right after field 5, and moves up while firing
after field 15. It releases the controls after field 25, then allows real
landscape collisions and the original explosion program to consume all five
lives. It verifies life values 4/3/2/1/0 and the four source-driven level-1 reloads.
GAME OVER is reached through `finish_message`, including palette fades, the
original graphics Text passes and the `fin_wait` input loop. A key exits that
loop and starts a fresh game with five lives. Across each run, 419 original
Update calls include gameplay, finish-message clearing and the first fresh-game
field. Six actual reads reload the supplied level-1 bank; each replacement is a
new owned bank.

Stop at field 10 clears held input and timers; 100 ms of host time leaves VM/IP
and frame count unchanged. Resume plus a new press continues the original path.
The injected clock has a declared **1 ms minimum callback delay**, allowing the
source's busy `fin_wait` loop to yield observable time. This is a portable test
clock, not a claim about exact native busy-loop/interrupt timing. The existing
zero Basic random seed/beam and AMAL $1234 seed/zero beam choices remain explicit.

Both PAL/NTSC run through direct headless joystick input. Browser checks repeat
both standards through keyboard events and injected standard Gamepad devices:
**four runs, 1,676 Update calls, 40 Canvas captures and 40 actual GPU comparisons**.
GPU presentation forbids CPU `canvasFrame`; it compares structured copper/Sprite
output to the shared reference. Existing isolated fixtures remain intact, bringing
total Planet Zybex coverage to **214 GPU comparisons**.

## Independent images and sound

`tools/reference/planet-zybex-game.py` independently expands the packed level-1
bitmap, reads pinned public-domain font rows and decodes the original Samples
bank. It imports no production parser, decoder, runtime or rendered image.

For the first four selected movement frames, each life restart and the fresh
game, it specifies the left 32 lowres bitmap columns (64 physical samples) and
the complete hires Score/Lives strip. These regions intentionally exclude moving
Bobs/Sprites; their presence elsewhere is covered by the whole-frame GPU checks
and the independent ship/enemy fixtures. Scroll offsets 0/5/14/24 and score/lives
text follow the original source. The entire 640×171 GAME OVER image has an
independent PNG/hash, including doubled lowres outlined text and the blank
single-row score window after the source Centre scroll. Four browser replays
check **76 independent regions**. Full independent composites for arbitrary
moving gameplay scenes remain open.

The original fire path emits two sample-4 events. Its 4,554 signed PCM bytes,
metadata, period/rate, voice-0 mask, volume 56, loop flags and every normalized
PCM value match an independent bank extraction. PAL and NTSC each compare a real
OfflineAudioContext graph against independently loaded PCM, clock/period pitch,
left-channel routing, gain and the 3300 Hz lowpass filter. Both graphs have
nonzero energy and agree within 1e-6; the right channel stays silent. These are
**two native Web Audio comparisons**, not an Amiga recording or a listening test.

Each natural death emits four finite Boom voices, giving twenty Boom events per
run. The existing independent Boom PCM/native graph tests retain their own
coverage; this replay verifies that the unmodified game reaches those commands.
It does not claim an independent full-mix recording or thunder/sample-2 playback.

## Building the page

The gallery calls the public page builder directly:

```sh
node tools/build_game_page.js examples/PlanetZybex/current/Zybex.AMOS /tmp/planet-zybex.html \
  --assets examples/PlanetZybex/current/manifest.json \
  --fire ControlLeft,ControlRight --title "Planet Zybex"
```

No volume prefix is needed: the source uses bare level-bank filenames. Manifest
sizes/hashes are checked before embedding. The gallery adds navigation and a
collapsed browser-check section. Its `externalLauncher` flag leaves Play Game
owned by `gamePageRuntime.js`; starting the application must not execute the
verification replay or inject controls. Normal mode has no Debug menu or big
source-error log. Add `--debug` for the generic Debug/export UI when building your
own page; this game currently performs no session file writes.

Live-page browser tests cover sound/fullscreen activation, keyboard/Ctrl input,
compact icon controls, a frozen stopped frame, Resume, repeated Play retaining
the canvas, Restart replacing it, mute/unmute, owned audio-context closure and
fullscreen/input disposal. The page and checks need no network assets.

Rebuild references with `python3 tools/reference/planet-zybex-game.py`, regenerate
pages with `npm run build:demo`, then run `npm run check` and
`npm run test:browser`. The separate [page tutorial](game-webpage-tutorial.md)
explains the shared harness.

## Docking and vertical-entry update

The [progression replay](planet-zybex-progression.md) now completes level-1 docking
and moves/fires through 25 vertical level-2 fields with all five lives. It also
fixes AMAL YS/YH to share Basic’s source-derived coordinate conversion. Four new
PAL/NTSC keyboard/Gamepad runs add 56 independent strips and 56 GPU comparisons.
The complete page now has eight runs, 4,596 Updates, 132 independent regions and
96 GPU comparisons; total Zybex coverage is 270 GPU comparisons. The earlier
419-field/40-GPU figures above describe the retained loss/restart cases.

## Remaining acceptance

This establishes first-level firing, natural death, life reloads, GAME OVER and
fresh-game entry, level-1 docking and the first 25 vertical level-2 fields. It
now also establishes level-2 docking and ten level-3 fields through the
[current-source update](planet-zybex-level2.md). It does not establish level-3
completion, later levels, victory, every enemy or sample, a full independent gameplay
composite, or native Amiga display/audio/timing parity. All supplied maps remain
independently decoded and scrollable in the preview. The next gameplay work is
an input-only route to level-3 completion and later progression, retaining
these loss/restart and existing Roller II/Wonderland regressions.

The current source changes only lines 1494/1499/1506 to copy the vertical viewport
during docking; the frozen upstream file and all asset bytes remain unchanged.
The current expanded page totals are eight replays, 6,480 Updates, 188 independent
regions and 152 GPU comparisons (326 Zybex GPU comparisons including fixtures).
See [vertical completion](planet-zybex-level2.md) for source evidence, corrected
row-480 snapshots, bank replacement and exact progression limits.

## Browser game speed

The live launcher now defaults to half speed (`sleepScale: 2`), selectable in its
**Speed** toolbar control without restarting. The unscaled fixture replays retain
their existing frame counts. Headless PAL/NTSC progression also checks the full
route at the half-speed default, including both docks and level-3 entry.
`Wait Vbl` at source lines 1251/1423 already limits the gameplay loops to nominally
50 updates/s under PAL; the multiplier makes that 25 before host overhead.
Music/sample playback and Timer retain their ordinary clocks. This is a user
pacing preference, not an Amiga CPU timing claim. See the
[page builder tutorial](game-webpage-tutorial.md#adjust-game-speed).

## Debug build

[Play Planet Zybex with debug enabled](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex-game-debug.html).
The regular game page and its demo-index card link to this version. It embeds the
same current AMOS source/assets and half-speed default, with the shared Debug menu
for detailed runtime errors (including AMOS line/byte locations), runtime status
and new/modified in-memory file downloads. On a crash, open **Debug** and copy the
error/stack and the steps that led to it; Restart retains the error history for
that page session. Reload clears session files and logs.

`npm run build:demo` rebuilds both versions. To build a debug page separately:

```sh
node tools/build_game_page.js examples/PlanetZybex/current/Zybex.AMOS \
  /tmp/zybex-debug.html --assets examples/PlanetZybex/current/manifest.json \
  --title "Planet Zybex — Debug" --fire ControlLeft,ControlRight --slowdown 2 --debug
```
