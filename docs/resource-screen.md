# Resource Screen Open ($28ee)

`Resource Screen Open screen,width,height,cursor` creates and selects an indexed
screen using the active Resource bank's colour count, mode and 32 palette
registers. It does not unpack the resource's artwork. The supplied tutorials
choose bank16 and obtain a 16-colour hires screen from `Example_Resource.Abk`.

The pure `lib/amos/resourceScreen.js` reader follows the graphics offset, skips
the counted puzzle-pointer table, and reads the screen descriptor. It validates
alignment, complete metadata and supported colour counts before screen mutation.
The bounded subset accepts Resource payloads up to 1 MiB and 4,096 puzzle
pointers. Unused image payloads are not read or validated by this screen-only
operation. Bank lookup uses the current selector and current bytes, including
after Poke, replacement or Bank Swap; the native `Reso` name prefix is required.

Zero selects the pinned official system resource's screen metadata: eight
colours, hires and its original palette. Resource banks with an absent graphics
section use the same fallback. These defaults are local copies, independent of
user bank16. The complete original system resource is retained as a reference
fixture; only its screen metadata is embedded in standalone program factories.

Native creation rounds width down to a multiple of sixteen. The implemented
range is 16..1008 pixels wide and 1..1023 high, with screen selectors0..7.
The native `$8004` mode mask is retained; live interlace remains explicitly
unsupported. Normal, EHB and HAM colour modes use the existing display path and
its mode restrictions. Palette words use the hardware's low twelve bits.

Cursor zero records cursor-off intent, retaining the new window's default
cursor colour (three, or one on a monochrome screen). Supported nonzero colours are below the
screen colour count and at most31. They record visibility/colour intent and
start the existing native default Flash pattern on the driver-owned VBL clock.
Text-cursor rasterization remains outside the existing portable display model.
Invalid data, dimensions, modes or flags reject before replacing a target;
ordinary clone checks and palette-job retirement remain intact.

## Validation and demo

`test/resource-screen.test.js` checks real and synthetic metadata, independent
system-resource bytes, malformed pointers, native width rounding, cursor/Flash
timing, bank changes, clone ownership and preservation on failure. Eight
Interface fixtures retain original source lines1–16, then stop at a declared
Wait Key guard. The complete Full_Example also needs its earlier external
music/sample assets, so its startup is not claimed as executed.

[Open the resource-screen demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/resource-screen.html).
The same shared browser scenario checks four actual Canvas/WebGL frames and
435,200 independent pixels. Original startup produces a blank screen; the
labelled indexed swatches are an added palette preview. They are not dialogue
execution or a native Amiga capture.

[Dialog Open/Close](interface-channels.md) now prepare and release channels.
Complete Interface tutorials next reach `Dialog Box` ($26e8), `Dialog Run`
($276c), or `Array` ($25c0).
Resource Unpack, resource messages, dialogue language/interaction and additional
resource-consumer behavior remain separate work. Overall Tutorial compilation
coverage remains 30/43 until these later commands are implemented.

Source references: `InResourceScreenOpen`, `Dia_GetPuzzle` and `Dia_RScOpen` in
the pinned official `+Lib.s`, and `EcCree`/`WOpen` in `+W.s`, revision
`533b4b1f5acd604814513f78e02c7b4796cb0531`.
