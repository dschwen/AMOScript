# AMOScript Builder

AMOScript Builder is an Electron desktop interface for compiling tokenized AMOS
programs into standalone browser pages. It reuses the same compiler and page
harness as the CLI. The exported HTML runs independently of Electron.

Try the [prepared interface walkthrough](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/project-builder.html)
in your browser. Its directory buttons use a declared sample; real native imports
and preview isolation are exercised by the Electron app tests.

## Use the app

1. **Choose program** selects the main `.AMOS` file.
2. **Import directory** adds an asset folder. Enter the volume label used by the
   program, including its colon: for example `GAME:` or `DATA:`. A folder's
   `Levels/One` becomes `GAME:Levels/One`. Leave the label empty for ordinary
   relative filenames. Importing a folder under two distinct labels creates aliases.
3. Choose title, display backend, joystick port/fire keys, speed and touch controls.
   Advanced options enable instruction combining, debug exports and explicit
   [extension slot mappings](extension-profiles.md).
4. **Build & preview** compiles in a worker and opens a separate game window.
   Click Play Game there. Preview always enables diagnostics so missing AMOS paths
   and source locations can be reported back in the builder. Only one preview is
   retained. Closing/replacing a preview retires its game/audio state.
5. **Export HTML** rebuilds from the current files and saves a single page with
   the program, imported assets, sound/input/fullscreen adapters and controls.
   Export follows your Debug setting. Choose a new output filename; existing HTML
   files are not overwritten.

Save/reopen projects with the toolbar or Ctrl/Cmd+S and Ctrl/Cmd+O. The project is
JSON and stores paths relative to its own location where the OS permits. Keep
source files, assets and project together to move between machines. Absolute
paths to another drive are machine-specific and can be reassigned in the app.
Opening a project displays its paths but does not automatically compile or run it.

Import only game assets, and keep generated exports outside imported folders.
Every regular file in a selected directory is included recursively, including
hidden files. Virtual names use Unicode NFC (including decomposed macOS filenames) and
case-insensitive AMOS path collisions are errors. Symlinks/junctions
are rejected. Current limits are 32 mounts, 16 MiB total assets (including aliases),
10,000 files, 20,000 tree entries and 64 directory levels. The main program is
limited to 16 MiB, and desktop builds have a two-minute timeout.

Game writes affect the exported harness's in-memory session filesystem, not the
imported directories. Preview blocks downloads and network access; to download
modified session files, export with Debug and open the HTML in a browser.
Compiled `Run` targets are not discovered automatically. Custom font preparation,
disk-image import, a source editor and IndexedDB persistence remain separate work.
The existing advanced page-builder API still supports explicitly linked programs.

## Run from source

Use Node 24 and install the root dependencies, then the separate desktop package:

```sh
npm ci
npm run desktop:install
npm run desktop
```

On Windows PowerShell, use `npm.cmd` if required by your execution policy.
The desktop install downloads the pinned Electron binary. End users of packaged
installers do not install Node, npm, Git or Python. The CLI's ordinary production
install does not download Electron.

## The same project from the CLI

```json
{
  "version": 1,
  "main": "Main.AMOS",
  "mounts": [
    { "label": "GAME:", "directory": "Disk1" },
    { "label": "DATA:", "directory": "Disk2" }
  ],
  "options": {
    "title": "My game",
    "renderer": "webgl",
    "port": 1,
    "fire": ["Space", "Enter"],
    "slowdown": 1,
    "touch": "auto",
    "optimize": false,
    "debug": false
  }
}
```

Save as `game.amos-project.json`, then run:

```sh
node tools/build_project.js game.amos-project.json game.html
```

The portable Windows CLI bundle also offers
`.\build-project.cmd game.amos-project.json game.html`.

Options may be omitted to use defaults. `slowdown` is a factor (2 = 50% speed),
not a frame-rate replacement. Fire entries are browser keyboard codes. Touch is
`auto`, `always` (in fullscreen), or `off`. Unknown fields and invalid values
reject before export. The desktop export and CLI call the same project backend;
preview differs only by enabling diagnostics.

## Installers and builds

```sh
npm run desktop:pack
npm run desktop:dist
```

`desktop:pack` creates an unpacked app; `desktop:dist` creates the native installer
under `dist/desktop`. Windows uses an NSIS per-user installer, macOS a DMG and
Linux an AppImage. Build on the target OS. Current release builds are unsigned;
public signing/notarization requires separately configured publisher credentials.
Linux AppImage execution depends on the host's AppImage/FUSE and Chromium sandbox
support; the unpacked app can also be launched directly on a suitable system.

The staging tool copies only application/compiler sources, the production
JavaScript dependency and notices. It excludes games, fixture data, development
tools and local uploads. Root package version determines the packaged app version.
Tagged release CI builds installers on Windows, macOS and Linux, alongside the
portable Windows CLI ZIP, after the test gates pass. Existing release tags are
not moved; GUI assets become available with the next release containing this code.

## Architecture and testing

- `tools/project.js`: project validation, relative serialization, directory mapping
  and shared page generation. It does not change compiler or bank semantics.
- `desktop/main.js`: native dialogs, IPC validation, worker ownership and export.
- `desktop/preload.js`: individual project actions; no generic IPC/filesystem API.
- `desktop/build-worker.js`: compilation/imports off the UI thread.
- `desktop/renderer.js`: project form, status and error presentation.

The builder UI has context isolation, renderer sandboxing and Node integration
disabled. Game previews use a separate ephemeral session, no preload, no Node,
no builder API, no network, no arbitrary navigation or popup windows. Only the
compiled page is served through a private protocol; it cannot fetch host files.
Preview requests cannot invoke the builder's IPC handlers. JavaScript is allowed
inside the preview because the compiled program is JavaScript.

```sh
npm run test:desktop
```

On headless Linux use `xvfb-run -a npm run test:desktop`. The smoke runner uses
`--no-sandbox` only for its Linux automation environment; production window
configuration keeps sandboxing enabled. This test flag does not establish
operating-system sandbox correctness. The test exercises native-dialog results,
imports, save/reopen, worker builds, isolated preview/error reporting, identical
CLI/GUI export and output protection. `AMOSCRIPT_DESKTOP_EXECUTABLE` can point it
at a packaged executable to run the same checks against ASAR-packaged code.

Electron references: [context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation),
[security](https://www.electronjs.org/docs/latest/tutorial/security).

## Extension slots and AmigaOS compatibility

Under **Advanced**, use **Add extension**, then select its library and slot.
Use the assignments from your AMOS installation; the program does not identify
which extension occupies each slot. Existing saved slot mappings
load into the selectors unchanged. Extension support remains partial.

Some programs inspect Exec's version through `Deek(Leek(4)+20)`. Choose an
explicit **AmigaOS compatibility** profile matching the version expected by the
program, for example **AmigaOS 3.1 (Exec 40)**. The default has no system
memory profile and such reads fail. This enables only the existing bounded,
read-only version view, not arbitrary OS memory access or an operating system.
The choice is saved as `options.systemInfo: {"execVersion":40}` and applies to
both preview and exported HTML. Existing projects without it retain the default.

Planned automatic diagnostics are described in [AmigaOS memory-read detection](amigaos-memory-diagnostics-plan.md). They are not implemented yet.
