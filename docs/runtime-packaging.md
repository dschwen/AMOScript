# Runtime packaging

The compiler, page builder and desktop form expose these modes:

| Mode | CLI / project value | Output | Status |
|---|---|---|---|
| Shared runtime | `shared` | Program/HTML plus adjacent `libamoscript.js` | Implemented |
| Full bundled runtime | `full` | Self-contained program/HTML | Implemented; default |
| Minimal bundled runtime | `minimal` | Self-contained output with selected runtime parts | Planned; disabled in GUI |

Minimal mode currently reports an explicit not-implemented error in the CLI/API.
It never silently emits a full bundle. See the [selective bundling plan](minimal-runtime-plan.md).
Existing saved projects without a runtime setting continue to use full mode.

## CLI

```sh
# HTML and libamoscript.js, in the same directory
node tools/build_game_page.js program.AMOS game.html --runtime shared --minify

# Small executable JS module and the same library filename
node bin/amoscript --runtime shared --minify program.AMOS program.js

# Existing one-file output
node tools/build_game_page.js program.AMOS game.html --runtime full --minify
```

A shared compiler build requires an output filename; stdout cannot supply the
adjacent library. Debug and minification remain independent of runtime packaging.
Shared output works from disk and from static hosting. Upload/copy **both files**
and keep their relative paths. There is no CDN or installed-runtime requirement.

The library contains VM code, supported extension implementations, browser/input/
audio adapters, the WebGL renderer and the common page harness. It contains no
compiled game, game banks, imported files or per-project settings. Those remain
in the program/HTML. The universal library includes AMCAF support even when an
individual program does not use it; compile-time extension slots still need to
be assigned explicitly.

All linked `Run` targets use that same library. Factories still create independent
VM state, variables, bank allocations, display ownership and audio sessions.
Full mode preserves the existing complete runtime emission for each program.

Shared mode reduces per-game duplication and allows browser caching across games.
For one small game, the total library-plus-HTML size can exceed a full bundle,
because the shared library includes all supported profiles and browser adapters.
Binary assets remain in the HTML; this option does not externalize them.

## Desktop and project API

Choose **Runtime packaging** on the Page options form. Shared previews serve only
the generated HTML and its generated library through the isolated preview
protocol. Games receive no new Node, builder IPC or filesystem privileges.
Export writes the library beside the chosen HTML and lists it in the result.

Projects store `options.runtime: "shared"` (or `"full"`). The project CLI exports
all artifacts too:

```sh
node tools/build_project.js MyGame.amos-project.json game.html
```

For custom builders:

```js
const {buildGameBundle} = require('./tools/build_game_page');
const {exportHTML} = require('./tools/project');
const bundle = buildGameBundle(sourceBytes, {runtime: 'shared', minify: true});
exportHTML('game.html', bundle.html, bundle.files);
```

`buildGamePage()` remains an HTML-string API. In shared mode its string references
the library; use `buildGameBundle()` to obtain both outputs. `buildProject()` also
returns `html`, `files` and `stats`. Existing two-argument `exportHTML()` calls
remain valid for bundled pages.

The lower-level `Transpiler.toModule({runtime:'shared'})` emits a program requiring
`./libamoscript.js` in Node or `globalThis.AMOS_RUNTIME` in the browser.
`Transpiler.runtimeSource()` emits the VM-only library; the page builder's
`buildRuntimeLibrary()` emits the universal library used by CLI/GUI exports.

## Matching and existing files

Programs check a fingerprint of the runtime definitions before creating a VM.
Shared HTML additionally checks the browser harness fingerprint. Missing or
incompatible libraries fail with instructions to ship the matching library.
Do not mix arbitrary compiler builds merely because their filenames match.

Exports preflight all destinations. An existing regular `libamoscript.js` is
reused only when its contents exactly match the generated file. A different
library, including a differently minified variant, is never overwritten: use a
separate directory or matching build options. Existing HTML/JS output is always
refused. Failures roll back files created by that export, preserving existing
files. The main output cannot itself be named `libamoscript.js`.

## Demo and verification

[Shared runtime demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/shared-runtime.html)
loads [libamoscript.js](../demos/libamoscript.js) and follows a synthetic linked
`Run`. Browser checks assert one library load, two VMs, WebGL output and CPU/GPU
pixel parity. Unit and desktop tests cover extension support, VM isolation,
fingerprint rejection, save/reopen, sidecar export and collision handling.
