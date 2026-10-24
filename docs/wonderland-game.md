# Live original Wonderland

The [playable demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/wonderland-game.html)
embeds the unmodified `Wonderland.AMOS` and all seven pinned companion files.
It runs the existing standalone instruction-function dispatcher with WebGL2
presentation by default. The Renderer selector explicitly switches to Canvas 2D
and back while retaining the current program, timers and sound session.
No game variables, instruction pointers, source branches or assets are patched.

Focus the canvas. Arrows move and jump; Space/Enter selects in the original menu.
Escape returns to the original title. The selector switches to WASD + Z, browser
standard-gamepad input, or both. The Gamepad API uses controller zero with the
existing host defaults (axes/D-pad, button zero and dead zone). These are host
mappings; AMOS still reads joystick port 1. Actual-controller captures remain open.

Stop cancels VM and palette wakes, silences the pure audio controller and clears
owned input. Resume retains the game state. Restart creates a new factory and
host binding. Keyboard repeat and focus cleanup belong to the existing Canvas
host. AMOS timers use `performance.now` and timeouts; requestAnimationFrame only
presents display invalidations. The page cancels owned callbacks, subscriptions
and monitoring when rerun. Callback errors stop and detach the session, display
the error, and require Restart; they do not silently continue without rendering.

The live page serves preloaded reads. Editor entry and hardware mouse coordinates
are enabled, but an integrated requester/writeback adapter is not provided. Move
the pointer over the canvas before choosing Editor after Restart: the initial
mouse position remains zero until a pointer event, and fully keyboard-only editor
entry can otherwise reach a negative Rainbow base. Pointer initialization remains
an editor integration limit; Limit Mouse does not reposition the pointer.
Pressing L in the original editor therefore reports the explicit synchronous
`files.select` failure. Prepared file selection and raw writeback remain available
in their separate demos. IndexedDB persistence is still planned. Click Enable
sound to activate Web Audio for the original sample commands.
Mute stops active voices immediately. The separate audio demo also auditions
all six samples. See [the sound contract](audio.md#live-game-sound-session).

## Controlled replay and evidence

`test/helpers/wonderlandReplay.js` executes the complete factory using a finite
stepped timeout clock. Fire selects Game, then left remains held. The original
collision path spends all three lives, runs three death animations and fades,
restarts the level twice, and returns through game over to the original title.
A subsequent Fire starts a fresh first level with three lives. The replay also
checks Stop/Resume and final timer cleanup. It has a 1,000-callback limit rather
than draining the busy menu indefinitely. The measured game-over time is about
12 nominal seconds; this is an injected clock, not native Amiga timing.

Node executes the same replay and renders event-free snapshots. Separate
input-only coverage checks upward jumping, rightward scrolling and Escape.
Chromium repeats the loss/restart sequence through keyboard events and injected
standard-gamepad records, comparing Canvas output to the shared snapshot output.
The gallery retains the keyboard replay frames. Live UI checks exercise real
keyboard selection, movement, Stop/Resume, Escape, remapping, Restart and visible
unsupported-editor failures without unhandled page errors or network assets.

Five GPU comparisons cover the three original fade-entry states, game-over title
and fresh-game frame. Their expectations are the CPU output of those original
paths, not independent Amiga captures. The earlier four game frames and literal
attached-image expectation remain separate tests.

The death fade exposed a screen-stack budget issue. The builder now uses the
capture deadline on genuinely blank rows and the fetch deadline on visible rows;
its DIW writes still precede pointer changes. It omits only playfield-colour 1–15
gap writes that the immediately following row overwrites. Border colour zero,
sprite colours 16–31 and a final restoration write remain intact. Target-row
palette writes replace shadowed setup writes rather than consuming duplicate
slots. A boundary fixture fits exactly 15/15/13 MOVEs across two blank rows and
the HUD row, with no raster events; removing a blank row still rejects.

This establishes an interactive first-level session and a bounded loss/restart
path. All-five-level completion, collectibles/enemy behavior, win paths, editor
round trips, sustained performance, native clock fidelity and
external Amiga reference captures remain milestone work.

## Fullscreen

Fullscreen fits the game inside the available viewport for both renderers, with
controls and game/audio status kept visible. It preserves the canvas bitmap and
pointer mapping. Switching renderers and Restart retain fullscreen because the
container survives canvas replacement. Escape first leaves fullscreen; press it
again outside fullscreen to return to the game's title. Browser/frame permission
failures are reported separately from game errors. See [the shared fullscreen
contract](fullscreen.md).

## Original game sound

The page creates no live AudioContext until Enable sound is clicked. The optional
`lib/amos/browserAudio.js` session creates/resumes its owned context inside that
user action and routes the current program's synchronous events to the existing
Web Audio host. Before initial activation, and while muted or suspended, new
effects are dropped rather than queued for later playback. Missing APIs or rejected activation appear
in the sound status; the game remains usable silently.

Each Restart binds a new program adapter and invalidates the old one. Stop and
runtime failures silence active voices. Resume continues execution without
replaying past samples; an interrupted context can be resumed from the user
control. Rerunning or disposing the demo disconnects owned nodes and closes its
context. Async activation is invalidated by Mute/disposal, so a late resolution
cannot re-enable sound.

The keyboard replay produces sample 1 on mask 1 four times, sample 5 on mask 12
three times and sample 6 on mask 12 once: collectible, death and game-over effects.
Three offline native Web Audio comparisons use those actual game events and
independently addressed PCM, Paula periods, gains and stereo routing. Both death
and game-over play on left and right voices; the collectible command is left-only.
PCM comparisons tolerate at most 1e-6 sample difference; they are native Web Audio
control graphs, not Amiga recordings. The existing separate music probe still
covers all six samples, loops and replacement.

Live Chromium checks click Enable, trigger original gameplay sound, mute, confirm
voice cleanup, re-enable while stopped without replay, retain activation across
Restart, and close the context on disposal. Browser-adapter unit tests cover lazy
creation, pending activation races, failed activation/retry, suspended commands,
new/old program ownership, missing APIs and idempotent cleanup. Analog fidelity,
exact interrupt timing and external Amiga audio captures remain open.


## Live WebGL2 presentation

The shared input host accepts `createCanvasHost(canvas, {renderer: gpu})`, where
`gpu` is the existing WebGL2 renderer. That path takes `snapshotDisplay()` through
the actual decode/resolve shaders and the presentation shader. It does not call
`canvasFrame`, `rgba`, Canvas 2D, `putImageData`, or GPU readback. Indexed playfield
storage and CPU planar packing remain the established snapshot bridge; this does
not make planar storage authoritative or move the AMOS VM onto the GPU.

The host sizes its drawing buffer from reduced rational pixel-aspect cells. For
Wonderland, 640 native samples by 202 rows present as 640 × 404 pixels, covering
the entire canvas. Existing local/hardware pointer mapping therefore continues
to cover the full image without letterboxing. Arbitrary viewport/letterbox input
routing remains outside this bounded host integration.

Switching creates a new canvas because context modes cannot change on the same
canvas. It detaches old input subscriptions and releases old GPU resources while
retaining the same program and audio binding. Held input is cleared; press keys
again after switching. The host itself does not dispose an injected renderer;
its caller owns that resource. Restart creates a new program and renderer, and
demo cleanup disposes GPU objects and releases the owned context.

Context loss reports WebGL as unavailable and continues the VM/input/field clock.
Snapshots received during loss replace the owned restoration source. Restoration
rebuilds resources and shader passes and redraws/presents the latest snapshot,
even while the VM is stopped. It never silently selects Canvas. Unsupported GPU
modes/errors stop the live session visibly. If WebGL2 creation is unavailable,
select Canvas 2D and Restart; the automatic result reports the skipped GPU probe
explicitly instead of counting CPU execution as GPU coverage.

The controlled full-program GPU replay compares eleven GPU readbacks with CPU
output over level entry, all three deaths/fades, two life restarts, game over and
a fresh game. CPU presentation is replaced by a throwing function during that
GPU replay, and the canvas refuses a 2D context. These checks supplement the
separate 179 renderer comparisons. Live Chromium checks cover WebGL default,
explicit switching while stopped without resetting the game, sound activation,
VM progress during context loss and restoration while stopped. The renderer's
`clear()` forgets a removed screen and prevents restoration from repainting it.
These are local Chromium/SwiftShader and CPU/GPU parity checks, not Amiga captures
or sustained GPU performance measurements. HAM/events and remaining mode gates
remain explicit renderer limits.
