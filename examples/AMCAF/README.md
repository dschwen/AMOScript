# AMCAF examples

Original supplied AMCAF distribution, moved here from `amcaf_examples/` without
changing program or asset bytes. The native programs retain their author comments
and any embedded banks. `AMCAF_Examples.info` and `ExecuteMeFirst!`/its Workbench
icon are retained alongside the original directory layout.

- `AMCAF_Examples/`: twelve tokenized AMOS programs and four shared data files.
- `inventory.json`: source hashes and static extension-call inventory; it is not
  a runtime support claim.
- [Demo catalogue](../../demos/amcaf-examples.html): playable pages or exact build
  blockers for every program, with HTML Preview links.
- [Compatibility plan and rebuild instructions](../../docs/amcaf-examples.md).

`npm run build:demo` rebuilds repository pages. `npm run build:amcaf` writes a
separate catalogue plus compilable standalone modules under `build/amcaf-examples`
and returns nonzero while any program remains blocked. Browser pages preload
relative and `AMCAF_Examples:` asset names; native Assign installation is not
needed for these pages.
