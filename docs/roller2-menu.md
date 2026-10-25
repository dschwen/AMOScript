# Roller II guarded title-menu selection

The [menu demo](../demos/roller2-menu.html) runs unchanged original LIMM (call
288 and definition 69–71), zone declarations and the input/branch loop (293–316),
and FDZ (57–62). A synthetic `Load Iff "title",0` supplies the pinned main-title
image. Synthetic destination labels record `game`, `editor`, `scores` or `help`
and wait instead of entering those original routines. There are no host
variable/IP edits. This is a bounded menu selection fixture, not a running game.

Startup, initialization, FLOAD fade-in, setup 281–286 and music are excluded.
The separate [intro demo](roller2-intro.md) covers the intro and initialization;
these two fixtures have not yet been joined into complete source control flow.
Game/editor/help/highscore rendering, file operations and gameplay remain open.

## Original input and branches

Four original zones cover the game button (1), editor button (2), highscore
region (3), and help symbol (4). The original loop moves X/Y Mouse through
joystick directions, waits for VBL while Joy is active, consumes Inkey$/Scancode,
and branches on held mouse/fire input. It retains its original precedence:

- `h` selects the scores guard, setting VTB to one.
- The Amiga Help raw code 95 selects help. Browser tests inject a `Help` event;
  F10 retains its distinct raw code and is not a Help alias.
- Fire before joystick movement selects game directly, regardless of the zone.
- After movement sets MOVJ, fire selects the zone beneath the moved mouse.
- A left mouse button selects the current zone. Empty regions keep polling.
- Game/editor selection executes the original `FDZ[2]` before its guard.

The live preview defaults to WebGL2 with a labelled Canvas fallback and a stable
fullscreen container. Keyboard arrows and Space/Enter map to joystick port 1;
the Gamepad API is polled by the original queries. Pointer events use the existing
hardware-coordinate adapter. Joystick assignments change the runtime mouse,
without warping the browser cursor. The status reports the current coordinates,
zone and guarded outcome. Restart creates a fresh menu fixture; Stop/Resume and
fullscreen preserve the existing host contracts. The preview is silent.

## Evidence and limits

Headless tests classify all 85,760 positions of the 320×268 title window against
independently transcribed original rectangles. They exercise inclusive zone
edges, unchanged bitmap storage, target guards, keyboard shortcuts, blank clicks,
direct fire and moved-fire precedence. No percentage of game compatibility is
inferred from this slice.

The shared browser evaluator runs ten bounded cases: four pointer regions,
three keyboard paths, direct and moved gamepad fire, and a blank click. Nine
cases select guards. Its independent PNG oracle checks the original title and
black output after original FDZ; two snapshots also run on actual WebGL and
match CPU output. CPU fallback never counts as GPU execution. Chromium gallery
checks additionally use a real held pointer and H key, a controlled Help event,
Stop/Resume, Restart and fullscreen cleanup. Every browser case runs from the
self-contained demo linked through HTML Preview in the gallery.

The replay uses a fake clock with a four-millisecond minimum host callback delay
and finite execution budgets. Busy polling cannot starve the injected VBL clock.
It checks outcomes after 640 ms, including the original 30-field FDZ wait where
applicable. These are injected timing checks, not native busy-loop timing,
physical gamepad evidence, Amiga audio/display captures or target-GPU performance.
See [Mouse Zone semantics](zones.md) and [mouse assignment](mouse.md).
