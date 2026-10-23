# Dithell's Wonderland milestone

Original unmodified program and seven companion assets from
[AMOS Professional Official](https://github.com/AOZ-Studio/AMOS-Professional-Official/tree/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/AMOS/Productivity2/Wonderland).
`manifest.json` pins the revision, byte lengths and SHA-256 hashes.
`UPSTREAM-LICENSE` preserves the upstream MIT license.

The game does not compile/run yet. Its first nine lines execute as a startup
fixture. See [the assessment](../../docs/wonderland.md)
and [the startup/asset demo](../../demos/wonderland.html). The original program
uses Amiga volume paths; the eventual browser files adapter must resolve those
paths to these bytes, rather than editing the program to use different filenames.

Audit from the repository root:

```sh
node tools/audit_program.js examples/Wonderland/Wonderland.AMOS
```

This inventories original tokens and compiler failures; recognition is not a
claim of parser/runtime support. No Amiga execution capture is included.
