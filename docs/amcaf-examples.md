# Original AMCAF example collection

The supplied distribution now lives under `examples/AMCAF/`, preserving its
`AMCAF_Examples` directory, twelve `.AMOS` files, eleven `Data` assets, Workbench
metadata and original assign script. Program bytes are unchanged; the inventory
pins their SHA-256 hashes. Ghostlight sources/assets/builds remain in their
separate private project and are not part of this collection.

**[Open the AMCAF catalogue](https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-examples.md)**
for a page for every program, including explicit blocker pages. The catalogue is
also in the demo gallery's “More to explore” section. Build status and runtime
coverage are separate: currently **6/12 compile and run**, covering fonts, IFF conversion, sample-bank fixing,
quick maths and both Protracker interfaces.

See the [font and converter implementation contract](amcaf-fonts.md) for native
formats, supported bounds and lifecycle rules.

## Working example: fonts

[Play Fonts](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-fonts.html).
The original embedded Iva font and 2,048-byte Print font draw the first screen.
Press Space to see the captured bank font restored on a fresh screen; press
Space again to finish. Graphics font metrics preserve character bearings and
advances. Print-font selection affects the text writer independently.

The named `topaz,16` request uses an explicitly supplied, doubled AROS Topaz8
bitmap. This is a compatible host font, not a recovered Amiga ROM font.
[Source, provenance and license](../examples/AMCAF/fonts/README.md) are included.
Five independently decoded regions cover 46,720 indexed pixels. Both complete
scenes also compare CPU output to actual WebGL readback.

## Working examples: file utilities

[Iff2Raw](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-iff2raw.html)
and [SamBankFixer](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-sambankfixer.html)
have an input upload control and a **Use sample** button. Uploading completes
before Play is enabled. The page prepares synchronous Fsel$ answers before
starting the unchanged program. It never returns a Promise from the VM's file
selector. Generated files remain in session memory until downloaded.

For Iff2Raw, choose the output base name and download the `.col` and `.raw`
files after completion. Tests check raw and ByteRun1 ILBM bodies against
independent plane-major bytes and the complete padded RGB palette. The small
synthetic input is an unmasked, word-aligned two-plane picture. This does not
establish arbitrary ILBM/masking support or AGA rendering.

For SamBankFixer, upload an AMOS sample bank or choose the synthetic tone.
Press Space after each sample; then download the saved bank. The original
source clears the **first PCM word**, despite its comment referring to a click
at the end. Tests preserve that behavior and compare every saved byte.
The page cancels the next file request after one bank so the output is easy to
retrieve. Restart prepares a fresh input copy and fresh selection queue.

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

## Working example: original Protracker1

The original interface plays the recovered 4 spirits tune with WebGL. Its page defaults to
Keyboard: Typing to send the arrows to the program. Up/down change volume,
left/right change tempo, and keys 1–4 toggle the four music voices. A mouse
button on the canvas exits. Page Stop/Resume pauses VM and music together.
[Play Protracker1](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-protracker.html).

The restored original IMP!-packed module contains 997 AMCAF effect-8
synchronization cells and drives the drum/text callbacks. The previously
recovered Modland version remains a separate, pinned test fixture: its complete
first wrap matches 6,531 independent sample starts over 19,892 ticks.
See [sample-offset and retrigger semantics](amcaf-vm.md#sample-offset-and-retrigger-effects).

## Working example: original Protracker2

[Play Protracker2](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-protracker2.html)
loads the supplied Hawkeye tune and runs the entire unchanged AMOS visualizer.
Its frequency meters, rainbow bands, scrolling note trail and double buffers
run through the original loop. Press a mouse button on the canvas to exit.
Page Stop/Resume pauses the whole VM and music; sound/fullscreen and Restart
use the shared application harness.

[Graphics browser checks](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-blitter.html)
include four primitive stages and four original first-note frames, 196,608
independent indexed-pixel checks and eight Canvas/WebGL pairs. The independent
original-frame region covers the meters; the note trail has full CPU/GPU
regressions. No VM variables, instruction pointers or source bytes are edited.
These are source-derived checks, not native captures or whole-song GUI replay.
See the [blitter contract](amcaf-blitter.md) for supported geometry and fill rules.

## Music support preview

[Play the original Hawkeye tune](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-hawkeye.html)
in a declared compiled AMOS harness. It loads the supplied IMP! file into a chip
Work bank and plays it with the AMCAF engine. Press a key to disable voice 1,
a second to re-enable it, and a third to stop. The page supports sound,
fullscreen, Stop/Resume and Restart. This is a separate music harness. The original Protracker2 interface now runs;
the first version also runs with the recovered 4 spirits module.

[Voice DMA browser checks](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-voice.html)
compare four independent constant-wave stereo mixes in native offline Web Audio
graphs. The supplied module's complete first wrap has 19,202 ticks and 6,653 note
triggers, matching an independent Python order/cell audit. These counts are not native captures.
See [voice control and module support](amcaf-voice.md) for timing and scope.

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

The separate builder writes `build/amcaf-examples/index.md` and `manifest.json`.
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

The eleven statically walkable programs use 155 distinct AMCAF offsets; their
implemented signatures are tracked in `lib/ExtensionProfiles.js`. The protected/native-code program is not
included in that count. The inventory describes encoded calls, not implemented
runtime compatibility.
Unknown commands are never registered as successful no-ops to get a build.

## Current program status and next work

| Program | Current coverage / first blocker | Required follow-up |
| --- | --- | --- |
| QsinCosArcSqr | Complete original loop and exit | Wider maths argument forms/native capture comparisons. |
| Protracker | Complete original interface, music, controls and mouse exit | Recovered 4 spirits playback uses 9xx/E9x. The restored original packed tune supplies effect-8 drum/text cues. See [Anim scope and drum demo](anim.md). |
| Protracker2 | Complete original visualizer loop and mouse exit | Packed Hawkeye music, negative-mask meter edges, exclusive fill, note trail, double-buffer swaps and rainbow palette run with WebGL. Wider native timing/capture comparisons remain open. |
| Fonts | Both original key prompts, bank-font capture/restore, independent pixel regions and WebGL parity | Uses the declared AROS-compatible host Topaz font; native ROM/diskfont rendering captures remain open. |
| BigAmcafIntro | Core Set Tempras `$10ac` | Shared IMP!/raw loading, saving, strings and shifts now compile; drawing workspace, stars/splinters, vector rotation, pixel effects, blitter operations and palette/HAM effects remain. |
| GamePorts | Xfire `$15be` | Explicit portable joypad/parallel-port readers and secondary-mouse position/limits/speed. |
| SamBankFixer | Original load, four-voice playback, key prompt, first PCM-word fix and saved-byte download | Browser uploads and a declared synthetic sample exercise the workflow. Native audio captures remain open. |
| Iff2Raw | Original raw/ByteRun1 conversion and exact palette/plane-major output | Bounded word-aligned, unmasked ILBM inputs tested. Arbitrary malformed files and AGA display are separate. |
| FileRequester | Core Amos Here `$24d0` | Filename/path helpers now compile; core host metadata, patterns, directory/object metadata, IO errors, font/drawing helpers and requester interaction remain. |
| BankManager | Core Amos Here `$24d0` | Core/standard extension gaps plus bank naming, relocation, transforms, compression and requester utilities. |
| BZoomAnimPlayer | Examine Object `$0672` | File metadata and Bzoom animation; the original animation has now been located in the upstream archive (see below). |
| ShowAGAPic | Native code-region validation at byte 4786 | The static walk also reports an encrypted/compiled procedure. Establish a supported source representation before adding AGA display. Preserve the original; do not silently skip protected code or emulate AGA with an OCS-labelled output. |

The missing animation is present in the [original Aminet examples archive](https://ftp.uni-erlangen.de/aminet/dev/amos/AMCAFExt140Exa.lha).
The restored data directory now includes this original animation. Bzoom and
metadata commands still need implementation before the player can run. The archive SHA-256 is
`acf1d4d25487c76130c472eb920c7ff1597b5b5a2c676c9decae1ba3517973eb`;
`AMCAF_Examples/Data/AMCAF.Anim` is 74,634 bytes with SHA-256
`049f14b963abedd80a98befbaa1a582b055fd38faddcffcf50bb25fa90ece8a3`.
Its first image is a 160×128, five-plane, compressed ILBM inside ANIM.
The archive's ShowAGAPic source has exactly the same SHA-256 as the supplied
copy (`bf84422d1c7a91f482b1b90127662f6dee7da5d95128c049acd0df1843b24903`)
and the same byte-4786 validation boundary. Downloading another identical
archive copy therefore does not solve its protected/native-code representation.

Implementation order:

1. **IMP! decompression and loading: implemented.** The three supplied packed
   files decode with checked lengths/checksums and pinned expanded hashes.
   Standalone file/bank commands share the decoder; continue with the newly
   exposed blockers below. These tests do not establish full intro/music runtime compatibility.
2. **Protracker examples.** Masks and order/row/instrument/frequency/VU/signal
   queries, Hex$ and bounded raw plane graphics are implemented. Both
   original interfaces run, with 9xx/E9x support for recovered 4 spirits playback.
   Wider tracker effects and native captures remain follow-up work.
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

## Imploder loading contract

`lib/amos/amcafImploder.js` implements the recovered AMCAF R176 reverse
unpacker. It owns its input snapshot and output, redirects restored header reads
into the footer, and validates literal runs, backward matches and source bounds.
The portable subset caps compressed and expanded data at 16 MiB. Independent
all-literal bytes exercise header restoration; bundled streams additionally have
pinned expanded lengths and hashes. Those hashes are regression checks from the
source-derived decoder, not native Amiga captures or an independent decoder.

`Imploder Load filename$,bank` decodes IMP! or loads an ordinary raw file.
`Imploder Unpack source To bank` reads checked generic bank memory, accepting
a bank selector or its virtual address. Both create temporary Work banks; a
negative destination selects chip memory and a positive destination fast memory.
Decode completes before destination replacement, preserving the destination on
failure. Unpack preserves its source and rejects source/destination bank aliases.
PP20 dispatch remains explicitly unsupported. File loading uses one synchronous
byte-string read with a retained resolved filename. No host decompressor is needed.

Optional checksum validation is available on the pure decoder; runtime commands
retain the native AMCAF routine's unchecked-checksum behavior. Malformed structure
still rejects. The native zero-byte long-match count means 256 bytes, and native
word distance bases are signed. Successful decompression alone does not make
Work-bank Protracker playback or bank-font selection supported.

## String, shift and Work-file utilities

[Run the utility checks](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-utilities.html).
This synthetic compiled program maps AMCAF to slot 19, round-trips all 256 byte
values through Wload/Wsave/Dsave, and prints formatting/path/shift results. It
does not claim that the original file utilities or Protracker examples run yet.

- `Lsstr$(value,width)` pads with spaces; `Lzstr$` pads digits with zeroes.
  Widths 1–10 are supported. Values saturate to the available decimal digits,
  reserving a character for a negative sign. The source's signed `NEG.L` overflow
  for -2147483648 is preserved, including its zero result. Independent Python
  decimal-loop vectors cover all widths, signs, saturation and the signed limits.
- `Filename$` takes the suffix after the final slash or colon. `Path$` returns
  the prefix, retaining a volume colon but excluding the final slash. `Extpath$`
  appends a slash unless the string is empty or already ends in slash/colon.
  These are lexical byte-string operations: case, NUL bytes, backslashes and
  parent-path components are not normalized or interpreted. Inputs are bounded
  to 32,760 bytes; these functions never access the filesystem.
- `Lsl` and `Lsr` use the low six count bits. Despite its name, the native `Lsr`
  routine executes `ASR.L`, preserving the sign bit. Counts 32–63 therefore
  produce zero or the extended sign, rather than JavaScript's modulo-32 shift.
- `Wload filename$,bank` loads raw bytes into a temporary Work bank, using a
  negative destination for chip memory. Unlike Imploder Load, it does not decode
  an `IMP!` header. `Wsave` and its `Dsave` alias save the complete generic bank
  payload, accepting a bank selector or its exact start address. No ABK header
  is written. Transfers are bounded to nonempty data of at most 16 MiB.
  Loading validates before replacement; saving snapshots and validates before
  truncation and retains the resolved filename across both synchronous writes.
  Interior pointers and object-bank serialization are explicitly unsupported.

Regenerate the independent formatting vectors with:

```sh
python3 tools/reference/check_amcaf_strings.py > test/fixtures/amcaf/strings.json
```

Implementation evidence is the recovered AMCAF R0b1/R0b2, R060–R062, R0c4/R0c5
and R068/R069 routines. These tests are source-derived checks, not Amiga captures.

## Protracker status queries

[Run the status demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-status.html).
Six source-derived query functions now compile in both original music examples.
They read owned sequencer data without advancing a clock, invoking an audio host
or copying the PCM buffers. `Pt Vu` and `Pt Signal` consume their own byte
latches; repeated status reads cannot generate extra music ticks.

[The query contract](amcaf-status.md) documents native units, the low instrument
nibble, signal effect 8, supported channel bounds and retained post-Stop state.
The standalone synthetic program exercises relocated extension slot 19 and two
actual compiled reports. The separate Protracker2 page now runs its original GUI.

## Core bit toggles and cursor strings

`Bchg` (`$2226`) now shares the checked `Bset`/`Bclr` path. A direct integer
variable or array element toggles a modulo-32 bit; an address expression
(including a parenthesized variable) toggles a modulo-8 bit in a checked bank
byte. Negative selectors reject before evaluating the target. Array lookup
preserves the existing left-to-right validation and captured owner.

`Cup$`, `Cdown$`, `Cleft$` and `Cright$` return one byte: 30, 31, 29 and 28,
respectively. Native `InBchg` in `+ILib.s` selects 68000 long-variable versus
byte-address BCHG; `+Lib.s` supplies the cursor character constants. These match native `FnCup`/`FnCdown`/`FnCleft`/`FnCright` in the
AMOS library and the existing browser arrow-key text mapping. They do not read
or consume the keyboard queue and take no arguments.

[Bit toggles and browser cursor-string checks](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/bit-cursor.html)
uses a compiled synthetic program and injected DOM keyboard events. It is not
an execution of the original Protracker interface. The unchanged first example
now compiles completely, including its finite drum strings and Anim controls.
See [AMOS Anim](anim.md) for the native record contract, live drum harness,
independent timing vectors and the recovered module’s absent drum/text cues.
