# Original AMCAF example collection

The supplied distribution now lives under `examples/AMCAF/`, preserving its
`AMCAF_Examples` directory, twelve `.AMOS` files, four `Data` assets, Workbench
metadata and original assign script. Program bytes are unchanged; the inventory
pins their SHA-256 hashes. Ghostlight sources/assets/builds remain in their
separate private project and are not part of this collection.

**[Open the AMCAF catalogue](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-examples.html)**
for a page for every program, including explicit blocker pages. The catalogue is
also in the demo gallery's “More to explore” section. Build status and runtime
coverage are separate: currently **1/12 compiles and runs**, not twelve completed
demos.

## Working example: quick maths

[QsinCosArcSqr.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-qsincosarcsqr.html)
runs its complete original source. Move the pointer to aim the short line and
change the surrounding circle's radius. Press a mouse button, or Escape outside
fullscreen, to exit; the first Escape in fullscreen only leaves fullscreen.
The normal page provides Play, Stop/Resume, Restart, sound/fullscreen and Debug
controls. It needs no modified AMOS source or injected startup key.

The [browser checks page](../demos/amcaf-quick-maths.html) exposes three
Canvas/WebGL pairs. Original mouse queries, double-buffer swaps, Print output,
maths calls and Escape cleanup run in the VM. Checks cover 15,795 independent
axis-needle pixels, circle cardinal points, three complete GPU/Canvas comparisons,
and actual mouse/exit/restart input on the application page. These are browser
and source-derived checks, not native Amiga captures.

## Rebuild

```sh
npm run build:demo
```

This rebuilds the repository catalogue, twelve program pages and manifest, as
well as the rest of the demos. `npm run check:generated` checks reproducibility.

For a separate output directory, including standalone JavaScript for programs
that compile:

```sh
npm run build:amcaf
# Or choose the source and output directories explicitly:
node tools/build_amcaf_examples.js examples/AMCAF/AMCAF_Examples build/amcaf-examples
```

The separate builder writes `build/amcaf-examples/index.html` and `manifest.json`.
It emits a blocker page for an unsupported program and exits with status 1 while
any program remains blocked. Successful modules/pages are still emitted.
The repository demo builder deliberately includes those blocker pages in its
stable output rather than treating an incomplete collection as a generated-file
failure.

All builds explicitly select AMCAF 1.50beta4 in extension slot 8. Supplied data
is preloaded under both relative `Data/...` and `AMCAF_Examples:Data/...` names;
the native assign script does not need to run. Relative filenames are handled by
the existing case-insensitive memory-files adapter. Python is not needed to
build pages; optional static inventory/reference regeneration uses:

```sh
python3 tools/reference/inventory_amcaf_examples.py > examples/AMCAF/inventory.json
python3 tools/reference/check_amcaf_math.py > test/fixtures/amcaf/math.json
```

The eleven statically walkable programs use 155 distinct AMCAF offsets; 19 of
those offsets are currently registered. The protected/native-code program is not
included in that count. The inventory describes encoded calls, not implemented
runtime compatibility.
Unknown commands are never registered as successful no-ops to get a build.

## Current program status and next work

| Program | Current coverage / first blocker | Required follow-up |
| --- | --- | --- |
| QsinCosArcSqr | Complete original loop and exit | Wider maths argument forms/native capture comparisons. |
| Protracker | Imploder Load `$0ea2` | Decode IMP! data, load chip modules, player masks/queries and blitter drawing. |
| Protracker2 | Imploder Load `$0ea2` | Same decompression/music work, plus frequency-meter rendering. |
| Fonts | Imploder Unpack `$0e8a` | Owned decompression, bank fonts and print/graphics font selection. |
| BigAmcafIntro | Imploder Load `$0ea2` | Shared loading, stars/splinters, vector rotation, pixel effects, blitter operations and palette/HAM effects. |
| GamePorts | Xfire `$15be` | Explicit portable joypad/parallel-port readers and secondary-mouse position/limits/speed. |
| SamBankFixer | Lsstr$ `$0ec8` | String helpers, core Peek$, sample-bank playback and meaningful prepared file selection/save. |
| Iff2Raw | Path$ `$03e0` | Path/string helpers, Wload/Wsave, Binexp and supported image conversion. |
| FileRequester | Filename$ `$02f0` | Bounded directory/object metadata, paths, patterns, IO errors, font/drawing helpers and requester interaction. |
| BankManager | Core Amos Here `$24d0` | Core/standard extension gaps plus bank naming, relocation, transforms, compression and requester utilities. |
| BZoomAnimPlayer | Examine Object `$0672` | File metadata and Bzoom animation; an animation input still needs to be supplied/prepared. |
| ShowAGAPic | Native code-region validation at byte 4786 | The static walk also reports an encrypted/compiled procedure. Establish a supported source representation before adding AGA display. Preserve the original; do not silently skip protected code or emulate AGA with an OCS-labelled output. |

Implementation order:

1. **IMP! decompression and loading.** Three supplied files actually start with
   `IMP!`: `Data/mod.hawkeye`, `Data/AMCAFAdvert.Abk` and `Data/MyBootLogo.raw`.
   A raw-file-only “Imploder Load” would not unblock them. Share checked decoding
   between file and bank commands, then validate the original module and advert.
2. **Protracker examples.** Add the required masks, trigger/note/instrument/volume
   queries and bounded raw plane graphics, retaining the independent music clock.
3. **Fonts and GamePorts.** Define host/owned-state contracts explicitly. Missing
   native OS libraries or parallel-port hardware must not become invented device
   readings; browser adapters and declared simulated inputs need honest labels.
4. **Files, strings and banks.** Build on the synchronous memory-files and checked
   bank-address adapters. Exercise actual selection, mutation and download paths,
   rather than counting an immediate cancellation as a working utility.
5. **Intro effects, animation and AGA.** Use the larger intro as an integration
   target after its dependencies work. Keep display modes and native/protected
   source boundaries explicit.

Each completed program should retain its original bytes, get a directly playable
page, and gain bounded browser input/lifecycle checks. New primitive operations
need independent source-derived vectors and real Canvas/GPU checks when they
change display data. A successful parse or a captured single frame is not proof
that an interactive example works.

## Quick-maths implementation contract

`lib/amos/amcafMath.js` contains the recovered initialized sine and angle tables
from `tools/reference/amcaf-v1.50beta4/tables.json`. It is conditionally embedded
in standalone factories selected with an AMCAF profile.

- Qsin/Qcos wrap angles to 0..1023, multiply the signed low word of the radius by
  the table word, arithmetic-shift by eight, add the carry for rounding, and
  sign-extend the low word. Qcos adds 256 to the angle. No host trigonometry
  approximation replaces the table.
- Qarc currently accepts signed-word deltas and applies the original integer
  ratio table/quadrant logic. Zero/zero returns zero. Wider longword forms remain
  gated because the native code mixes long comparisons with word division/signs.
- Qsqr rejects negative integers. It uses the native rounded-up Newton recurrence
  and power-of-four reduction for larger values. In particular Qsqr(65537)=256,
  not an assumed mathematical ceiling of 257: discarded low bits matter.
- Blitter Clear clears only the requested logical bitplane, preserving other
  planes, physical double-buffer storage, palettes, text/graphics cursors and
  masks. The rectangle form rounds X outward to word boundaries and uses an
  exclusive Y end. Bounded word-aligned bitmaps are required. It bypasses
  drawing hooks, Autoback/Bob replay and normal Ink/Writing/Clip behavior.

The integer reference checker independently transcribes R10f/R111/R112/R113;
Blitter Clear follows R046/R047. The catalogue tables are binary/source evidence,
not Amiga execution captures. Main compiled paths still use the ordinary parser,
IR, instruction functions and shared planar display bridge.
