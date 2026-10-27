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
| **[Tunnel animation](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/tunnel.html)** | Original Tunneltest animation with its supplied icon bank and IFF background. Fullscreen, frame stepping and custom IFF upload. |

[Build your own complete game page](docs/game-webpage-tutorial.md): compilation, assets, Play/sound/fullscreen buttons and optional touch controls.

Both game pages have a large red **Play Game** button for sound, fullscreen and direct launch.

The gallery also features music players and interactive examples. Compiler,
individual-command and rendering checks remain available in a collapsed section
for development. Every browser test has a self-contained demo and HTML Preview
link. See [demo instructions](demos/README.md) for local use.

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
