# Repository Guidelines

## Project structure and architecture

- `lib/Buffer.js` validates AMOS headers, code bounds and binary reads.
- `lib/TokenReader.js` decodes tokens with physical line/byte locations;
  `TokenTable.js` records original token offsets.
- `lib/Parser.js` builds ASTs without code-emission side effects. Function/display
  signatures live in `FunctionTable.js` and `DisplayTable.js`.
- `lib/Lowerer.js` handles typing, scopes, labels and control-flow IR.
  On Gosub/Goto use one numeric selector and scoped named targets, returning the
  ordinary call/goto controls. Cached On verifier words are decoded within line
  bounds; targets are rebuilt and all labels validated. See `docs/computed-branches.md`.
  `lib/Transpiler.js` emits standalone program factories.
- `lib/BankReader.js` decodes supported trailing and external asset banks; generated
  modules embed it for runtime Load through the synchronous files adapter.
- `lib/BankWriter.js` encodes supported ABK/ABS files and is also embedded for
  runtime Save. Serialization coverage includes independent expected bytes.
- Print Using carries per-item format AST expressions into the existing print IR.
  A shared integer/string formatter validates the format before its value thunk;
  no format state persists across items. Float/decimal/exponent fields remain
  unsupported. See `docs/print-using.md` for bounds and source evidence.
- `lib/amos/driver.js` executes an instruction-function table using `state.ip`,
  call/procedure stacks, cooperative budgets and waits. It is not a switch emitter.
- `lib/amos/operations.js` implements language operations; `display.js` models
  indexed screens; `font.js` supplies glyphs; `files.js` provides synchronous
  memory/Node file adapters. Host-specific APIs belong in adapters.
- `lib/amos/bankMemory.js` maps generic-bank payloads to checked per-factory
  virtual addresses for Start/Peek/Poke. These are separate from display chip
  addresses. Preserve addresses across swap/shrink; retire them on replacement
  or erasure. See `docs/bank-memory.md`. Canvas Key Speed repeats use fixed
  50ths and input-reset subscriptions for lifecycle cleanup; see `docs/key-speed.md`.
- `lib/ExtensionTable.js` records implemented extension slots/offsets; slot-1
  Music sample commands use `lib/amos/audio.js` for bounded Samples records and
  voice commands. `webAudio.js` is the optional browser adapter. Generated
  modules embed the pure controller; headless execution needs no AudioContext.
  Keep source-derived expectations distinct from native Web Audio control-graph
  comparisons and Amiga captures. See `docs/audio.md` for the subset and limits.
- `lib/amos/browser.js` handles Canvas/input; `background.js` exposes AMOS.
  Generated modules embed scheduler, operations, display and font, without imports.
- Scancode is a destructive last-successful-Inkey latch, not held key state.
  Optional sendKey character/raw-code records coexist with legacy text entries.
  Clear Key drains the queue; host clearScanCodes clears metadata while retaining
  text. Canvas owns physical mapping/repeat/blur cleanup; Key Speed preserves
  the latch. See `docs/scancodes.md` for source evidence and unsupported forms.
- Joystick ports 0/1 use per-factory masks and an optional synchronous reader.
  Canvas hosts opt into configurable keyboard/Gamepad API mappings; queries poll
  independently of requestAnimationFrame. Clear owned input on focus/lifecycle
  changes without conflating Key Speed with held joystick state. See
  `docs/joysticks.md`; menu fixture/injected device evidence is not a hardware capture.
- `Load Iff` embeds the bounded ILBM reader for opaque non-laced screen loading.
  Table-based rainbows materialize palette rows through the copper builder;
  Canvas uses the same slot/row selection. Auto View/View stage screen replacement
  separately from selected logical output. See `docs/title-display.md` for the
  implemented subset and explicit pattern/NTSC/AMSC/timing gates.
- Fade to black uses one per-program captured palette job and a driver-owned
  wake on the injected VBL clock, independent of requestAnimationFrame and VM
  waits. Stop cancels wakes; Resume reconciles elapsed fields; End/failure cancel.
  Screen lifecycle subscriptions cancel even under Auto View Off. See
  `docs/fade.md` for the bounded speed/form and timing/capture limits.
- Screen Display/Screen Offset manage bounded nonoverlapping windows. View commits
  geometry and source offsets; Canvas renders the same physical copper snapshot.
  Full bitmap storage remains authoritative. Setup can span real blank rows,
  with each chunk completed before fetch. See `docs/screen-windows.md`; general
  placement/priority, wrapped DMA and HAM fine scroll remain open.
- `lib/display/model/` contains the versioned snapshot codec, revisioned chip
  memory, static physical-screen bridge and bounded normal ILBM/ByteRun1 loader.
  `lib/display/reference/render.js` provides basic planar render/explainPixel.
  Generated modules embed CPU snapshot/reference helpers; `snapshotPlayfield`
  exports physical pixels only, with sprites still a separate presentation layer.
  See `docs/planar-display.md` for the implemented subset and remaining gates.
- `lib/display/reference/sprites.js` resolves eight physical channels, attached
  pairs and playfield priorities. `snapshotDisplay` publishes direct AMOS sprite
  rows; `snapshotPlayfield` remains sprite-free. Bounded DMA/reuse/manual registers
  live in `lib/display/copper/spriteDma.js`. Contention/timing and computed allocation
  remain open; see `docs/sprite-display.md`. Canvas consumes the same structured
  sprite writer/resolver; do not reintroduce an opaque RGBA compositor callback.
  HAM6 uses shared packed colour helpers
  in `lib/display/model/color.js`; see `docs/ham-display.md`.
- `lib/display/copper/` has the bounded OCS interpreter and shared stack builder.
  `snapshotDisplay`/`renderDisplay` use it in standalone factories, preserving the
  full-bitmap `snapshotPlayfield` migration API. AMOS display/copper commands,
  exact DMA timing and capture gates remain open; see `docs/copper-display.md`.
- `lib/display/presentation/composeField.js` owns pure weave/line-double
  composition with explicit previous output. The renderer supports static
  scroll, EHB and DPF; the IFF reader selects laced fields. Live field timing,
  ECS superhires and AMOS display command integration remain open. See
  `docs/display-modes.md`, including source-backed Colour masks and Hires limits.
- `lib/display/webgl/resources.js` owns WebGL2 ABI textures, dirty-row snapshot
  uploads, debug readback and context restoration/disposal. `webgl/renderer.js`
  runs non-HAM decode/resolve/sprite shader passes on shared snapshots; see
  `docs/webgl-renderer.md`. Its presentation shader uses shared rational layout
  from `presentation/layout.js`. Host switching/input, HAM/events and full mode/capture
  parity remain open. Never count a CPU fallback as GPU execution.
- `bin/amoscript` invokes `lib/command.js`; `index.html` runs generated demos.
- `examples/` contains Test1–27 and synthetic programs with `.Asc` references.
  ASCII is not an accepted compiler input yet.
- `Grammar.js` and `RuleFunctions.js` are legacy. No compiler, CLI, test or tool
  imports them; Grammar still imports RuleFunctions. Preserve them until their
  external compatibility/removal policy is settled.

## Commands

- `npm ci`: install locked dependencies.
- `npm run check`: verify generated demos, then run unit/CLI/integration tests.
- `npm test`: discover `*.test.js` and `test-*.js` through `test/run.js`.
- `npm run build:demo`: regenerate the three standalone browser modules and
  self-contained browser-test gallery in `demos/`.
- `npm run check:generated`: report missing/stale modules and gallery pages without writes.
- `npm run build:examples`: regenerate additional synthetic examples.
- `npm run install:browser`: install pinned Playwright Chromium in the ignored
  `.cache/ms-playwright`, unless PLAYWRIGHT_BROWSERS_PATH overrides it.
- `npm run install:browser -- --with-deps`: also install browser system libraries
  on supported Linux hosts; this can require elevated system permissions.
- `npm run test:browser`: check demos, then run real Chromium Canvas/input/lifecycle
  tests and every gallery scenario offline. Screenshots go to ignored `test/artifacts/`.
- `node bin/amoscript examples/Test21.AMOS /tmp/program.js`: compile without
  overwriting existing files. Omit the output path to use stdout.
- `node -e "require('/tmp/program.js')({ setTimeout }).tick(1000)"`: execute it.
- `node tools/dump_tokens.js examples/Test7.AMOS` and
  `node tools/dump_ir.js examples/Test14.AMOS`: inspect decoding/lowering.

CI targets Node 22/24 on Ubuntu 24.04, with Chromium on Node 24. Node 18.19.1 has
also been used locally. Hosted CI evidence exists only after the workflow runs.

## Coding conventions

- Use semicolons, two-space indentation, template strings, and the existing
  `/* jshint esversion: 6 */` comment. Class files use PascalCase; helpers use
  lowerCamelCase.
- Verify original token offsets before adding names. Add parser/lowerer/runtime
  semantics together and reject unsupported forms explicitly.
- Carry source locations through AST/IR; runtime failures must halt with context.
- Use shared language helpers where JavaScript coercion/Math differs from AMOS.
  Static expressions and Val tags must agree at conversions/storage boundaries.
- Generated cases perform their semantic effects and return control objects for
  branches/calls/waits. Allocate program variables up front. Each factory call
  must have independent mutable language/runtime/asset state.
- Browser and Node share semantics; keep parsing free of code-generation effects.

## Verification

- Preserve Test7 numeric ordering, Test14 procedure behavior, and Test21's exact
  `Start → One → Two → Three → End` output. Test26/27 use tolerances for
  source-derived power approximations; integer/string cases use exact results.
- Execute standalone generated modules without `require` in their sandbox.
  Check outputs, state transitions, bounded execution and timers.
- Inject `setTimeout`, `clearTimeout` and millisecond `now` together. Use fake
  clocks and finite budgets; Test19 deliberately reaches an invalid Return,
  while Test25 deliberately loops forever.
- Keep decoder coverage independent of the production encoder where possible.
  Conformance fixtures distinguish source analysis from actual reference
  execution. Never relabel derived expectations as AMOS captures.
- Exercise typed scalars, arrays, DATA and procedure results for semantic changes.
- Rebuild demos after codegen/runtime edits, then run `npm run check`. Rendering,
  input and browser lifecycle changes also require `npm run test:browser`.
- Passing synthetic tests does not prove full AMOS compatibility. Document limits
  in the appropriate `docs/` contract and compatibility matrix.
- Keep browser scenarios in `test/helpers/browserScenarios.js` so Playwright and
  generated demos share evaluator inputs and assertions. Every browser test must
  have a runnable demo and an HTML Preview link from `demos/index.html`.

## Commits and pull requests

Use concise present-tense commits, such as `fix(parser): preserve literal bytes`.
PRs should explain behavior, rationale, source evidence and material limits; list
relevant checks and fixtures. Do not claim checks/reference execution not run.

## Continuing work

Follow `PLAN.md` and `docs/compatibility.md`. Numeric formatting, base-10 Log,
remaining functions, target-library reference captures, sprites, audio, remaining
bank/file forms and an ASCII frontend remain open. Replacing the established
parser/dispatcher or optimizing it needs measured evidence.

For display work, follow `docs/display-architecture.md` and the detailed
`docs/amiga-webgl-display-plan.md` acceptance gates. Keep the JavaScript runner
and headless CPU runtime. Begin with a versioned physical-buffer snapshot bridge;
make planar storage authoritative only after parity. CPU and GPU consume the same
immutable snapshot. Keep AMOS timing independent of requestAnimationFrame and
preserve logical/physical buffers, Autoback, Bob snapshots and input contracts.
Distinguish CPU/GPU parity, source-derived fixtures and external Amiga captures.
