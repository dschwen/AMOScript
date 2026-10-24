# Live original Wonderland

The [playable demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/wonderland-game.html)
embeds the unmodified `Wonderland.AMOS` and all seven pinned companion files.
It runs the existing standalone instruction-function dispatcher and Canvas host.
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
in their separate demos. IndexedDB persistence is still planned. Web Audio user
activation is not integrated into this live session; the separate audio demo
continues to exercise the six original samples.

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
path. All-five-level completion, collectibles/enemy behavior, win paths, integrated
sound and editor round trips, sustained performance, native clock fidelity and
external Amiga reference captures remain milestone work.
