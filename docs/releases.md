# Tagged Windows releases

The [release workflow](../.github/workflows/release.yml) builds a portable
Windows x64 distribution when a `v*` tag is pushed. A release tag must match
`package.json`: `v0.0.1` for package version `0.0.1`, for example. Prerelease
versions such as `v0.0.2-rc.1` are marked prerelease on GitHub.

## What the workflow publishes

- `AMOScript-vX.Y.Z-windows-x64.zip`: compiler, HTML page builder, four `.cmd`
  launchers, Node 24 x64, the locked production dependency, two samples,
  quick-start instructions and license notices.
- `SHA256SUMS.txt`: SHA-256 of that ZIP.
- GitHub also provides the tag's ordinary source archives, for macOS/Linux and
  users who want the full source tree.

The portable ZIP is a minimal tool distribution, not an archive of every game,
demo, test fixture, browser binary or local upload. The assembler uses an explicit
allowlist; only `examples/Test21.AMOS` and `examples/Graphics.AMOS` are included.
It copies the actual Node executable and its LICENSE from the official runtime
installed by `actions/setup-node`, records its exact version in `release.json`,
and preserves the production dependency's MIT notice. The compiler's package
license is GPL-3.0-or-later; the GPL text is included as `LICENSE`.

## Validation before publication

The existing CI workflow is reusable through `workflow_call`. The release calls
it for the compiler checks on Node 22/24 and the Chromium tests. Ordinary CI push
runs are restricted to branches so a tag does not run the same checks twice.

Native desktop installers (Windows NSIS, macOS DMG, Linux AppImage) are also
built and tested from the staged application. See [desktop builds](desktop-builder.md).

A separate Windows CLI job installs only locked production dependencies, stages the
portable distribution, and runs smoke checks. It then compresses the directory,
extracts the actual ZIP into a path containing spaces, and repeats those checks:

- Bundled Node and license files exist.
- CLI help works and quoted input/output paths work through `.cmd` launchers.
- Test21 compiles and executes with the expected five output lines.
- Existing outputs are rejected without overwriting them.
- Graphics compiles into a standalone HTML page.
- Development dependencies, full games and repository metadata are absent.

Publication requires CI, portable packaging and every desktop installer job to succeed. Only the publish
job has `contents: write`; it also has `actions: read` to download the tested
artifact. The other jobs keep read-only repository access. Checkout credentials
are not persisted, action versions are commit-pinned, and tag values are passed
through environment variables and validated before assembly.

GitHub CLI creates the release with `--verify-tag --generate-notes` and uploads
the tested ZIP/checksum. Existing release/tag contents are not replaced by a
force push or an asset `--clobber`. If a release already exists, a rerun fails
rather than overwriting it automatically. A failed publish can leave a partial
release; inspect it before retrying or repairing it.

References: [GitHub CLI release creation](https://cli.github.com/manual/gh_release_create)
and [workflow permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions).

## Cut a release

From an up-to-date, clean `master` checkout after reviewing the changes:

```sh
npm version 0.0.2 --no-git-tag-version
git add package.json package-lock.json
git commit -m "Release 0.0.2"
git tag -a v0.0.2 -m "AMOScript 0.0.2"
git push origin master
git push origin v0.0.2
```

Choose the actual next version. If releasing the already committed `0.0.1`,
skip the version-bump commit and tag that chosen commit as `v0.0.1`. The first
portable download will not exist until a tag workflow successfully publishes it.
Do not move an existing public version tag to repair a release; use a new version
or inspect/repair the failed publication deliberately.

Check the Windows release workflow on GitHub and inspect the downloaded artifact
before announcing it. Local Linux smoke tests exercise copied tooling and compiled
outputs, but cannot establish that Windows batch launchers or hosted workflows
have passed. The Windows packaging job is the authoritative platform check.

No release is created merely by adding this workflow or pushing a branch.
