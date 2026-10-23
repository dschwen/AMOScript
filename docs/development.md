# Development and CI

Use Node 22 or 24 with npm and the committed package lock. The GitHub Actions
workflow targets those majors on Ubuntu 24.04; Chromium runs on Node 24. Node's
[release policy](https://nodejs.org/en/about/previous-releases) describes its LTS
baseline. The project also passes checks on local Node 18.19.1, but that older
runtime is not in the CI matrix.

## Reproduce the checks

The [display architecture](display-architecture.md) retains the JavaScript test
runner and Playwright. Planned snapshot fixtures and WebGL readback checks extend
these tools; existing Canvas checks do not establish GPU parity. SwiftShader
results alone will not establish hardware performance.

```sh
npm ci
npm run check
npm run install:browser
npm run test:browser
```

`npm run check` verifies all three generated modules and browser gallery pages,
then runs the full unit,
CLI and integration suite, including Test7/14/21. The browser test separately
checks Canvas pixels, input, buffering/Bob composition, program switching and Stop.

The lockfile pins Playwright 1.59.1, which selects the Chromium revision. Both
installer and smoke test use `.cache/ms-playwright`, unless an explicit
PLAYWRIGHT_BROWSERS_PATH overrides it. Other browser engines are not verified.

On a fresh supported Linux host that lacks browser system libraries:

```sh
npm run install:browser -- --with-deps
```

This forwards `--with-deps` to Playwright and may require system package-manager
permissions. It is the CI command, following
[Playwright's CI setup](https://playwright.dev/docs/ci-intro). To inspect revision
and download paths without installing, use
`npm run install:browser -- --dry-run`. A browser-only installation still needs
system libraries to be present.

## Generated demos

| Input | Generated module |
| --- | --- |
| examples/Test21.AMOS | examples/compiled-demo.js |
| examples/Graphics.AMOS | examples/compiled-graphics.js |
| examples/Bobs.AMOS | examples/compiled-bobs.js |

After codegen/runtime changes, run `npm run build:demo` and include the regenerated
modules and gallery pages. `npm run check:generated` compares bytes against fresh
compiler/scenario output,
reports every missing/stale module and exits nonzero without writing files.
`npm run test:browser` checks instead of automatically rebuilding, so browser
verification cannot conceal stale output.

`npm run build:examples` separately regenerates synthetic source fixtures; it is
not required for testing. Independent conformance encodings are not regenerated
from production token tables.

## Workflow and evidence

[The workflow](../.github/workflows/ci.yml) runs on pushes, pull requests and manual
dispatch. Unit jobs cover both Node majors independently. The browser job installs
Chromium plus Linux libraries and uploads any PNG screenshots in `test/artifacts/`
with seven-day retention. Actions are pinned to immutable commits, checkout does
not persist credentials, and workflow permissions are read-only.

Local verification used a separate project copy, clean `npm ci`, and SHA-256-checked
official Node 22.23.4 and 24.22.1 Linux binaries. Both passed all 248 tests and the
generated-artifact gate. Node 18.19.1 passed as well. Chromium passed under Node 24
using the matching pinned browser from the existing local cache, including
standalone bank load/save/reload/appending/reservation/swap/shrink/erasure and exact image/Bob
restoration pixels. Installer flag
forwarding was checked with `--dry-run`; system dependencies were already present
locally. Fresh Ubuntu system installation and hosted workflow execution remain
pending until CI runs. Inspect that result before claiming CI is green.

Those cross-version results predate the direct-sprite source increment. D0
baseline restoration regenerated all three demos; local `npm run check` now
passes 328 tests including snapshots, chip memory, physical-buffer export,
planar/copper/stack fixtures, EHB/DPF/scroll, HAM6 and explicit interlace goldens. `npm run test:browser`
also passes, adding direct-sprite manual
updates, movement, instance isolation and cursor restoration. The browser command
explicitly selects SwiftShader and requires WebGL2: its new probe samples R8UI
chip bytes at row boundaries/high addresses, writes an RGBA8UI framebuffer and
checks exact readback after converting bottom-up rows to top-left order. The same
command runs in CI; no new hosted result or hardware performance is claimed.

The [snapshot contract](display-snapshots.md) documents ABI v1, the hashed fixture
loader and exact RGBA/PNG mismatch reports. Its test inputs use independent wire
and PNG encodings, not production-encoder round trips alone. Chromium separately
decodes an emitted PNG artifact and compares its bytes to WebGL readback. Artifacts
`webgl-readback.png` and `webgl-readback-diff.png` join the existing screenshots.
The same browser command now also checks native planar pixels from an embedded
generated module, plus pixels from the same buffer after copper-built scanout.
See [the planar contract](planar-display.md) and [copper contract](copper-display.md) for scope and the
distinction between migration parity and hardware evidence.

The [mode contract](display-modes.md) records source-backed EHB/palette/hires rules,
independent EHB and laced IFF/PNG fixtures, and explicit field composition. Chromium
also checks EHB bytes through Canvas, planar and copper output and saves `ehb.png`.
These checks do not establish live interlace timing or external hardware captures.

## Legacy code inventory

The package entry, CLI, dump tools and tests use the active
Buffer → TokenReader → Parser → Lowerer → Transpiler pipeline. A repository import
search found no active consumers of Grammar.js or RuleFunctions.js. Grammar.js
imports RuleFunctions.js and the still-active TokenTable.js.
`lib/amos/system.js` also has no active imports/script tags.

These files remain in place. The package has no exports map restricting deep
imports, so repository searches cannot prove absence of external consumers.
Set a compatibility/removal policy before deleting them. Contributor architecture
guidance and commands are documented in [AGENTS.md](../AGENTS.md).

The browser command now also runs the native non-HAM GPU parity corpus: 151
frames, including independent image fields, mode/sprite/copper matrices and 100
fixed-seed cases. Context restoration reruns the actual decode/resolve passes.
See [GPU renderer coverage and limits](webgl-renderer.md); local SwiftShader
results do not establish hosted CI, remaining mode/capture gates or performance.

All browser scenarios also ship as self-contained HTML in the
[demo gallery](../demos/README.md), with local and htmlpreview.github.io links.
The generated-artifact gate covers those pages. Chromium opens all nine scenario
pages with HTTP requests blocked and exercises input/lifecycle checks on the
generated interactive page. Scenario inputs and assertions share one catalogue.
