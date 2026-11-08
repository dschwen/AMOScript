# Quick start: Windows, macOS and Linux

AMOScript compiles **tokenized AMOS BASIC `.AMOS` files** into JavaScript or a
complete browser page. You do not need an Amiga emulator or an AMOS installation
to compile an existing supported program. Readable `.Asc` listings are references,
not accepted compiler input yet. Not every AMOS instruction or extension is
implemented; unsupported features report a source location.

For the graphical directory-import/project workflow, see
[AMOScript Builder](https://github.com/dschwen/AMOScript/blob/master/docs/desktop-builder.md).

## What do I need?

| Task | Requirements |
| --- | --- |
| Play an existing HTML demo | A modern browser; WebGL2 for the GPU renderer. No Node, Git or Python. |
| Compile/build pages with the portable Windows ZIP | Windows x64 supported by its bundled Node runtime. Everything needed for compilation is included. |
| Compile/build pages from source on any OS | Node.js **24 recommended** and its bundled npm. Node 22 is also tested. Run one dependency-install command below. |
| Download source | A browser and ZIP extraction. Git is optional. |
| Run core tests or rebuild repository demos | Node/npm with development dependencies (`npm ci`). Python is not required. |
| Run automated browser tests | Development dependencies plus the Playwright Chromium download. Linux may need browser system packages. |
| Regenerate independent reference fixtures | Python 3 for the scripts in `tools/reference/`; this is a contributor task. Existing fixtures are checked in. |

The compiler's production dependency is JavaScript. Visual Studio, Xcode, a C/C++
compiler, Make, Java, Python and a global Playwright installation are not needed
to compile or build an HTML page. A generated page contains its runtime and
preloaded assets; people playing it do not need Node or npm.

## Windows: portable ZIP, no Git or installation required

1. Open [AMOScript releases](https://github.com/dschwen/AMOScript/releases).
2. Under the chosen release's **Assets**, download
   **`AMOScript-vX.Y.Z-windows-x64.zip`**. Pick the ZIP asset, not the automatic
   “Source code” archive, if you want the bundled runtime.
3. Right-click the ZIP, choose **Extract All**, and open the extracted folder.
   Extract the whole archive; do not run its tools from inside the ZIP viewer.
4. Open that folder in Terminal/PowerShell. File Explorer's address bar can also
   be used to launch `powershell` in the current folder.
5. Run:

```powershell
.\node.cmd --version
.\amoscript.cmd --help
.\amoscript.cmd examples\Test21.AMOS program.js
.\node.cmd -e "require('./program.js')({ setTimeout }).tick(1000)"
```

The program prints these five lines:

```text
Start
One
Two
Three
End
```

Build a browser example from the same folder:

```powershell
.\build-page.cmd examples\Graphics.AMOS graphics.html --title "My first AMOS page"
Start-Process .\graphics.html
```

Click **Play Game** to start the sample. It is a graphics example, despite the
shared button label. The page includes its JavaScript; you can copy `graphics.html`
to another machine or static website.

The `.cmd` tools use the Node executable in `runtime`; they do not require a
system Node installation or `npm install`. No administrator privileges are
needed to extract/use the archive. It contains two samples, the compiler and
page builder, rather than the repository's full games/demo collection.

**Before the first tagged release exists:** there will be no portable ZIP asset
to download. Use the Windows source instructions below. New ZIPs are produced
when maintainers push a matching version tag; see [release maintenance](https://github.com/dschwen/AMOScript/blob/master/docs/releases.md).
Windows ARM64 users can use the source instructions with an ARM64 Node installer;
the portable release currently targets x64 only.

## Install Node for a source checkout or source ZIP

Skip this section for the portable Windows ZIP. For source installs, choose
**Node 24** from the [official Node download page](https://nodejs.org/en/download)
or [Node 24 archive](https://nodejs.org/en/download/archive/v24).
The recommendation is the project's tested major, not a claim that another
major is the latest release. Node 24 requires Windows 10/Server 2016 or newer,
or macOS 13.5 or newer; Linux binaries have their own kernel/libc baseline. See
[Node 24 supported platforms](https://github.com/nodejs/node/blob/v24.x/BUILDING.md#platform-list).
These are runtime platform requirements; you are downloading a prebuilt runtime,
not building Node from source.

### Windows

Download the official Windows `.msi` installer for your machine (x64 or ARM64).
Keep npm and the normal PATH option enabled. Optional native-module build tools
are unnecessary for AMOScript. Close/reopen Terminal after installation.

In PowerShell, verify with:

```powershell
node --version
npm.cmd --version
```

Use `npm.cmd` in the commands below if PowerShell blocks `npm.ps1` with an
execution-policy error. There is no need to change your execution policy just
to install this project's JavaScript dependencies.

### macOS

Download/run the official macOS Node 24 installer. Choose the appropriate
architecture when offered: Apple Silicon is ARM64; older Intel Macs are x64.
Open a new Terminal window and check:

```sh
node --version
npm --version
```

Homebrew is not required. An existing Node version manager is also fine if it
selects the tested major and exposes both `node` and `npm` in your terminal.

If the installer is not offered for your Mac's architecture, use the matching
`darwin-x64` or `darwin-arm64` binary `.tar.gz` from the Node archive. Save it
as `node24-macos.tar.gz` in Downloads, then install it without Homebrew:

```sh
mkdir -p "$HOME/.local/opt/node24"
tar -xzf "$HOME/Downloads/node24-macos.tar.gz" -C "$HOME/.local/opt/node24" --strip-components=1
export PATH="$HOME/.local/opt/node24/bin:$PATH"
node --version
npm --version
```

Add that `export` line to `~/.zshrc` for future Zsh terminals.

### Linux

An existing Node 22/24 installation is sufficient. Otherwise, use the official
Node 24 download page's Linux binary for your CPU: usually x64 on PCs or ARM64
on ARM systems. The following manual installation needs `tar` with XZ support,
but no root privileges or Git:

1. Download the **binary `.tar.xz`**, not the source archive.
2. Save/rename it to `node24-linux.tar.xz` in `~/Downloads`.
3. Run:

```sh
mkdir -p "$HOME/.local/opt/node24"
tar --extract --xz --file="$HOME/Downloads/node24-linux.tar.xz" --directory="$HOME/.local/opt/node24" --strip-components=1
export PATH="$HOME/.local/opt/node24/bin:$PATH"
node --version
npm --version
```

Add the `export PATH=...` line to your shell's startup file (`~/.bashrc` for
Bash or `~/.zshrc` for Zsh) to keep it in future terminals. Your Linux distribution
must meet the selected Node binary's system requirements. Distribution packages
are another option, but check `node --version`: some ship an older major.

## Download source without Git

These steps work on all three systems:

1. Open the [repository](https://github.com/dschwen/AMOScript).
2. Choose **Code → Download ZIP** for the current development tree. Alternatively,
   choose a release's **Source code (zip)** for a particular tagged version.
3. Extract the archive to a writable folder. Its name may be `AMOScript-master`
   or include the chosen tag; use the actual folder name below.
4. Open a terminal and change into the extracted project folder, which contains
   `package.json`. Keep the whole project tree together.

Optional Git alternative:

```sh
git clone https://github.com/dschwen/AMOScript.git
cd AMOScript
```

### Windows source commands

```powershell
cd "$HOME\Downloads\AMOScript-master"
npm.cmd ci --omit=dev
node bin/amoscript examples/Test21.AMOS program.js
node -e "require('./program.js')({ setTimeout }).tick(1000)"
node tools/build_game_page.js examples/Graphics.AMOS graphics.html --title "My first AMOS page"
Start-Process .\graphics.html
```

### macOS and Linux source commands

```sh
cd "$HOME/Downloads/AMOScript-master"
npm ci --omit=dev
node bin/amoscript examples/Test21.AMOS program.js
node -e "require('./program.js')({ setTimeout }).tick(1000)"
node tools/build_game_page.js examples/Graphics.AMOS graphics.html --title "My first AMOS page"
```

Open `graphics.html` from your file manager. On macOS you can also run
`open graphics.html`; on desktop Linux use `xdg-open graphics.html`.
The console program should print the same five lines shown above.

The first `npm ci` needs network access to download the locked production
dependency. `--omit=dev` skips Playwright and other development-only dependencies.
After that, compilation and this self-contained sample need no download.
`npm install -g` and an npm registry publication of AMOScript are not required.

## Compile your own program and build a playable page

Quote filenames containing spaces. Run source commands from the project root:

```sh
node bin/amoscript "My Game.AMOS" "my-game.js"
node tools/build_game_page.js "My Game.AMOS" "my-game.html" --title "My Game"
```

Portable Windows equivalents:

```powershell
.\amoscript.cmd "My Game.AMOS" "my-game.js"
.\build-page.cmd "My Game.AMOS" "my-game.html" --title "My Game"
```

The JavaScript file is a program factory for embedding; it does not automatically
start when executed with `node my-game.js`. The HTML page embeds the factory,
browser adapters and controls and starts from **Play Game**. External files used
by the AMOS program must be preloaded with an asset manifest, for example:

```sh
node tools/build_game_page.js "My Game.AMOS" "my-game.html" --assets assets.json --title "My Game"
```

See the [complete webpage tutorial](https://github.com/dschwen/AMOScript/blob/master/docs/game-webpage-tutorial.md)
for manifests, original-game examples, sound, fullscreen, controls, debug exports
and linked programs. Use `--debug` for the Debug menu and expanded source errors.
The portable `.\build-page.cmd` accepts the same options as the Node page builder.

Outputs are created exclusively: neither tool overwrites an existing output.
Choose a new filename or deliberately remove the previous generated file first.
If an output is in a subdirectory, create that directory before building.

## Optional development setup

Use the **full source ZIP or Git checkout**, not the minimal Windows bundle.
From the project root:

```sh
npm ci
npm run check
npm run build:demo
```

On Windows, spell those npm commands `npm.cmd ...` if using PowerShell. The
checked-in demos are already built; rebuilding is not an installation requirement.
Core checks take several minutes and do not need Python or a browser download.

For browser testing:

```sh
npm run install:browser
npm run test:browser
```

On Linux, if Chromium's system libraries are missing, use
`npm run install:browser -- --with-deps` instead. That optional dependency step
may need package-manager privileges. The project downloads its pinned Chromium;
you do not need to install a global `playwright` command. None of this is needed
to open a generated game page in your normal browser.

Python 3 is only needed when deliberately running reference-generation scripts
under `tools/reference`. The tests read their already-generated fixtures. See
[development notes](https://github.com/dschwen/AMOScript/blob/master/docs/development.md)
for CI, reference tooling and generated artifacts.

## Troubleshooting and updates

| Symptom | What to check |
| --- | --- |
| `node`/`npm` not found | Reopen the terminal after installation; check PATH. Portable Windows users should use `.\node.cmd` and the supplied tool launchers. |
| PowerShell blocks `npm.ps1` | Run `npm.cmd` instead. |
| Cannot find `package.json` or a local tool | Change into the extracted project root; do not copy just `bin/amoscript` out of the project. |
| Cannot find `binary-search-bounds` | In a source tree run `npm ci --omit=dev`; for the portable bundle, extract all files including `node_modules`. |
| Windows sees only files inside a ZIP viewer | Use Extract All first. |
| Compiler refuses an output | It already exists; choose another filename or remove it intentionally. |
| Source file rejected | Use tokenized `.AMOS`, not `.Asc`; unsupported tokens/features report line/byte locations. |
| Missing files when playing | Add the program's files to the page-builder manifest; a local Amiga path is not a browser file automatically. |
| Fullscreen/audio unavailable | Start with the page button in a modern browser; iframe permissions and browser/device policies can restrict these APIs. |

To update without Git, download a new release into a **new folder**. Keep your
own `.AMOS` files/assets outside the old tool folder, and copy only the files you
intend to carry forward. A source ZIP needs `npm ci --omit=dev` again; a portable
Windows ZIP already includes its production dependency and Node runtime.
