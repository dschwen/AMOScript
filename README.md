# AMOScript

Transpile tokenized AMOS BASIC programs into standalone JavaScript for browsers
and Node.js. Browser hosts support WebGL2, fullscreen, keyboard/Gamepad input and
optional sound. AMOS and Amiga compatibility is still in progress.

## Play and explore

**[Open the demo gallery](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/index.html)** — start with the games and animation demos. No install is required.

| Featured demo | What to expect |
| --- | --- |
| **[Dithell’s Wonderland](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/wonderland-game.html)** | Original game with WebGL/Canvas, fullscreen, keyboard/Gamepad and optional sound. Replays cover lives, game over and restarting. |
| **[Roller II](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-game.html)** | Game with its AMOS boundary bug fixed, current supplied assets and music. Tested through the level-3 warp, game over, restored scores, menu return and a fresh game. |
| **[Planet Zybex](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex-game.html)** | Shooter with three AMOS vertical docking copy fixes, sound/fullscreen and keyboard/Gamepad/touch controls. Tested through level-2 docking, level-3 entry, GAME OVER and a fresh game; later progression remains open. |
| **[BobTest](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/bob-test.html)** | Original 64-object bouncing demo with live WebGL, pause/restart and fullscreen. Press a key to start its 500-frame run. |
| **[Tunnel animation](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/tunnel.html)** | Original Tunneltest animation with its supplied icon bank and IFF background. Fullscreen, frame stepping and custom IFF upload. |

[Planet Zybex development previews](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex.html)
include all seven backgrounds, ship controls and individual enemy programs.
[Planet Zybex debug build](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex-game-debug.html) adds source error logs and modified-file downloads.
See the [showcase milestone](docs/planet-zybex.md) for progress and remaining coverage.

[Build your own complete game page](docs/game-webpage-tutorial.md): compilation, assets, Play/sound/fullscreen buttons, touch controls, adjustable game speed (`--slowdown`) and optional `--debug` file downloads.

The game pages have a large red **Play Game** button for sound, fullscreen and direct launch.

The gallery also features music players and interactive examples. Compiler,
individual-command and rendering checks remain available in a collapsed section
for development. Every browser test has a self-contained demo and HTML Preview
link. See [demo instructions](demos/README.md) for local use.

[Original AMOS compiler examples](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/compiler-examples.html): all 19 sources compile into individual debug pages. See [rebuild instructions and runtime limits](docs/compiler-examples.md).

Try the [AMOS 3D car/hero animation](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amos-3d.html),
a portable rendering of the original Gru1 3D excerpt. [Supported profile and references](docs/amos-3d.md).

## Quick start

Requires Node.js; CI targets Node 22 and 24.

```sh
npm ci
node bin/amoscript examples/Test21.AMOS /tmp/program.js
node -e "require('/tmp/program.js')({ setTimeout }).tick(1000)"
```

Expected output: `Start → One → Two → Three → End` (one item per line).
Omit the output path to write JavaScript to stdout. The CLI never overwrites an
existing output file. Run `node bin/amoscript --help` for usage.

The compiler accepts tokenized `.AMOS` binaries. The `.Asc` files beside some
examples are readable references; an ASCII input frontend is still planned.

## Build a playable browser game

Use the page builder to package a game with the browser harness used by our
showcase pages: WebGL2 display, sound, fullscreen, keyboard/Gamepad input, optional
touch controls and Play/Stop/Resume/Restart buttons.

For a complete Roller II build, run these commands from the repository root:

```sh
npm ci
mkdir -p build/roller2

# Emit the standalone compiled JavaScript factory.
node bin/amoscript "examples/Roller2/current/Roller II.AMOS" build/roller2/game.js

# Compile and package the game, assets and browser harness into one HTML file.
node tools/build_game_page.js "examples/Roller2/current/Roller II.AMOS" \
  build/roller2/index.html \
  --assets examples/Roller2/current/manifest.json --prefix RII: \
  --title "Roller II" --port 1 --fire KeyZ
```

The resulting files serve different purposes:

| Output | How to use it |
| --- | --- |
| `build/roller2/index.html` | Open in a browser and click **Play Game**. It contains the compiled JavaScript, runtime, browser adapters and all manifest assets; this single file is enough to publish on a static website. |
| `build/roller2/game.js` | The same standalone program factory, for integration into your own host. It needs display/input/audio/file adapters to become a playable browser application. |

The HTML builder compiles the AMOS source itself and embeds the result; it does
not load the separately emitted `game.js`. You can omit the first compiler
command when you only need a playable page. Both commands refuse to overwrite
existing output files; remove the previous generated files before rebuilding.

Play enables sound, requests fullscreen and starts the original intro. Follow the
game's prompts to reach the menu and select a level. Arrows move and Z fires;
choose **Keyboard: Typing** when entering a name, then switch back to
**Keyboard: Joystick** to play. Gamepad and touch input work in either mode.

For your own game, replace the AMOS input and supply a JSON asset manifest:

```json
{
  "MYGAME:title.iff": "assets/title.iff",
  "MYGAME:sprites.abk": "assets/sprites.abk",
  "MYGAME:music.mod": "assets/music.mod"
}
```

Keys are the complete filenames requested by the AMOS program, including any
`Dir$` volume prefix. Local paths are relative to the manifest. With complete
names like these, omit `--prefix`; Roller II's shipped manifest instead needs
`--prefix RII:`. Omit `--assets` for programs whose banks are all embedded.

Add `--debug` for source error logs and downloads of new/modified session files,
`--slowdown 2` for longer Wait/Wait Vbl delays, or `--optimize` for optional
instruction batching. Browser file writes survive Restart but are lost on page
reload; IndexedDB persistence is planned.

For games split across several AMOS files, `--programs programs.json` precompiles
linked `Run` targets into the page. See [program chaining](docs/game-webpage-tutorial.md#link-several-amos-programs-with-run).

See the [complete webpage tutorial](docs/game-webpage-tutorial.md) for asset
preparation, custom harness wiring, touch controls and publishing. To regenerate
the repository's gallery pages, including the Roller II demo and its verification
replays, use `npm run build:demo`.

## Use from JavaScript

```js
const fs = require('fs');
const Transpiler = require('./lib/Transpiler');

const compiler = new Transpiler(fs.readFileSync('program.AMOS'));
fs.writeFileSync('program.js', compiler.toModule());

const program = require('./program.js')({
  setTimeout,
  clearTimeout,
  write: text => process.stdout.write(text)
});
program.tick(1000);
```

Generated modules embed the portable runtime and require no runtime imports.
For opt-in scalar instruction batching, use `compiler.toModule({ optimize: true })`
or `node bin/amoscript --optimize program.AMOS program.js`.
See [optimization and benchmarks](docs/optimization.md) for its scope and limits.
`tick(budget)` runs cooperatively; `stop()` and `resume()` control execution.
Browser drawing, input, fullscreen and Web Audio use optional host adapters.
File operations use synchronous adapters with preloaded browser data. Browser
writes currently stay in session memory; IndexedDB persistence is planned.

## Status and design

- [Compatibility matrix](docs/compatibility.md): implemented behavior and explicit limits.
- [Development plan](PLAN.md): current priorities and remaining work.
- [Roller II milestone](docs/roller2.md) and [Wonderland milestone](docs/wonderland.md): original-program coverage.
- [Display architecture](docs/display-architecture.md): shared CPU/WebGL snapshots and acceptance gates.
- [File adapters and paths](docs/directories.md): path handling and links to related file operations.

A compiled program or passing fixture does not establish complete AMOS
compatibility. Source-derived expectations, browser CPU/GPU comparisons and
external Amiga captures are tracked separately in the contracts.

## Development

```sh
npm ci
npm run build:demo       # Regenerate browser demos after compiler/runtime changes
npm run check            # Generated-artifact checks and unit/integration tests
npm run install:browser  # Install pinned Playwright Chromium
npm run test:browser     # Real browser rendering, input and lifecycle checks
```

`npm run check:generated` detects stale demos without rewriting files.
`npm run build:examples` regenerates synthetic examples. Inspect binaries with
`tools/dump_tokens.js` and `tools/dump_ir.js`.

The active pipeline is `Buffer → TokenReader → Parser → Lowerer → Transpiler`.
Generated programs use the instruction-function runtime in `lib/amos/`; display
models and WebGL resources live in `lib/display/`. `Grammar.js` and
`RuleFunctions.js` are legacy compatibility files. See [repository guidelines](AGENTS.md)
and [development/CI notes](docs/development.md) for verification and environment details.
