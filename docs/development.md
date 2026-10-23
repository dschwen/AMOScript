# Development and CI

Use Node 22 or 24 with npm and the committed package lock. The GitHub Actions
workflow targets those majors on Ubuntu 24.04; Chromium runs on Node 24. Node's
[release policy](https://nodejs.org/en/about/previous-releases) describes its LTS
baseline. The project also passes checks on local Node 18.19.1, but that older
runtime is not in the CI matrix.

## Reproduce the checks

```sh
npm ci
npm run check
npm run install:browser
npm run test:browser
```

`npm run check` verifies all three generated modules and then runs the full unit,
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
modules. `npm run check:generated` compares bytes against fresh compiler output,
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
official Node 22.23.4 and 24.22.1 Linux binaries. Both passed all 234 tests and the
generated-artifact gate. Node 18.19.1 passed as well. Chromium passed under Node 24
using the matching pinned browser from the existing local cache, including
standalone bank loading/appending/reservation/erasure and exact image/Bob
restoration pixels. Installer flag
forwarding was checked with `--dry-run`; system dependencies were already present
locally. Fresh Ubuntu system installation and hosted workflow execution remain
pending until CI runs. Inspect that result before claiming CI is green.

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
