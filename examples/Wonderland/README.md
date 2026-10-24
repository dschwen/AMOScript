# Dithell's Wonderland milestone

Original unmodified program and seven companion assets from
[AMOS Professional Official](https://github.com/AOZ-Studio/AMOS-Professional-Official/tree/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/AMOS/Productivity2/Wonderland).
`manifest.json` pins the revision, byte lengths and SHA-256 hashes.
`UPSTREAM-LICENSE` preserves the upstream MIT license.

The unmodified game compiles. Controlled game entry reaches level 1 and stops at
four-plane sprite publication at Wait Vbl line 204; playable gameplay is unfinished. Its first 64 lines execute as a title-setup
fixture. See [the assessment](../../docs/wonderland.md)
and [the startup/asset demo](../../demos/wonderland.html). An
[interactive original-menu fixture](../../demos/wonderland-menu.html) also runs
with keyboard mapping and Gamepad API options, stopping before game/editor dispatch.
The [screen-window fixture](../../demos/screen-windows.html) executes original
game/editor window setup and verifies landscape scrolling and both panels.
The [computed-branch fixture](../../demos/computed-branches.html) runs the original
enemy dispatch and three unchanged initialization routines, with declared guards
for the remaining two targets. The [keyboard fixture](../../demos/scancodes.html)
runs the original Scancode/Escape branch and title routine with synthetic input
and screen setup, stopping before game/menu/editor loops. The
[Fade fixture](../../demos/fade.html) joins the original title and post-death
Fade/Wait lines with explicit input guards and independently checked RGB frames.
The [Print Using fixture](../../demos/print-using.html) copies original level/score
statements and compares panel fields with a separate glyph rasterizer.
The original program uses Amiga volume paths; the browser files adapter resolves
those paths to preloaded asset bytes, preserving the original source filenames.

Audit from the repository root:

```sh
node tools/audit_program.js examples/Wonderland/Wonderland.AMOS
```

This inventories original tokens and compiler failures; recognition is not a
claim of parser/runtime support. No Amiga execution capture is included.
