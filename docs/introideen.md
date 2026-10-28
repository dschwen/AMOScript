# Introideen implementation plan

Assessment: 2026-10-28. Goal: compile the supplied programs without source
rewrites, then run the visual intros and expose generated pictures/printer bytes
through the existing browser harness.

## Current progress

Sqr is implemented; see [semantics and evidence](sqr.md). The sibling catalogue
has been rebuilt: seven files compile. Kugel's unchanged source passes the short
startup check, then reaches a source-level negative Plot colour at line 14,
byte 520, GX=89/GY=42/P=-1. Keep the native negative-colour rejection. The Sqr
gallery demo shows the partial sphere and this expected failure; the original
complete-rendering acceptance goal below is still unmet. The current animation
generator advances to Save Iff, and its backup advances to Polygon.
Zoom now runs the unchanged RollerIIIntroIdee source through all 29 original
animation frames and its final key prompt; all generated icons/frames match
independent expectations. See [the Zoom contract](zoom.md). The sibling catalogue
is rebuilt: eight programs compile. Source inspection corrected two initial
assumptions: Zoom rejects out-of-bitmap rectangles and bypasses Bob/Autoback hooks
with live overlap feedback.

Save Iff now runs the unchanged KugelanimBerech generator through its key prompt,
one `rollerball` write and clean termination. Independent decoding matches every
saved pixel; a separate reload preview and shared Debug download are covered in
the gallery. See [Save Iff](save-iff.md) for the compressed subset and limits.
The sibling catalogue is rebuilt: nine programs compile. Next implement Polygon;
four token encodings remain unsupported.

## Pre-implementation baseline and evidence

The directory contains 16 AMOS-header files: nine `.amos` files and seven `.Bak`
files. Six compile. Nine fail on unsupported tokens; one backup is truncated.
The bounded startup check executes at most 1,000 instructions with a fixed clock;
only `Drums.amos` passes. This is not a full playback test.

The [machine-readable baseline inventory](introideen-inventory.json) records source hashes,
all missing-token occurrences and startup results. Source/assets in `introideen/`
are currently untracked; the inventory identifies the inspected bytes but is not
a portable source fixture. Before adding conformance tests, pin the required
programs/assets using the same provenance/manifest approach as the existing game
fixtures. Preserve originals and backups separately.

Token names and encoded signatures come from the assembled-library
[diagnostic catalogue](../tools/reference/README.md), revision
`7f32e0abe1b6b415c9502b598cd3e4cb131018f8`. Unlike the compiler's fail-fast reader,
`tools/audit_program.js` inventories the complete bounded token stream. It found
three additional encodings hidden behind first errors. Catalogue recognition
alone does not establish parser/runtime support.

| Token | Name | Original use | Files blocked |
| --- | --- | --- | --- |
| `$0768` | Sqr | Shading expressions with one numeric argument | Kugel.amos; KugelanimBerech.amos and .Bak |
| `$10d6` | Zoom | Ten numeric operands separated by To; screen 0 to itself | RollerIIIntroIdee.amos |
| `$0afc` | Save Iff | One filename expression | KugelanimBerech.amos and .Bak |
| `$0eba` | Polygon | Five explicit coordinate pairs joined by To, last repeats first | KugelanimBerech.Bak |
| `$25e0` | Frame Load | `N=Frame Load(1 To 10,18)` | Logoanim.amos and .Bak |
| `$25ec` | Frame Play | `F=Frame Play(10,1)` then `F=Frame Play(F,1)` | Logoanim.amos and .Bak |
| `$18de` | Open Port | `Open Port 1,"par:"`, Print #, Close | ASCIIPC.Bak; LetterQualityProcs.amos and .Bak |

No other unrecognized encoding appears in the 15 structurally valid files.
Existing recognized forms may still expose parser or runtime limits once the
first errors are removed; rebuild and execute after each step.

## Ordered implementation and acceptance goals

### 1. Sqr: first visual result

- Add `$0768` to TokenTable and its unary numeric signature to FunctionTable.
  Route typing/emission through Lowerer and the shared numeric operations,
  including static expressions and boxed integer/float inputs.
- Establish AMOS result typing, rounding, zero and negative-domain behavior from
  the original implementation before choosing a JavaScript calculation. Do not
  allow a domain error to propagate as NaN or silently invent an absolute value.
  The [maths manual](https://amospromanual.dev/05-03-maths.html) establishes the
  public square-root interface; exact numeric edge behavior needs source evidence.
- Verify integer and float storage, arrays, DATA/static evaluation and procedure
  results, single evaluation and source-located failures. Compare perfect squares,
  fractional values and boundary cases against an independent oracle with an
  explicit approximation tolerance where appropriate.
- Acceptance: unchanged `Kugel.amos` compiles and completes its finite shading
  loops with bounded ticks. Publish a sphere demo with independently derived
  sample pixels/image regions and Canvas/WebGL comparisons. The two animation
  generators should advance to their next unsupported command, not be claimed
  complete at this step.

### 2. Zoom: self-contained animated intro

- Add `$10d6` and the explicit five-operands/To/five-operands grammar. Keep AST
  construction pure and operand evaluation left-to-right, once each. Reuse the
  existing Logic/Physic selector resolution where native semantics agree.
- Implement indexed bitmap resizing through the existing display model,
  preserving palette ownership and logical/physical buffers. Source inspection
  established that Zoom bypasses Autoback/Bob hooks as a raw plane operation.
  Define sampling, rectangle ends, clipping, plane-depth transfer and overlap from
  original source before implementation. Preserve native live alias traversal;
  preflight unsupported geometry before any destination mutation.
  Never delegate semantics to browser canvas image interpolation.
- The [screen manual](https://amospromanual.dev/06-02-using-screens.html) documents
  source/destination rectangles and logical/physical selectors. The supplied
  program uses source `(0,0)-(16,16)` and destination
  `(16,16)-(32-Z,32)` for Z=15 down to 0; establish the native end convention rather
  than assuming Screen Copy's exclusive bounds.
- Acceptance: original `RollerIIIntroIdee.amos` runs with `R.abk`, captures its
  generated icons through Get Icon and reaches the final Wait Key after animation.
  Check every generated width, representative pixel matrices, alias/clipping
  cases and actual GPU frames in a repository demo.

### 3. Save Iff: complete the current image generator

- Add `$0afc` with the one-string signature actually used. Keep other encoded
  overloads gated unless implemented separately.
- Introduce a pure ILBM writer alongside the model reader. Serialize the selected
  logical bitmap, word-padded planar rows, palette/mode and supported AMSC screen
  metadata. Determine the default compression from source; implement the required
  form rather than assuming the default is uncompressed. Unsupported modes must
  reject before writing anything.
- Resolve the filename once through the existing directory adapter contract.
  Validate and encode the complete file before the synchronous write; preserve
  session file semantics and use Debug downloads for export. IndexedDB remains
  a separate persistence milestone.
- Check expected bytes using an independent parser/decoder, not only a round trip
  through the production reader. Cover padding, odd chunk sizes, metadata,
  adapter errors and no partial output on validation failure.
- Acceptance: `KugelanimBerech.amos` completes rendering, accepts a real queued key
  at Wait Key and writes `rollerball`; its decoded pixels match the screen.
  The backup will still require Polygon. The
  [Save Iff documentation](https://amospromanual.dev/06-01-setting-up-screens.html)
  also identifies compression and double-buffer/dual-playfield restrictions that
  must be enforced or explicitly left unsupported.

### 4. Polygon: complete the backup generator

- Add `$0eba` with a coordinate-list AST and numeric lowering. Implement the
  supplied explicit-start, solid-fill form first; `Polygon To`, patterned fills
  and outline modes require their own verified forms rather than silent fallback.
- Establish native edge inclusion, closure, degenerate/repeated vertices,
  clipping and graphics-cursor effects. Validate the whole list before invoking
  drawing/Bob hooks; preserve Autoback behavior and indexed buffer ownership.
- Use independent small polygon matrices for triangles, quads, reversed winding,
  horizontal edges and repeated closing points. The
  [graphics manual](https://amospromanual.dev/06-04-graphics.html) documents the
  To-separated list and optional cursor-start form, but is not a pixel oracle.
- Acceptance: unchanged `KugelanimBerech.Bak` completes eight iterations and writes
  `df1:kugel010` through `df1:kugel017`. Independently decode/check exported
  pictures and show rendering plus downloads in a repository demo.

### 5. Frame Load / Frame Play: ANIM-5 foundation and Logoanim

- First build a pure bounded FORM ANIM reader. Inspected `KugelAnim` is 35,084
  bytes: 20 nested ILBM frames, one initial BMHD/BODY followed by 19 ANHD/DLTA
  frames. All inspected ANHD records use operation 5, interleave 0 and bits 0.
  Logoanim requests only 18 frames. These are chunk-header observations, not a
  decoded-frame reference. Verify interleave-zero semantics and delta history
  from primary ANIM/native source before implementing them.
- Reuse the ILBM/ByteRun1 foundation for the initial bitmap. Validate delta plane
  offsets, operation streams, row/column bounds and inherited metadata before
  mutation; explicitly gate unsupported operations. Derive all 18 requested
  frames independently and check full indexed hashes, not just the first image.
- `$25e0` is a function, not a Load statement: parse `channel To bank,count`
  inside parentheses and return the actual loaded frame count. Add a checked
  binary-channel cursor API to operations; honor the Open In channel's current
  position and Close. Preflight loading before replacing the destination bank.
- `$25ec` is a function with a side effect: decode into the selected logical
  screen and return the next frame's virtual address. Define an animation-bank
  representation and integrate its address lifetime with bankMemory. A returned
  address must resolve to a verified frame boundary and become invalid after
  retirement/replacement. Do not substitute an arbitrary frame index or native
  JavaScript pointer. Review Start/Length/Erase/Save/raw-memory interactions and
  reject unsupported access consistently.
- Decode synchronously at the original call; existing Screen Swap/Wait Vbl/Wait
  instructions own timing. Preserve delta history across the source's double
  buffering, and isolate every factory's animation/bank state.
- The [IFF animation manual](https://amospromanual.dev/07-05-iff-animation.html)
  describes count returns, continuation addresses and drawing into logical
  buffers. Implement the used two-argument Frame Play first; screen-creating
  overloads need separate token/signature verification.
- Acceptance: both original Logoanim variants compile, load exactly 18 frames,
  show all 18 through their original swaps/waits and reach the later logo-copy
  sequence. Exercise invalid/truncated input, failed-load atomicity, stale
  addresses and Stop/Resume/Restart. Include representative actual GPU comparisons
  and an independently checked complete frame sequence in the gallery.

### 6. Open Port: honest printer-output capture

- Add `$18de` as a statement with numeric channel and string device operands.
  It must share channel conflict/Close/Print # rules with files, but device names
  must not pass through Dir$ as ordinary filenames.
- Inspect the native Open Port implementation and its channel/byte-formatting
  behavior. Define an explicit synchronous host device adapter; missing adapters
  or unsupported device names fail clearly. Initial scope is an owned `par:`
  output capture, with bytes exportable from a browser demo. It does not imply
  operating-system printing, Web Serial access or PCL rendering.
- Preserve escape/NUL/high bytes and Print # separators/terminators, and test
  callback failures, close/reopen and per-factory ownership. Do not simply alias
  Open Port to Open Out: that would conceal the device contract.
- Acceptance: all three original printer programs compile and finish; independently
  constructed byte streams match their captured output, including procedure calls
  and the ASCII table. Expose capture/download in a runnable repository demo.

## Separate runtime and input blockers

| Blocker | Observation | Planned follow-up |
| --- | --- | --- |
| Negative Screen Display Y | Both RolIntrIdee2 versions move Y1 from -80 toward 120; first display uses -76 | Verify signed-word/native clipping semantics, then extend the committed window/copper and pointer-crop paths together. Regress parked positive windows, overlaps, late DMA, PAL/NTSC and input mapping. Do not just remove the validation. |
| ILBM DRNG | IconCutter's `armartures` has a 12-byte DRNG at byte 262 | Validate its actual flags/count layout against the format. Decide whether inactive metadata can be safely retained without cycling; active ranges require explicit clock/palette integration. Do not strip the chunk to hide the failure. |
| Missing RII volume | rol.amos and rol.Bak fail at original Dir$ setup | Inventory expected assets and provide an explicit matching manifest/volume mapping. Do not silently combine these older sources with current Roller II data. |
| Truncated Roller II.Bak | File is 65,536 bytes; header declares 67,210 code bytes, requiring at least 67,230 bytes before any trailing data | Recover a complete source copy if available. Keep Buffer's bounds validation unchanged; this is not an unsupported-token task. |

## Completion and regression gates

For each command, land token/signature, AST/lowering and standalone runtime
semantics together. Preserve source locations, ordinary instruction controls,
cooperative budgets and optimizer boundaries; Frame Load/Play are effectful
functions and must never be classified as pure/batched scalar work.

Every new browser check must be a shared browser scenario with a repository demo
and HTML Preview link from `demos/index.html`. Give each program an honest status:
compiled, bounded execution, independent pixels/bytes, CPU/GPU parity and native
capture are different evidence levels. The sibling `introideen-compiled` catalogue
is an output convenience, not the only place acceptance demos may live.

After each implementation slice, rebuild that catalogue and update its first
remaining errors. For code/runtime changes regenerate demos and run `npm run
check`; rendering/input/host changes also require `npm run test:browser`. Retain
Roller II/Wonderland launch, gameplay, audio and high-score input regressions.
This planning change does not claim those implementation checks have been run.
