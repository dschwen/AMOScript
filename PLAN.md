# AMOScript development plan

Assessment updated: 2026-10-24.

## Current priority: Wonderland in the browser

Use the unmodified, pinned `examples/Wonderland/Wonderland.AMOS` as the next
end-to-end milestone. [The Wonderland assessment](docs/wonderland.md) records
the source inventory, current blockers and ordered acceptance gates. Prioritize
the language/runtime/display features exercised by this program over unrelated
compatibility additions or GPU modes. Keep the JavaScript dispatcher, CPU
runtime and shared immutable display snapshots; integrate the required display
commands through the existing design. The broader milestones below remain open.

Current assessment: the unmodified 753-line Wonderland source now compiles to
a standalone 1253-instruction factory, with all 142 encodings recognized (initially
44 were missing). [Prepared Fsel$ adapters](docs/file-selector.md) execute the
original selection loop and file calls. Controlled whole-program fire input enters
level 1. A new [live original-game demo](docs/wonderland-game.md) supports keyboard
layouts, the browser Gamepad API, Stop/Resume and Restart. WebGL2 is now its
default renderer, with explicit Canvas switching that preserves the VM/audio
session, eleven whole-game GPU/CPU frames and live context-loss/restoration checks.
Fullscreen now fits both renderers without changing their buffers, and survives
renderer replacement/Restart; native controls, Escape and pointer mapping pass. Input-only controlled
replays render three deaths/fades, two life restarts, game over and a fresh game;
live Chromium checks cover movement, Escape and remapping. Safe blank-row copper
setup now survives the original death fade. User-activated Web Audio now plays
the original sample commands, with mute/restart ownership and three native offline
PCM/stereo comparisons. Next cover collectibles/enemy interactions,
all-five-level/win paths and prepared editor
requester/writeback flows. Native timing/reference captures, async modal selection
and the planned IndexedDB adapter remain open. [Source-derived Rnd/Randomize](docs/random.md) now execute
original blob/green-jump slices against controlled seed/beam vectors. Native beam
timing remains outside this subset. [Raw Bload/Bsave](docs/raw-files.md) now round-trip the
original five level maps through declared writeback/save/load slices. The exact
7,205-byte save excludes the fifth seed, as in the source. [Mouse limits, polling clicks and opt-in hardware Canvas input](docs/mouse.md)
now run the original editor selection slice with browser input, preserving the
existing local-coordinate mode. [Screen-local zones](docs/zones.md) now execute the
original five editor-panel definitions and Zone expression against every panel
position with declared hardware input injection. [Flash and selected-screen Flash Off](docs/flash.md)
now share the injected palette clock with Fade, and the original game/editor
screen setup executes through its own Auto View On. [Full bitmap Screen Copy and Logic/Physic](docs/screen-copy.md)
now publish all five original level maps in a declared data/paste/copy fixture,
with an interactive clock-stepped browser demo. Bounded Print Using integer/string fields now
execute the original level/score statements in a [declared panel fixture](docs/print-using.md),
with separate expected glyph rasterization. Nonblocking Fade to black now uses the injected VBL clock,
with a [declared original Fade/Wait fixture](docs/fade.md), lifecycle cleanup and
independent RGB/CPU/GPU checks. Scancode now carries browser physical key metadata through
Inkey$, with the original Escape/title branch passing a [declared fixture](docs/scancodes.md).
Named-label On Gosub/Goto now share the existing call
stack and IP dispatcher; a [declared fixture](docs/computed-branches.md) executes
the original enemy dispatch and three unchanged initializers.
A declared fixture now executes the original menu
loop and animation/toggle routines with configurable keyboard and Gamepad API
input, stopping before game/editor dispatch. See [joysticks](docs/joysticks.md).
A second declared fixture executes the original game/editor screen setup through
`Screen Display`, with physical scrolling and independent panel pixel checks. See
[screen windows](docs/screen-windows.md).
The exact first 64 lines execute both startup branches through
Wait Vbl, Load Iff and the original title/menu marker Bob. Canvas, copper and GPU
match an independently decoded source-derived title composition. See
[title display support](docs/title-display.md), [startup support](docs/startup.md),
[bank memory](docs/bank-memory.md), [keyboard repeat](docs/key-speed.md) and [sample playback](docs/audio.md).
The 75-image bank and level-data bank decode; all four original ILBMs now match
independently decoded PNGs in CPU and browser asset tests. This is asset readiness,
not a running game or an Amiga reference capture.

## Browser persistent files (planned)

Add an opt-in IndexedDB-backed browser files adapter after the raw-file subset.
Current demos use volatile memory Maps; no persistent browser storage exists yet.

- Keep `files.read`/`files.write` synchronous for generated programs. Open/upgrade
  IndexedDB and preload the selected file namespace into an owned memory cache
  before starting/resuming a program; local uploads also finish before execution.
- Synchronous writes update that cache and enqueue versioned IndexedDB commits.
  Expose pending/durable/failed status and an asynchronous host `flush()` boundary.
  Bsave returning means the cache accepted bytes; claim persistence only after the
  transaction commits. Never block or advance AMOS time through requestAnimationFrame.
- Preserve byte strings exactly, including empty/NUL/high-byte files, existing
  filename/path semantics and the original 7,205-byte Wonderland save. Store file
  bytes and revision metadata in a versioned database; define upgrade/migration,
  deletion, namespace and multi-tab conflict behavior before shipping.
- Keep dirty bytes available for retry/export after quota, permission or transaction
  failures. Explicitly report unavailable persistence; offer volatile operation as
  a visible choice. Program switching/Stop/disposal must expose pending commits
  and provide a host flush policy, without silently losing uncommitted writes.
- Add shared browser scenarios/demos for reload/new-adapter persistence, independent
  namespaces, upgrades, conflicting tabs, failed commits/retry and exact raw-byte
  round trips. Test durable completion separately from cache reads. Document
  origin scoping: HTML Preview, hosted pages and local files may have separate or
  unavailable storage; do not imply files persist across those origins.

Acceptance: a saved Wonderland level survives closing and reopening the adapter
on the same supported origin after a successful flush, while VM file operations
retain their synchronous contract and all failure/pending states are observable.

## Objective and scope

Transpile tokenized AMOS `.AMOS` programs into self-contained JavaScript
modules that run in Node and browsers. Preserve AMOS behavior through explicit
language semantics and host adapters. A program must compile completely within
the documented supported subset or fail with a useful diagnostic.

The first compatibility target is the core AMOS language plus a practical 2D
browser runtime. Full Amiga hardware behavior, extension libraries, and every
AMOS dialect are longer-term targets. ASCII AMOS input should eventually share
the same AST and backend, after the binary frontend and core semantics stabilize.

## Recorded baseline and current state

- Current local baseline: `npm run check`, **502 passed, 0 failed**, including
  sprites, snapshot/diff foundations, chip memory, planar reference/bridge and
  independent ILBM goldens, bounded copper/stack exports, EHB/DPF/scroll and
  explicit fields and HAM6. Source-backed palette rules are covered; demos are current.
- Every browser scenario now has a self-contained HTML demo and HTML Preview
  link in [the gallery](demos/README.md). Shared evaluators/assertions and generated
  checks keep them aligned; Chromium verifies each scenario page offline.
- Current `npm run test:browser`: **passed in Chromium/SwiftShader**, covering
  Canvas/input/lifecycle, direct-sprite updates and cursor restoration, plus a
  WebGL2 integer-texture/framebuffer readback capability probe.
- The original Test7, Test14, and Test21 regressions are fixed and covered.
- At the earlier 248-test baseline, the generated-artifact gate and full suite passed in a clean-install project
  copy on Node 22.23.4 and 24.22.1, and locally on Node 18.19.1. Chromium passed
  under Node 24. The GitHub workflow is configured for Node 22/24 and browser
  checks on Ubuntu 24.04; fresh hosted execution/system installation is pending.
  AGENTS.md now documents the active pipeline. See [development](docs/development.md).
- The stale-demo baseline is restored. A real WebGL2 readback probe now runs in
  the existing browser CI command. ABI v1, the PNG-diff harness, basic reference
  decoding, physical playfield snapshots and an OCS copper builder/interpreter
  are implemented, as are EHB screens, static scroll/DPF and explicit IFF fields.
  AMOS display/copper commands, superhires and live field timing,
  sprite contention/computed allocation, general viewport/letterbox input routing and remaining
  GPU modes remain open. Native non-HAM GPU decoding/resolution now passes 179
  local GPU/CPU frames; see [renderer contract](docs/webgl-renderer.md).
  WebGL2 resources, exact table readback, dirty uploads and context restoration
  are implemented; see [resource contract](docs/webgl-resources.md). Direct AMOS
  sprite snapshots and CPU attached/priority composition are implemented; see
  [sprite contract](docs/sprite-display.md). See
  [mode and field implementation](docs/display-modes.md), [copper implementation](docs/copper-display.md),
  [planar implementation](docs/planar-display.md), [display snapshots](docs/display-snapshots.md) and
  [display architecture](docs/display-architecture.md).
- Generated modules run without a runtime import, including from a separate
  directory. The CLI has error exit codes and overwrite protection.
- Integer arithmetic now shares helpers for static expressions and Val results;
  Mod, division boundaries, and multiplication paths have independent-byte
  conformance fixtures. Their evidence is labeled source-analysis; reference
  AMOS execution and floating-point fidelity remain outstanding.
- Integer-to-float promotion now rounds to a normalized 24-bit mantissa across
  typed storage, mixed operations/comparisons and numeric functions, including
  Val-derived integers. Independent bytes and execution tests cover the paths;
  result rounding and reference execution remain outstanding. See
  [numeric compatibility](docs/numbers.md).
- Floating addition/subtraction and For/Next increments now share a mantissa
  implementation based on preserved Motorola FFP routines, including alignment,
  cancellation, saturation and underflow. A sixth independent-byte fixture
  distinguishes its rounding paths from JavaScript. Other float operations and
  comparison with the selected AMOS/Kickstart library remain unfinished.
- Floating multiplication and division now use shared mantissa helpers derived
  from preserved FFPMUL2/FFPDIV routines, with two more independent-byte fixtures.
  Tests include product carries, recurring quotients, exponent guards and DIVU
  estimate boundaries. The intended Kickstart multiply variant and library
  behavior still need reference verification.
- Val and numeric file input now share an AMOS-source-derived scanner and FFP
  decimal converter, including intermediate rounding/scaling, runtime type,
  signed exponent wrapping and source-derived integer/based boundaries. A ninth
  independent-byte fixture covers conversion separately from arithmetic.
- Ln, Exp and power now use shared FFP/CORDIC routines derived from preserved
  Motorola source, with domain/range checks and typed execution coverage. Pi#
  uses AMOS's stored single-precision constant. A tenth independent-byte fixture
  records selected results. Base-10 Log and target-library equivalence remain
  unfinished.
- Sin/Cos/Tan now share circular CORDIC, source-derived reductions and pole/
  precision-limit paths. Degree/Radian are per-program modes. An eleventh
  independent-byte fixture and standalone Chromium drawing/pixel checks cover
  this slice; comparison with the target mathtrans version remains outstanding.
- Abs/Int preserve static or Val-derived integer/float type; Sgn returns an
  integer. Original handlers establish unchecked integer Abs and float-preserving
  floor. Typed storage and a twelfth independent-byte fixture cover this slice;
  captured reference execution remains outstanding.
- Float-to-integer conversion now follows preserved FFPFPI truncation and signed
  saturation, separate from arithmetic overflow checks. Static bitwise and
  Val-derived expressions agree. Typed storage, file input and a thirteenth
  independent-byte fixture cover the paths; target-library capture is pending.
- Left$/Right$/Mid$ assignment now supports scalar/array string lvalues,
  procedure scopes, bounded overwrites and self-replacement. Length-prefixed
  literals retain embedded zero bytes while identifiers retain padding handling.
  Seven execution groups and a fourteenth independent-byte fixture cover the
  source-derived contract. See [string behavior](docs/strings.md).
- Substring retrieval now follows RFnMid validation order. Concatenation checks
  String_Max only for nonempty operands, and repeated-string results follow
  RString's word length. A fifteenth independent-byte fixture and execution
  coverage include typed storage and all 256 bytes through case/reversal.
  AMOS heap exhaustion and extreme raw-memory search offsets remain unmodeled.
- Embedded Object/Icon banks, static pasting, flipping, image masks, mixed-depth
  drawing and palette transfers are
  implemented and exercised by the browser Graphics demo. See the
  [bank contract](docs/banks.md) for supported depths and remaining limitations.
- External Load now reuses the bounded decoder embedded in standalone modules.
  Synchronous memory/Node adapters support single-bank overrides, image append
  and whole-group replacement. Seven execution groups, a sixteenth independent
  fixture and Chromium pixels cover loading/appending and Bob background cleanup.
  Source/manual numbering edges and partial-file failure semantics are documented.
- Four Reserve forms, Erase/Erase All/Erase Temp and Length now support basic bank
  lifecycle. Zeroed storage, permanence/memory metadata, replacement failure order
  and buffered Bob restoration have seven execution groups and a seventeenth
  independent fixture. Chromium verifies reservation/erasure and restored pixels.
  Physical Amiga memory pools and remaining bank manipulation remain open.
- Bank Swap now preserves bank/data identity and flags while renumbering; generic
  Bank Shrink retains prefix bytes and rejects growth/image banks. Five execution
  groups and an eighteenth independent fixture cover the source-derived rules;
  Chromium verifies active Object-bank swap-out/swap-back composition. The
  original two-absent null-pointer path is explicitly rejected.
- Single/group bank Save now embeds a writer, emits generic/planar formats through
  synchronous file adapters, includes work banks in source-list order, and
  normalizes live image flips before writing. Seven execution groups and a
  nineteenth independent fixture check exact bytes, metadata, ordering, failures
  and Node round trips. Chromium verifies image Save/reload pixels. Oversized
  corrupt-image save paths, physical allocation and partial disk writes remain open.
- Moving Bobs now use saved backgrounds with explicit/manual or cooperative
  automatic updates, hotspots and priorities. The animated Bobs fixture passes
  pixel checks in Chromium. Double buffering, screen swaps and Autoback modes
  are implemented; exact hardware timing remains unfinished.
- Set Bob background modes, selected planes and minterms, plus Limit Bob
  clipping, are implemented with source-derived creation/alignment rules.
  The browser fixture now checks a clipped selected-plane XOR Bob.
- Bob Col and Col status/search queries are implemented with inclusive ranges
  and existing image-mask comparisons. An independent-byte fixture and the
  animated browser example check collision results. See [the contract](docs/collisions.md).

| Area | Implemented | Remaining work |
| --- | --- | --- |
| Binary frontend | Header/code/line bounds, location-aware token decoding, bounded bank/trailer parsing, explicit unsupported-token errors | Broader independent file coverage, more bank formats, dialect and extension contracts |
| Compiler | Separate AST parser and lowerer, typed symbols, control-flow IR, source locations, standalone code generation | Remaining statement/function variants, consistent numeric lowering, legacy-code cleanup |
| Core language | Assignments, expressions, conditions, loops, labels, Gosub/Return, procedures and results | Float fidelity, additional operators/functions, procedure variants, broader reference verification |
| Data and strings | Arrays, scoped DATA/READ/RESTORE, substring retrieval/assignment, common string functions | Remaining memory-dependent byte-string/length rules and edge cases |
| Files | Sequential I/O, structured banks and checked raw Bload/Bsave through explicit memory/Node adapters | IndexedDB persistence, asynchronous modal Fsel$ integration, seek/random-file variants and remaining file operations |
| Execution | Instruction budget, waits, key queue, timer cancellation, stop/resume, per-instance state | Regression coverage as new asynchronous hosts are added |
| Browser graphics | Indexed drawing, Bobs/buffers/Autoback, Canvas/input/direct sprites; ABI/chip memory, physical planar export, basic CPU reference, normal ILBM, bounded copper/stack builder and WebGL2 probe | AMOS screen/copper commands, advanced modes, structured hardware sprites, remaining GPU modes, computed/wide sprites, exact timing and hardware coordinates |
| Audio | Bounded Samples controller and optional Web Audio host, source-derived/offline checks | Remaining music/sample forms, full-game integration, native timing and reference captures |
| ASCII frontend | No implementation | Lexer/parser producing the shared AST |

See [the compatibility matrix](docs/compatibility.md) for precise limitations
and [the display contract](docs/display.md) for graphics behavior.

The test suite is a strong regression baseline, but several newer features use
synthetic token fixtures. Passing those tests alone does not establish AMOS
compatibility. Test19 deliberately reaches an invalid Return; Test25 is an
intentional infinite loop and must remain bounded during verification.

## Architecture to retain

```text
.AMOS bytes
  -> Buffer / TokenReader          validated binary input and locations
  -> Parser                        statement and expression AST
  -> Lowerer                       types, scopes, labels, control-flow IR
  -> Transpiler                    standalone JavaScript program factory
  -> driver + operations           scheduler and language runtime
  -> display / files / host APIs   Node and browser integration
```

Keep parsing free of code-emission side effects. Preserve locations through
every stage. Keep host APIs separate from language semantics and instantiate
mutable runtime state separately for every program.

The current instruction-function table is suitable for AMOS jumps and waits.
A switch dispatcher or optimizer is optional future work, justified by profiling
after correctness is established.

### Display evolution: reference and WebGL2

Adopt [the Amiga display proposal](docs/amiga-webgl-display-plan.md) as the target
for graphics milestone 4, with [repository integration](docs/display-architecture.md)
defining migration and interfaces. Its P0–P12/M0–M12 acceptance catalogue remains
in scope; ECS/OCS come first and AGA remains an explicit optional expansion.

Keep language/runtime semantics on the CPU. AMOS screen/palette/rainbow state
feeds a shared copper builder/interpreter and physical sprite-line builder.
An immutable chip-memory + FrameState snapshot feeds both a pure-JS reference
renderer and a WebGL2 host backend. Pixel comparison, fallback and explainPixel
all use that same revision. Renderers never run program instructions or update
Bob/sprite state. Preserve standalone headless output and per-instance state.

Begin with indexed physical buffers as authority and a one-way planar bridge.
After parity, migrate CPU drawing/text/paste and Bob saved backgrounds to planar
storage, then retire the duplicate writable representation. Point continues to
read logical pixels; Screen Swap exchanges logical/physical identities; sprites
compose independently. Preserve the existing buffering, bank and collision
contracts throughout.

Keep JavaScript, the existing test runner and Playwright. Add planned CPU modules
under `lib/display/`, retaining `lib/amos/display.js` as the AMOS facade. GPU
context/textures/shaders belong to the browser host. Use separate CPU/WebGL canvas
surfaces for switching/context-loss fallback; a canvas already using WebGL cannot
be changed to 2D. No TypeScript/Vitest rewrite or instruction-driver replacement
is required by this workstream.

Freeze the snapshot ABI before GPU work: explicit native/field dimensions,
integer sampling units including ECS superhires, signed sprite positions and an
active flag, endian-independent RGBA bytes, revisioned dirty history, exact event
overflow handling and explicit interlace history. The driver owns emulated time;
requestAnimationFrame only presents committed frames. Hardware mouse semantics
and true VBL timing are separately tested migrations, not backend side effects.

Delivery gates D0–D6 in the integration document map the proposal phases to this
repository: baseline/ABI → CPU bridge → copper/screens → HAM/sprite reference →
GPU parity/lifecycle → authoritative planar storage → real-program/performance
evidence. GPU/reference equality does not replace emulator validation. Keep the
proposal's capture, fuzz, context-loss, 60-second replay and pacing gates visible;
performance targets are unmeasured until profiling proves them.

## Ordered milestones

### 1. Establish reference-backed compatibility evidence

The highest risk is behavior that appears correct under JavaScript but differs
from AMOS.

- Inventory accepted headers, token variants, unsupported commands, and trailing
  data. Distinguish decoded, accepted, and behaviorally verified support.
- Add small AMOS-authored binary fixtures with paired source and captured
  reference output/state where an AMOS installation or emulator is available.
  Record dialect, provenance, and how each result was obtained.
- Prioritize numeric boundaries, mixed integer/float expressions, strings,
  procedure scope/results, DATA behavior, and loop edge cases.
- Retain independently encoded byte fixtures for decoder regressions; avoid
  relying exclusively on the project's token encoder to validate decoding.
- Where reference execution is unavailable, document source/manual evidence and
  mark the behavior provisional rather than claiming exact compatibility.

Acceptance: a reproducible reference-fixture convention and a comparison harness,
with clear separation between reference-verified and inferred semantics.

### 2. Complete numeric semantics and remaining core language

FFP literals are decoded and basic arithmetic uses explicit mantissa helpers.
Decimal input follows the private AMOS FFP converter; Ln/Exp/power use explicit
CORDIC helpers, as do Sin/Cos/Tan with Degree/Radian modes. Base-10 Log still
uses a JavaScript Math call.
Library-version fidelity and those remaining paths can affect branches,
loops, stored values and printed results.

- Specify integer overflow/conversion, default floating precision, rounding,
  range errors, function domain errors, numeric formatting, and trig modes.
  Define double-precision support or reject its unsupported forms explicitly.
- Route numeric operations through shared helpers where AMOS behavior differs.
  Keep statically typed and runtime-typed values such as Val consistent.
- Complete missing core operators/functions in small groups, each with verified
  token encodings, argument/type checks, and execution coverage.
- Substring assignment/retrieval, concatenation bounds and byte case rules are
  implemented; finish memory-dependent string cases and remaining procedure/file
  variants selected by the compatibility target.
- Keep unsupported syntax explicit; do not add token names without semantics.

Acceptance: reference cases cover rounding-sensitive calculations, overflow,
division/domain errors, numeric output, mixed types, and each newly supported
language feature. Existing examples retain their correct results.

### 3. Decode asset banks and render static images

Implemented core: AmBs/AmSp/AmIc/AmBk decoding, embedded assets, per-instance
storage, static pasting, palette transfers, flipping, image masks, mixed-depth
pasting, malformed-input tests and a real bank-backed browser demo. External
single-bank/group Load is now implemented, with standalone Node and Chromium
coverage. Basic reservation/erasure/Length, Bank Swap/Shrink and supported bank
Save are implemented. Additional formats, remaining manipulation and fidelity
cases remain to be completed.

Token decoding is bounded by the declared code section; BankReader separately
loads supported trailing banks. The embedded-bank slice below is complete.
The same bounded decoder now handles external files. Use these acceptance
criteria as regression gates while adding bank manipulation and more formats.

- Add a bounded bank reader for the program trailer and supported bank formats.
  Validate counts, lengths, dimensions, bitplanes, palette data, and empty slots.
  Report bank/byte context for malformed or unsupported formats.
- Decode sprite/icon images into a documented internal representation. Verify
  bitplane order, hotspots, transparency, and palette semantics independently.
- Embed assets into generated modules and create independent mutable bank state
  for each program instance.
- Implement the minimum image/palette/paste commands needed for a complete
  bank-backed demo, including clipping and missing-image diagnostics.
- Explicitly handle nonempty unsupported banks instead of silently discarding
  assets. Preserve intentional support for code-only synthetic fixtures.

Acceptance: malformed-bank tests, exact decoded pixels from independent fixture
bytes, standalone Node execution, and a real browser demo using embedded images.

### 4. Add Bobs, sprites, and practical 2D screen behavior

Implemented Bob subset: movement, hiding/removal, hotspots, priorities,
background/plane/minterm modes, clipping, saved backgrounds, explicit/manual
updates and cooperative automatic updates. The
animated Bobs example is covered in fake-clock and Chromium tests. See
[the Bob contract](docs/bobs.md) and [buffering contract](docs/buffering.md).
Double buffering, Screen Swap and Autoback 0/1/2 now have pixel and browser
coverage. Bob Col/Col and direct sprites now have unit and Chromium coverage;
computed/wide sprites, sprite/cross-type collisions, hardware timing and advanced blitter edge
effects are still required.

The shared snapshot/reference/WebGL2 workstream above supplies the target display
architecture for this milestone. Direct sprites now publish structured physical line state to both
Canvas and the CPU reference, sharing one priority resolver. The opaque Canvas
RGBA callback has been retired. Finish computed allocation and DMA contention/timing
before claiming the complete sprite-reference workstream. Canvas assertions alone do not establish
WebGL2 availability or GPU parity; the separate integer readback probe now proves
local WebGL2 capability. The native non-HAM GPU renderer now passes 179 local
GPU/CPU frames, including 100 seeded inputs. General viewport/input integration, HAM/events
and unfinished mode/capture gates remain open.

- Model object creation, movement, image selection, visibility, priority,
  hotspots, and removal using the verified AMOS contracts.
- Separate destructive image pasting from movable object composition.
- Define update timing, palette interaction, screen ownership, coordinate
  conversion, and supported flipping/collision behavior.
- Add remaining drawing and screen operations according to real program needs.
  Document approximations for Amiga hardware composition and input.
- Ensure object and screen resources are released or detached when programs
  stop, are replaced, or close screens.

Acceptance: a small animated AMOS program runs from generated output, with exact
composition/state tests and browser input/lifecycle checks.

### 5. Add audio through host adapters

- Decode the selected sample-bank format with bounded reads and reference
  fixtures; add music formats as separate capabilities.
- Define playback, looping, volume/rate, channel ownership, and stop behavior.
- Implement a deterministic test host and a browser audio host. Handle browser
  activation through the page's existing Run interaction.
- Specify completion and timer behavior, including stopping or replacing a
  program while audio is active.

Acceptance: a sample-playing fixture works in the browser and deterministic host;
unsupported formats and unavailable hosts produce clear diagnostics.

### 6. Consolidate the supported subset into a usable release

- AGENTS.md architecture/commands now describe the active pipeline and tests.
- Repository legacy-consumer inventory is recorded in docs/development.md. No
  active imports were found; settle external deep-import compatibility before
  retiring legacy files.
- Keep README, compatibility documentation, examples, and generated demos aligned.
- Unit/CLI and browser checks are configured in CI; Node/browser baselines and
  reproducible installation are documented. The same check commands pass locally
  on both CI Node majors. Obtain a hosted run to verify runner/system setup.
- Choose representative real AMOS programs, list every unsupported dependency,
  and close gaps in bounded increments rather than promising general support.
- Add source-to-generated-code mapping/debugging support when required by those
  programs; defer optimization until measured.
- Add an ASCII lexer/parser sharing the existing AST once the core contracts
  are stable, with binary/ASCII equivalence tests.

Acceptance: a versioned, documented compatibility target, reproducible checks,
and representative programs that compile and run without manual generated-code
patches. Describe coverage precisely rather than claiming full AMOS support.

## Immediate implementation sequence

### Display foundation progress and next work (D0–D2)

1. Completed locally: direct-sprite verification, regenerated demo baseline and
   existing artifact/unit/browser gates (255 tests; Node 18.19.1).
2. Implemented: ABI v1 chip/frame serialization, structural validation, independent
   planar/endian/PNG-filter fixtures and byte/PNG mismatch reporting with a stub.
   Independent plane-order/odd-width/stride patterns now pass with the P1 renderer.
   The actual WebGL2 integer framebuffer-readback probe
   is implemented and passes locally; it runs in the existing CI browser command,
   with hosted execution pending. Context creation alone cannot satisfy M0.
3. Implemented locally: ChipMemory/independent dirty queries, basic pure-JS
   reference/explainPixel, bounded normal ILBM/ByteRun1 and physical playfield
   snapshots in standalone factories. Existing text/images/Bobs, Autoback and
   logical/physical semantics pass migration comparisons. Sprites are explicitly
   outside this playfield-only export; indexed storage remains authoritative.
4. Implemented locally: bounded OCS copper MOVE/WAIT/SKIP/jumps, per-line palettes,
   signed modulos, pointer latches and a shared screen-stack builder. Standalone
   snapshotDisplay/renderDisplay use it and preserve physical-buffer semantics.
   EHB, static scroll/DPF and explicit IFF fields/weaving now pass independent
   fixtures. HAM6 now passes ten independent six-plane ILBM goldens, five-plane
   and laced cases, standalone Canvas/planar/copper and buffer comparisons; see
   [HAM contract](docs/ham-display.md). Physical sprite reference and direct AMOS export now pass synthetic
   priority/attachment/edge cases; bounded DMA/reuse and manual register output are implemented too.
   Computed allocation and bus/latch timing remain in D3.
   Also verify AMOS screen/rainbow/copper command tokens and source
   semantics; add positioning/offsets, ECS superhires and live field/input timing.
   Keep M2's three-capture gate and exact DMA timing limits open.
5. Implemented locally: WebGL2 resource storage/readback, owned dirty-row
   comparisons and forced context loss/restoration/disposal (M6 infrastructure).
   Implemented next: GPU decode/resolve for the current non-HAM CPU subset,
   with 179 GPU/CPU comparisons and restored-shader rerendering.
   GPU nearest/aspect/letterbox presentation now passes six canvas/restore checks.
   Bounded live host switching/input integration now passes; next add arbitrary
   viewport/input routing, live diff, HAM and event support;
   [resource boundaries](docs/webgl-resources.md) remain explicit.
6. Continue through D2–D6 and all associated M0–M12 gates. Build CPU/GPU parity
   on shared snapshots before replacing drawing storage or enabling new modes.
   Preserve numeric, audio, release and ASCII requirements as separate workstreams.

### Numeric compatibility work package (continuing)

The compiler architecture is already in place. Continue it incrementally;
do not restart the parser or replace the dispatcher before measuring a need.

1. Inventory numeric paths in `lib/Lowerer.js` and
   `lib/amos/operations.js`: literals, static expressions, Val-derived values,
   assignments, arrays, procedure parameters/results, and DATA. Record where
   conversion or arithmetic currently falls through to JavaScript.
2. Add independent cases for mixed types, rounding-sensitive arithmetic,
   float-to-integer boundaries, and invalid function domains to
   `test/fixtures/conformance/`. Use the existing evidence categories; obtaining
   reference AMOS captures requires access to an AMOS installation or emulator.
   Source-derived cases can proceed while that dependency remains unavailable.
3. Implement shared numeric conversion and floating arithmetic helpers in
   `lib/amos/operations.js`, then route both static and dynamic expressions in
   `lib/Lowerer.js` through them. Verify the intended FFP rounding and error
   behavior before treating JavaScript results as compatible. Keep exact print
   formatting as a separately tested part of this package.
4. Cover the same calculations through scalar assignments, arrays, DATA and
   procedure returns so type conversions agree across storage boundaries.
   Preserve exact Tests7/14/21 regressions and the full unit/CLI suite.

Progress: the numeric path inventory is in `docs/numbers.md`. Shared
integer-to-float promotion is implemented with typed storage and mixed-operation
coverage. Floating addition/subtraction and loop increments use a shared FFP
adder. Multiplication/division now have shared helpers and two more independent
fixtures. Decimal input now uses the private AMOS conversion algorithm. Numeric
source-analysis additions include Ln/Exp/power, Pi,
circular trigonometry/angle modes, Abs/Sgn/Int with preserved result types, and
float-to-integer truncation/saturation across storage and bitwise operations.
Including string behavior, external I/O and bank operations, nineteen independent-byte
fixtures are present.
Next identify the
target mathffp multiply variant and verify the source-derived division boundaries;
complete base-10 Log, inverse trigonometry and remaining function semantics;
compare float-to-integer saturation with captured execution of the selected
mathffp version. The implemented source model and that evidence gate are separate.

Done when: numeric paths use an explicit documented contract, the new boundary
cases pass through standalone generated modules, unsupported precision modes
fail clearly, and the compatibility matrix identifies remaining provisional
behavior. Reference execution remains a separate evidence gate until captures
are available; passing synthetic tests does not satisfy it.

### Following work packages

- Core completeness: memory-dependent string cases, missing functions/procedure
  forms, and selected file variants, each
  delivered with binary execution fixtures.
- Practical graphics: D0–D1 display foundations first, then D2–D6 with the full
  reference/WebGL proposal gates. Complete computed/wide sprites and
  sprite/cross-type collisions alongside the shared sprite-line model. Retain
  buffered Bob and external bank round-trip cases; add copper/mode captures.
- Audio: choose one bank format and playback command set, implement a
  deterministic host first, then verify browser playback and lifecycle.
- Release: obtain hosted CI evidence, settle legacy deep-import compatibility,
  and validate representative real AMOS programs against a versioned supported
  subset. Architecture guidance, internal consumer inventory and workflow setup
  are implemented; they do not complete this release milestone by themselves.
- ASCII input: add a frontend producing the same AST; require binary/ASCII
  programs to execute equivalently before exposing it through the CLI.

These packages follow the ordered milestones above. Reference verification
continues across every package rather than blocking all independent work.

### Continuing verification

1. Extend the conformance-fixture convention and initial integer boundary cases
   with actual AMOS captures and floating-point cases. The convention and nineteen
   independent-byte source-analysis fixtures are implemented.
2. Continue numeric compatibility: consistent conversion/rounding and
   errors across static expressions and Val-derived values, using verified
   behavior. Shared integer arithmetic, division boundaries and Mod are
   implemented; full floating-format work remains explicitly scoped.
3. Extend reference execution coverage for the implemented static-image slice;
   flipping, mask commands and mixed-depth behavior follow original routines and
   have unit and real browser coverage.
4. Follow the integrated display gates while extending Bobs/sprites and hardware
   screen composition. Retain buffered browser acceptance cases; verify reference
   snapshots, explicit GPU execution/parity, context lifecycle and captured timing.
5. Continue through graphics and audio, updating the compatibility matrix
   after each accepted increment.

For every slice: verify the encoding and semantics, implement decoder/parser/
lowerer/runtime changes as needed, add meaningful execution tests, update docs,
and run the relevant checks. Use fake clocks and finite budgets for waits and
loops. Require the real browser check for rendering, input, or browser lifecycle
changes.

This plan does not require restarting the compiler or reopening the resolved
Tests7/14/21 work. Existing uncommitted files, including the format notes and
out14.module.js, are working-tree material to preserve during implementation.
