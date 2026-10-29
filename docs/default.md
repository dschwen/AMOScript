# Default and the Planet Zybex startup prefix

`Default` (`$0cee`) now performs a display/animation/audio reset in the standalone
runtime. It continues at the next instruction. The unchanged Planet Zybex source
now also executes Set Sprite Buffer; the current whole-program blocker is
**Amal Off, original line 179, byte 8844**, with ten unsupported encodings.

Select **Default startup (fixture)** on the
[Planet Zybex preview](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex.html).
The fixture executes original line 90, pauses at a declared Wait Key guard, then
executes original lines 91–93 (Screen Close 0, Close Editor and the 48-line
Set Sprite Buffer) and pauses again.
Advance fixture supplies a key to these guards. No AMAL,
manual Synchro/Update or gameplay executes. The original embedded image/sample
banks remain intact. The whole game still does not compile or play.

## Implemented reset

| Resource | Default behavior |
| --- | --- |
| Screens and clones | Retire the complete display together; create/select a fresh screen 0. No individual owner/clone close ordering is required for this whole-display reset. |
| Presentation | Discard committed/staged windows and priority order, enable Auto View, and present the new screen even if Auto View was previously off. Old exported snapshots retain owned bytes. |
| Bitmap/text state | Fresh single buffer, no zones, offsets or writing/escape state; normal pen/paper/ink, solid line, text cursor at 0,0, visible-cursor intent and window TAB 4. |
| Bobs | Remove all objects and saved backgrounds; restore normal numeric priority. |
| Sprites | Turn off all logical/presented images, preserving remembered x/y positions. Restore the 128-line configured pool through the [buffer manager](sprite-buffer.md); computed/wide allocation remains separate. |
| Automatic updates | Reset Bob/Sprite automatic UPDATE to off, from native ActuMask `$7100`; explicit updates and subsequent Update On commands remain meaningful. |
| Break flag | Restore `state.breakEnabled=true`; host Stop remains available throughout. |
| AMAL | Clear all 26 global signed-word registers. Programs, channel bindings and automatic synchronization remain unsupported until their interpreter is implemented. |
| Rainbow/Fade/Flash | Remove old tables/jobs and cancel their wakes. Start the default colour-3 flash on the fresh screen using the existing VBL scheduler. |
| Mouse | Show the pointer and select built-in shape 1, mapped to the portable host cursor. Install native default hardware limits when unset or when both minimum coordinates are zero; preserve other explicit bounds and the current position/buttons. |
| Audio | Stop owned Music/Tracker/sample/effect voices and wakes; disable Tracker/Sam loops; select sample bank 5; restore Music/Boom levels to 56. Preserve the LED/filter bit and remembered tracker bank. Regenerate the portable shared noise wave from its retained seed/phase. |

Variables, arrays, procedure/Gosub frames, DATA position, Timer, Rnd seed/cache,
file/port channels, directory, bank payloads/addresses, queued text, held keys,
joysticks and Key Speed settings remain. Default does not restart the VM or clear
its filesystem. Closing screens must not restore saved Bob pixels into a new
screen or retire unrelated bank addresses.

The factory’s existing startup choices remain unchanged for programs that do not
issue Default. In particular, their automatic-update behavior and ordinary
Screen Open palette are retained.

## Pinned configuration and portability

This slice uses the shipped interpreter configuration at upstream revision
`533b4b1f5acd604814513f78e02c7b4796cb0531`: 320×200, 16 colours, lowres, hardware
screen origin 128,50. The first palette entries are `$000,$a40,$fff,$000`; all
32 registers come from that profile. Default also restores DefPal, so later
Screen Open calls in that factory inherit this palette. Paper 1 therefore renders brown RGB
170,68,0. Configuration messages supply the sixteen colour-3 steps, each lasting
two fields, beginning `$000,$440,$880,$bb0`.

The source profile was also checked against the shipped `PId1` binary
`AMOSPro Sources/Default_Interpreter_Config` (SHA-256
`09c241b4eadc7721cb5dc6bc734368300c6ae129dfdc45d5c92941b6d6609f41`).
Native `T_DefWX` is 129; screen placement aligns this to 128 while the saved mouse
limits use 129..448,50..249. Native default window TAB is four; `CurTab=8` belongs
to the separate dialogue machinery, which is not implemented here.

User interpreter preference files are not loaded. The font, cursor artwork and
noise beam/seed choices remain the existing portable profiles, not Topaz or an
Amiga hardware capture. Unsupported menus/dialogues, blocks, fonts, windows,
computed/wide sprite allocation and extensions do not acquire placeholder execution from
Default. Exact intermediate copper rebuilds, native teardown/beam timing,
noise interrupt tails and full custom-configuration parity remain open. Within
the implemented raster subset, reset uses normal fresh-screen drawing state.

## Ownership and failure

Default preflights the display-reset capability, VBL clock and pure noise
configuration. Old palette effects are consumed before the default flash is
installed. Audio controller handles are consumed before host stop callbacks;
reentrant Default rejects explicitly. A failing synchronous host halts with the
original Default source location and driver cleanup cancels remaining owned
wakes. No new system adapter or audio device is required for headless execution.

The existing display bridge publishes indexed bitmap data through planar chip
snapshots and copper state. Canvas and actual WebGL compare against independent
pixels; there is no RGBA overlay. Original Screen Close clears both hosts and
forgets the prior GPU presentation.

## Evidence and checks

Primary source at the pinned revision:

- [`+Lib.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BLib.s): `InDefault`.
- [`+ILib.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BILib.s): `DefRun1`, `DefRun2`, `DefRunExtensions`, `InBreakOn`/`InBreakOff`.
- [`+W.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BW.s): `ClrAMAL`, `EcDAll`, `TPrio`, `HsOff`, `HsSBuf`, `MStore`, default-window setup and aligned screen placement.
- [`extensions/+Music.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/extensions/%2BMusic.s): `MusDef`, `RazWave`, `MuInit`, `InTrackStop` and loop/default sample configuration.
- [`+Interpreter_Config.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BInterpreter_Config.s): screen, palette, mouse geometry and message 46 flash pattern.

The registered core Default cleanup routines cover menus and dialogue channels;
these commands remain gated. Music is the implemented extension with resettable
state. Picture Compactor has no retained per-program controller in this subset.

`tools/reference/defaults.py` independently transcribes the profile/flash and
computes noise-reset word vectors without importing production modules. Seven
unit/integration groups cover original bytes/source, clone/staging/buffer/Bob
retirement, snapshot/bank ownership, all flash steps, scope/input/files retention,
mouse/update/Break defaults, live Music/Tracker/sample reset and noise/host
failure behavior. The browser scenario adds two PAL/NTSC default-screen GPU
comparisons and two original close/clear checks, contributing to Planet Zybex’s current **51 GPU
comparisons** (including the later direct-sprite buffer matrix). Its live fixture selector/advance/return/fullscreen/disposal paths
are checked alongside the previous background and score previews.

Regenerate with `python3 tools/reference/defaults.py` and `npm run build:demo`;
verify with `npm run check` and `npm run test:browser`.
