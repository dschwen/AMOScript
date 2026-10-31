# Compile an AMOS game into a complete browser page

The [Roller II demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-game.html)
combines a compiled AMOS program, prepared assets and browser adapters. The
compiler supplies the game and portable runtime; the surrounding page owns the
canvas, renderer, sound permission, fullscreen, input and buttons.

You can build that kind of page without copying the repository's test gallery.
The commands below generate a self-contained HTML file with a red **Play Game**
button, sound, fullscreen, Restart/Stop/Resume, keyboard, Gamepad API and an
optional touch joystick. The program keeps its original intro and menu prompts.

## 1. Compile a first page

From the repository root, install the locked dependencies and build a page:

```sh
npm ci
node tools/build_game_page.js examples/Graphics.AMOS /tmp/graphics.html
```

Open `/tmp/graphics.html` in a browser and click **Play Game**. This example uses
an embedded bank, so no external asset manifest is needed. For your own game:

```sh
node tools/build_game_page.js path/to/MyGame.AMOS /tmp/my-game.html \
  --title "My AMOS game" --port 1 --fire Enter,Space
```

Use a tokenized `.AMOS` input, not an `.Asc` listing or an Amiga executable.
Compilation reports unsupported commands with source locations. A generated page
does not establish complete AMOS compatibility; it still uses the supported
runtime subset described in [compatibility](compatibility.md).

The builder writes a new file and refuses to overwrite an existing one. Choose a
new filename or remove an earlier generated output before rebuilding. It does not
modify the AMOS file. For a plain JavaScript factory instead of HTML, the existing
CLI remains available:

```sh
node bin/amoscript path/to/MyGame.AMOS /tmp/my-game.js
```

## 2. Prepare external files before starting the VM

A game that uses `Load`, `Load Iff`, `Track Load`, `Bload` or sequential files needs
its external files. Create a JSON manifest mapping **the paths the AMOS program
requests** to local files:

```json
{
  "MYGAME:ship.abk": "assets/ship.abk",
  "MYGAME:title.iff": "assets/title.iff",
  "MYGAME:music.mod": "assets/music.mod",
  "MYGAME:levels/1": "assets/levels/1"
}
```

Local file paths are relative to the manifest's directory. If the source sets
`Dir$="MYGAME:"` and then loads `"ship.abk"`, its resolved request is
`MYGAME:ship.abk`. Supply that complete name. The generated adapter normalizes
case and slash direction, retains AMOS volume prefixes, infers directory metadata
from those names, and preserves each file's binary bytes through base64 embedding.

```sh
node tools/build_game_page.js path/to/MyGame.AMOS /tmp/my-game.html \
  --assets path/to/assets.json --title "My AMOS game"
```

You can instead omit a common volume prefix from the manifest keys and add it
with `--prefix MYGAME:`. Do not add the prefix twice. The builder also accepts
this repository's `{ "files": { "name": { "path": "...", "byteLength": 123,
"sha256": "..." } } }` format and verifies supplied byte lengths and hashes.

All reads are synchronous after startup. Do not return `fetch()` Promises from
`files.read` or attempt to pause/replay an expression to show a modal file picker.
If you design a separate upload UI, finish reading files before starting the VM.
File selector choices must likewise be prepared before execution; see
[file selectors](file-selector.md).

Writes in this page are held in per-page memory, including across Restart.
Reloading the page resets them. IndexedDB persistence and a native file requester
are not supplied by this builder. `AMOS_GAME_PAGE.files` exposes the memory
adapter for your own prepared choices, inspection or export UI.

## 3. Build a working Roller II page

The repository includes the game and its pinned current asset manifest. This
command builds a standalone page using the same source and bytes as the live demo:

```sh
node tools/build_game_page.js "examples/Roller2/current/Roller II.AMOS" \
  /tmp/roller2.html --assets examples/Roller2/current/manifest.json \
  --prefix RII: --title "Roller II" --port 1 --fire ControlLeft,ControlRight
```

The `RII:` prefix matches the source's `Dir$`. Ctrl fires, leaving Enter for
high-score text input. Space continues to reach Roller II's own pause handler. The touch fire button also
feeds joystick port 1, without synthesizing a text key or AMOS mouse click.

Click **Play Game** to enable sound and request fullscreen. Roller II stays at its
original intro. Press a key to reach the menu, then choose Game or Editor yourself.
Touch fire can acknowledge the intro and select a game just like the source's
physical joystick. The generated page does not replace source startup with IP,
variable or bank edits.

The file under `current/` includes the documented source-level board-edge ordering
fix. The earlier frozen source and fixture manifest remain separate; see
[the current game contract](roller2-game.md).

## 4. How the page is wired

[build_game_page.js](../tools/build_game_page.js) invokes `Transpiler.toModule()`
and embeds its standalone factory. The builder includes browser adapters and the
WebGL2 renderer factory; no Node `require`, server or asset download is needed at
runtime. [gamePageRuntime.js](../tools/gamePageRuntime.js) is the small editable
example harness embedded into the result.

| Piece | Responsibility |
| --- | --- |
| Compiled factory | AMOS variables, arrays, banks, drawing, joystick queries and cooperative execution |
| `files` adapter | Synchronous byte strings, directory/existence metadata and memory writes |
| `browser.js` | Canvas/input lifecycle, keyboard/Gamepad mapping and optional touch controls |
| WebGL renderer | Physical snapshot rendering; the page owns GPU disposal |
| `browserAudio.js` + `webAudio.js` | Gesture activation, mute, owned AudioContext and replaceable VM binding |
| `fullscreen.js` | A stable fullscreen container, aspect fitting and Escape handling |
| Page buttons | Start/resume/restart policy and permission requests |

The Play handler makes both browser permission requests **before its first await**:

```js
const activatingSound = sound.enable();
const enteringFullscreen = fullscreen.status().active
  ? Promise.resolve(true)
  : fullscreen.toggle();
await Promise.allSettled([activatingSound, enteringFullscreen]);
// Now create or resume the VM and focus its canvas.
```

Do not wait for an animation frame, image decode, fetch or verification replay
before requesting those permissions. Browsers can reject a fullscreen/audio
request after the click's transient activation has expired. Permission failure
still permits the game to run with the available features; the supplied controls
report failures and let the user retry.

The VM receives one clock and its matching timer functions. Start it with a finite
cooperative budget, such as `program.tick(1000)`. Its timeouts and VBL waits own
continuations. `requestAnimationFrame` presents changes; it must not drive AMOS
Timer, music or gameplay. The sample harness guards old callbacks when replacing
a VM and catches runtime/render errors for display on the page.

Use one stable viewport around the toolbar and canvas slot. Restart may replace a
canvas/renderer while retaining that container. Fullscreen fitting changes CSS,
not the game's bitmap or GPU buffer dimensions. `Escape` exits fullscreen first;
a later Escape reaches the game. On teardown, detach input, stop the VM, dispose
GPU resources and close the owned audio/fullscreen sessions. The example exposes
`AMOS_GAME_PAGE.dispose()` for application unmounts and also handles `pagehide`.

### Switch between joystick and typing

The visible **Keyboard: Joystick / Keyboard: Typing** selector controls whether
keyboard presses feed the joystick or AMOS text input. Choose Typing for names,
filenames or other prompts, then switch back to Joystick to play. The selection
survives Stop/Resume and Restart in that page session. Changing modes releases
held joystick keys; Gamepad and touch controls remain available in either mode.

Planet Zybex uses **Z** for fire, leaving Enter for menus and text prompts. Z and
Shift+Z produce ordinary `z` / `Z` in Typing mode. Other pages retain their
configured fire keys; `--fire KeyZ` selects Z when building your own page.

The harness uses `host.configureJoysticks([{ port, keyboard: false, gamepad: true }])`
for Typing mode, and restores its configured keyboard mapping for Joystick mode.
This is a browser input setting; no AMOS source or emitted instructions change.

### Adjust game speed

The page toolbar offers **Speed: 100%, 50%, 33%, 25%**. Choose a slower setting
before Play or while running. The setting survives Restart and Stop/Resume within
the page session. To choose a default when building:

```sh
node tools/build_game_page.js path/to/MyGame.AMOS /tmp/my-game.html --slowdown 2
```

`--slowdown 2` doubles the durations of `Wait` and `Wait Vbl` (half speed), while
`3` triples them. The default is `1`; finite fractional values of at least 1 are
accepted and added to the selector. Planet Zybex's live page defaults to `2`.
Its gameplay loops already use Wait Vbl: nominally 50 updates/s under PAL, or
25 with the half-speed setting, plus execution and browser scheduling overhead.
This is a playability setting, not measured native CPU timing.

Standalone JavaScript factories expose the same embedded-runtime control:

```js
const program = create({ sleepScale: 2, /* files, audio and other adapters */ });
program.setSleepScale(3); // Future waits use this multiplier.
console.log(program.sleepScale()); // 3
```

An outstanding wait keeps its original deadline when the setting changes;
Stop/Resume retains its remaining time. The runtime's existing nonnegative
`sleepScale` API also accepts zero for controlled tests; the page offers only
multipliers of at least 1. No AMOS source modification is required.

The multiplier does not change Timer's real VBL counter, fades, automatic AMAL,
tracker/music clocks or sample pitch. Zybex uses manual AMAL advancement inside
its paced game loop, so that animation follows the slowed loop. Timed source
logic can therefore behave differently from a global slow-motion simulation.
Loops without waits still run at ordinary cooperative VM speed; instruction-rate
limiting is a separate future feature. Rendering frame rate and `tick()` budgets
are not gameplay-speed controls.

## 5. Enable the touch joystick in your own harness

Touch controls are a browser-host option, not a compiler command:

```js
const host = AMOS_BROWSER.createCanvasHost(canvas, {
  renderer, // Omit for Canvas 2D presentation.
  mouseCoordinates: 'hardware',
  joysticks: [{ port: 1, keyboard: { fire: ['ControlLeft', 'ControlRight'] }, gamepad: true }],
  virtualJoystick: {
    container: viewport, // The stable fullscreen element.
    port: 1,
    visibility: 'auto', // 'auto', 'always', or 'off'.
    fullscreenOnly: true
  }
});
host.attach(program);
```

Omit `virtualJoystick` (or pass `false`) to create no touch UI. Auto shows the cross
in that container's fullscreen mode on coarse-pointer/touch-capable devices.
Always forces it on in fullscreen, which is useful on desktop. Set
`fullscreenOnly: false` to allow controls inline too, including on browsers without
DOM fullscreen support. Change visibility without restarting the game:

```js
host.setVirtualJoystickVisibility('off');
host.setVirtualJoystickVisibility('auto');
```

The layout is a cross with fire in the centre:

```text
      Up
Left Fire Right
     Down
```

Multiple pointer IDs can hold a direction and fire simultaneously. Dragging a
finger moves its hold between buttons; release, cancellation or lost capture
retires that pointer. Keyboard, gamepad and touch masks combine at joystick-query
time. Opposing directions cancel. Releasing touch does not erase a keyboard or
controller hold. Touch controls do not generate text, raw held keys or AMOS mouse
clicks. Stop, blur, visibility loss, fullscreen exit, host replacement and detach
clear owned touch holds. See [joysticks](joysticks.md) for the complete host contract.

The builder's **Touch: Auto / On / Off** selector uses this API; On means always
visible while fullscreen. The canvas geometry and pointer rectangle remain
unchanged by the overlay. `AMOS_GAME_PAGE.joystickStatus()` provides the example
harness's current host input status for debugging.

## 6. How the repository's Roller II demo differs

The public gallery page has an additional reproducible verification layer:

1. [tools/build_demo.js](../tools/build_demo.js) regenerates compiled examples and
   calls [tools/build_browser_demos.js](../tools/build_browser_demos.js).
2. `browserScenarios.js` selects `roller2GameProbe.js`, which prepares the current
   manifest's bytes, standalone compiled module, render/audio adapter sources and
   replay functions. The generator captures that one evaluator and its arguments
   into a self-contained HTML page.
3. **Play Game** invokes its live-only path, creating the live host without running
   fixture replays first. Sound/fullscreen requests remain in the click. It leaves
   the original intro waiting for the user.
4. The collapsed **Browser checks and captured frames** section runs the shared
   CPU/GPU/source-derived checks when requested. The same evaluator/assertions run
   offline in Chromium; those checks are not required in a user's game page.

Use the small builder/runtime as your starting point. Use the gallery's probe when
you want the extra acceptance replay, captured frames and regression evidence.
All browser scenarios retain a runnable page and an HTML Preview link in
[the demo index](../demos/index.html).

## 7. Publish and verify

### Link several AMOS programs with Run

For games split across `Run "filename.AMOS"` calls, create a second manifest
mapping the requested AMOS names to source files, for example:

```json
{
  "GAME:levels/1.amos": "sources/level1.AMOS",
  "GAME:levels/2.amos": "sources/level2.AMOS"
}
```

```sh
node tools/build_game_page.js sources/menu.AMOS /tmp/game.html \
  --assets assets.json --programs programs.json --title "My game"
```

The builder compiles and embeds those factories up front. Paths in `programs.json`
are relative to that manifest, and keys must match Run's filename after Dir$
resolution. A bare Run restarts the current factory. Each transition cleans up the
old VM before starting the next; session files, speed, input settings and the
fullscreen/sound session survive. Restart restarts the current factory too.
Missing linked targets produce an explicit error. This does not compile uploaded
or newly modified AMOS sources at runtime, and Pload machine-code files are a
separate capability. See [the loader/native contract](gru-programs.md#4-run-and-pload).

### Publish a page

Host the generated HTML on any static site, or commit it and link through:

```text
https://htmlpreview.github.io/?https://github.com/YOUR_NAME/YOUR_REPO/blob/main/my-game.html
```

Fullscreen availability also depends on the browser and embedding frame's
permissions. The page retains normal canvas presentation if it is unavailable.
Sound follows the browser's gesture policy. No application server is required.

Before sharing, check the intro/menu, keyboard and a physical controller, touch
movement with fire, blur/Stop/Resume, fullscreen exit, Restart and the game's
save/load paths. Compilation and CPU/GPU parity alone do not prove every game
path or native Amiga fidelity. The repository's default font is a public-domain
portable 8×8 font with Latin-1 glyphs, not an Amiga Topaz capture.

Optional: add `--optimize` to emit scalar instruction blocks. The reference emitter
remains the default; see [optimization and measurements](optimization.md). Active
music and palette effects retain ordinary dispatch, so this currently provides
little batching during Roller II gameplay.

## Debug builds and downloading session files

The default output is a game page: compact Stop (■), Resume (▶) and Restart (↻)
icons, sound/fullscreen controls, a touch selector and collapsed control help.
Each icon has a tooltip and accessible name. Running status stays out of the way;
a failure shows a short notice with a Restart instruction.

Add `--debug` when you need filesystem exports or detailed diagnostics:

```sh
node tools/build_game_page.js \
  'examples/Roller2/current/Roller II.AMOS' /tmp/roller2-debug.html \
  --assets examples/Roller2/current/manifest.json --prefix RII: \
  --fire ControlLeft,ControlRight --title 'Roller II' --debug
```

The JavaScript API accepts `buildGamePage(source, { debug: true, ...options })`.
Without that flag the Debug menu and detailed log are not created. This controls
the interface, not access permissions or VM behavior.

Open **Debug → Modified files**, then **Refresh files** after saving in the game.
Each link downloads the current raw bytes of one new or changed file. The list
compares the session filesystem with the initially loaded assets: unchanged files
and files restored to their original contents are omitted. Full AMOS paths remain
visible in the list; the browser download uses the filename without its volume or
directories. Downloaded files do not automatically replace repository assets.

Restart preserves session files. Reloading the page discards them; IndexedDB
persistence is still planned. Download exports do not implement a missing game
requester or otherwise complete unverified editor save/load paths. The debug log
keeps the latest runtime state and up to 50 source-located errors. Blob download
URLs are released on refresh, disposal and page exit.

The repository's full-game gallery uses the same icon controls. **Play Game**
uses the compact interface. Roller II and Wonderland’s separately collapsed
browser checks create their diagnostic hosts with the Debug menu. Planet Zybex
keeps its shared application launcher separate from the verification replay. The
[normal/debug application examples](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/game-page-debug.html)
exercise real AMOS Bsave writes, binary downloads, error reporting and cleanup.

## Planet Zybex example

[Planet Zybex](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex-game.html)
now uses this builder directly, with its complete current source (three AMOS vertical docking copy corrections) and
the checked manifest under `examples/PlanetZybex/current`. It needs no volume prefix:

```sh
node tools/build_game_page.js examples/PlanetZybex/current/Zybex.AMOS /tmp/zybex.html \
  --assets examples/PlanetZybex/current/manifest.json \
  --fire KeyZ --slowdown 2 --title "Planet Zybex"
```

The gallery adds navigation and collapsed checks around the generated application;
Play Game remains owned by the sample harness and runs no verification input.
See [the Zybex page notes](planet-zybex-game.md) for the tested loss/restart path,
independent images/audio and remaining progression coverage. This is a second
concrete source/manifest example for adapting the harness to your own game.


The JavaScript `buildGamePage` API also accepts an optional
`initialMouse: [hardwareX, hardwareY, buttons]` (unsigned-word coordinates and a
0–7 button mask). The host injects that declared pointer input before each new
program starts. Joy's editor wrappers use `[133,50,0]` because the source queries
the mouse before a browser pointer event arrives. This does not reposition the
mouse when AMOS executes Limit Mouse, and is not enabled by default.
