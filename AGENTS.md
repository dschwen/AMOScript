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
- Bload/Bsave transfer raw synchronous byte strings through checked generic-bank
  ranges. Bload preserves payload/address identity; Bsave excludes its end address
  and validates/snapshots before truncating the destination. Wonderland's original
  7,205-byte save omits seed 5; preserve that source behavior. See `docs/raw-files.md`.
- Fsel$ uses one synchronous `files.select` call with frozen path/default/title
  metadata and a complete returned path or empty cancellation. Memory files may
  queue prepared choices; browser uploads finish before VM execution. Do not
  replay expressions or return Promises to await a modal picker. See
  `docs/file-selector.md`, including the unmodified bounded first-level run.
- Print Using carries per-item format AST expressions into the existing print IR.
  A shared integer/string formatter validates the format before its value thunk;
  no format state persists across items. Float/decimal/exponent fields remain
  unsupported. See `docs/print-using.md` for bounds and source evidence.
- `lib/amos/driver.js` executes an instruction-function table using `state.ip`,
  call/procedure stacks, cooperative budgets and waits. It is not a switch emitter.
- `lib/amos/operations.js` implements language operations; `display.js` models
  indexed screens; `font.js` supplies glyphs; `files.js` provides synchronous
  memory/Node file adapters. Host-specific APIs belong in adapters.
  Dir$ owns a per-program verified prefix; Exist uses strict synchronous boolean
  metadata, never file reads. Route all transfers through one prefix and retain
  resolved write/channel names across host callbacks. Case/volume mapping stays
  in adapters; parent/assign/lock forms remain open. See `docs/directories.md`.
  Set Stack is frozen compilation metadata, not native stack allocation; Break
  Off records a host flag/hook without disabling host Stop. True/False/Not use
  integer AMOS values; Hide/Show have signed-word nesting and On resets. The
  unchanged first 17 Roller II lines stop at a synthetic Wait Key, before FLOAD
  and AMSC title placement. See `docs/startup.md` and `docs/roller2.md`.
  The separate first-image fixture now runs original lines 1–18 and FLOAD 63–68,
  with guards before WTIN. Pop Proc unwinds local Gosubs via ordinary procedure
  return. Static Screen Clone aliases share pixels with independent palettes;
  clones are unselectable and owner replacement/close requires closing clones.
  Screen Hide/Show stage visibility; Get Palette and Fade To screen capture all
  32 registers. Bounded AMSC placement validates before replacement. Independent
  Python pixels and seven GPU frames cover the first logo, not the main title.
  See `docs/roller2-title.md`; wider clone/AMSC/fade forms remain gated.
  Explicit Fade lists accept up to 32 integer/boxed-integer goals, skipping
  negative/omitted entries; native float bit-pattern forms reject. Original
  WTIN/FDZ run in a declared intro fixture with original array/highscore setup,
  SASINIT and work/icon/sprite bank loads before main-title load 287. Setup
  281–286 remains omitted; independently transcribed tables/scores are shared
  between browser and headless assertions. Tall 320-pixel lowres IFFs preserve bitmap rows behind
  bounded PAL/NTSC default windows. See `docs/roller2-intro.md`; the menu/game
  and exact native busy-loop timing are not covered by that fixture.
  The connected menu fixture retains original executable startup through 316,
  including Make Icon Mask, Led Off, screen retirement and continuing MOD music.
  Only unused procedures/comments are omitted; destination guards stop before
  board drawing and editor/scores/help routines. Game selection now
  runs original game entry through setup/first-level loading at 600 before its
  guard; board rendering and gameplay remain open. Its WebGL/fullscreen host reuses browserAudio
  for gesture activation, mute, Restart bindings and owned-context closure.
  See `docs/roller2-menu.md`; selected routines/gameplay remain open.
  Isolated GAMEDISP now checks all fifteen maps against independent raw-asset
  board pixels/counts. Its palette restoration is a declared preview harness.
  A separate connected ready fixture runs original GAMEDISP and 601–608 through
  bounded Screen To Front slices and real DMA-disabled setup rows. No RGBA overlay
  or relaxed visible-row budget; equal-width lowres/shared COLOR00, no active
  sprites. Original input exits read level metadata before the ready-only guard.
  The live fixture now runs through 617: BALLFARBEN, low-four-plane direct sprite
  output from the six-plane bank, initial fade, BDRAW border and timer setup.
  Earlier menu/ready unit guards remain bounded; movement still stops before
  JOAB in the ball fixture. A separate input fixture includes original 619–639,
  toggles/countdown and Escape title return; movement/pause/game-over targets
  are guards. Main ASCII string Goto/Gosub and integer Add now run original BEWEG, floor,
  stop and Lasttest movement in a separate fixture. Other SASINIT labels are
  explicit handler guards in that fixture. A separate colour fixture now runs
  KCWEG/HCWEG, BCL and GAMED through all five first-level colour collections.
  Sparse Fade omissions preserve register positions and skip jobs for those
  entries; malformed values reject before replacing the job. The colour fixture
  stops at a declared ZAEHLHOCH bonus guard with its ordinary Gosub frame.
  See `docs/roller2-colours.md`. A separate progression fixture now runs original
  ZAEHLHOCH and Return/Goto LEVLOAD into real level 2, including ready input,
  metadata, fade and starting ball. Its inclusive bonus, captured For bound,
  bank-address retirement and missing-file win guard are checked. Fourteen
  Canvas frames/seven GPU comparisons use keyboard/Gamepad. See
  `docs/roller2-progression.md`. A separate pause fixture adds original 966–984:
  mouse/Help paid pause, Space popup and WTIN exits preserve source Timer
  restoration (including negative values) and ordinary stacks. Keyboard fire is
  Enter in that demo so Space reaches AMOS. Twenty Canvas frames/ten GPU
  comparisons cover the source paths and host lifecycle; see `docs/roller2-pauses.md`.
  A new arrow fixture adds unchanged PFEIL/N34, three level-2 turns and actual
  Boom at the arrow deadline before the game-over guard. Thirty-two one-pixel
  positions, twenty Canvas frames/ten GPU comparisons pass; see `docs/roller2-arrows.md`.
  Other handlers and later-level progression remain open.
  Prepared original stop/collapse maps are declared adapter fixtures, not native
  level progression. See `docs/roller2-movement.md`, `docs/add.md` and
  `docs/string-branches.md`. Numeric/procedure/non-ASCII string branches remain open.
  Earlier fixture bounds are in `docs/roller2-input.md`, `docs/roller2-ball.md`,
  `docs/roller2-boards.md` and `docs/screen-priority.md`. Exact native timing and
  full gameplay remain open.
- Set Line stores a per-screen low-word mask and preserves a separate portable
  phase counter. Patterned Draw/Draw To/Box use bounded signed-word endpoints,
  MSB-first steps and opaque Ink background; default solid clipping stays intact.
  Box follows the original PolyDraw traversal. Rewind phase for Autoback replay
  and preflight patterned geometry before Bob hooks. Original 333/354/356 run
  on a declared blank/palette preview, with prepared cell Input# replacing 355.
  Three independent Canvas/GPU frames cover it, not full editor/native capture.
  See `docs/set-line.md`; general graphics draw modes remain gated.
- Change Mouse supports built-in 1/2/3 as per-factory pointer intent, independent
  of Hide/Show nesting and screen/pixel/input state. No explicit shape initially
  retains the host cursor. Canvas/WebGL map explicit choices to default/crosshair/
  wait; hidden uses none. Detach/replacement restores each host's owned cursor.
  Seven original editor statements and thirty browser style checks are covered,
  with seven GPU surface regressions. Configured/native artwork and sprite-bank
  pointers remain gated; see `docs/change-mouse.md`.
- Scin scans the live priority list using unsigned hardware words, hidden flags
  and exclusive right/bottom bounds. Its explicit screen starts traversal rather
  than filtering a single screen; -1 scans all, no hit returns signed EntNul.
  Keep lookup separate from selection, committed View, offsets and Mouse Zone.
  Static clones participate; hires halves hardware width. Original 341–342 and
  344–346 run on prepared windows/zones with scrolling 343/actions omitted.
  Seven Canvas/GPU frames and both hardware-input hosts are covered; see
  `docs/scin.md` for supported selectors and remaining mode/capture gates.
- Writing 0–4 and parts 0–2 affect the default window text writer, not graphics
  Text/Set Line/Cline. Keep one shared pair per factory with per-screen activation;
  Screen Open resets the pair, Pen/Paper preserve activation. Ignore still advances
  controls/scrolling and host output intent. Original 333–334 labels and a separate
  fifteen-case matrix match four independent Canvas/GPU frames on prepared blank
  previews. General windows/native capture remain open; see `docs/writing.md`.
- Fill/Copy use the shared checked bank-memory resolver and signature lowering.
  Fill repeats big-endian long bits with an exclusive end and allows empty ranges;
  the subset caps at 1 MiB and rejects odd starts for 16-byte blocks. Copy uses
  raw addresses, an exclusive/nonempty range and memmove overlap semantics.
  Preflight both ranges/permissions; preserve identities, raw-icon stale masks
  and the active-Tracker write guard. Original editor 415, 325–326 and 561 run
  on all fifteen prepared payloads before an explicit EDDISP procedure guard.
  No editor rendering or persistence is claimed. See `docs/bulk-memory.md`.
- Rnd/Randomize keep per-factory seed/cache state and the source's swapped-word
  multiplication, masked rejection and zero-bound repeat. Positive bounds accept
  an optional synchronous `readRandomBeam` word; defaults are explicit zero seed/
  beam choices, not native startup/timing claims. See `docs/random.md` for the
  rejection bound, independent vectors and original enemy fixtures.
- `lib/amos/bankMemory.js` maps generic-bank payloads to checked per-factory
  virtual addresses for Start/Peek/Poke. These are separate from display chip
  addresses. Doke/Deek and Loke/Leek use checked complete two/four-byte ranges,
  big endian and odd addresses; writes preflight and share the active-Tracker
  guard. Deek zero-extends; Leek returns signed integer bits. Bounded raw icon
  count/pointer/header/planar views now support ICCOPY; sprite banks and raw icon
  metadata/mask-pointer access remain gated. Raw planar writes update canonical
  indexed pixels and preserve old masks. Rounded padding is separate, owned and
  zero-initialized as a portable default. See `docs/icon-memory.md`. Preserve addresses across swap/shrink; retire them on replacement
  or erasure. See `docs/bank-memory.md`. Canvas Key Speed repeats use fixed
  50ths and input-reset subscriptions for lifecycle cleanup; see `docs/key-speed.md`.
- `lib/amos/boom.js` renders bounded four-voice source-derived Boom with owned
  shared noise, integer envelope and fractional field onset. Portable seed/constant
  beam choices are explicit; finite float PCM feeds the existing Web Audio voice
  host. Independent Python PAL/phase/NTSC vectors and five native browser graph
  comparisons pass. Exact DMA/beam capture, interrupt tails and live mutable
  wave/envelope parity remain open. Sam loops cannot loop the effect; Stop/End
  cancels held effect PCM without phase restoration. See `docs/boom.md`.
- `lib/amos/mod.js` decodes owned four-channel M.K. files without playback.
  Track Load uses raw synchronous bytes in a chip `Tracker ` bank plus 32 zero
  workspace bytes; loop flags are per factory. Track Play/Stop use a driver-owned
  VBL wake and shared sample voices; all overloads use checked chip Tracker banks.
  Roller II is the current target; see `docs/roller2.md` and `docs/mod-tracker.md`.
  Its end tunes are AMOS Music banks, not MODs. Never count a pattern inspector
  or loop flag as tracker playback.
  `lib/amos/tracker.js` provides direct field-stepped C/A/E/F/D playback with
  owned PCM preprocessing and raw restart semantics. VM Track Play also mutates
  the bank's sample-start longs/finetunes. Host Stop freezes music and silences
  held samples; Resume rebases fields without restoring held sample phase.
  Bank replacement/erasure/shrink stops playback; active Poke/Bload rejects.
  The playable tracker demo runs bounded original music statements, not the game.
  Web Audio explicit repeat bounds apply after the full initial sample fetch;
  short/silent repeat regions must not truncate it. The tracker demo verifies
  all 1,997 original triggers and all ten instrument waveforms independently.
- `lib/ExtensionTable.js` records implemented extension slots/offsets; slot-1
  Music sample commands use `lib/amos/audio.js` for bounded Samples records and
  voice commands. `webAudio.js` is the optional browser adapter. Generated
  modules embed the pure controller; headless execution needs no AudioContext.
  Keep source-derived expectations distinct from native Web Audio control-graph
  comparisons and Amiga captures. See `docs/audio.md` for the subset and limits.
- `lib/amos/browser.js` handles shared Canvas/input; optional `{renderer}` routes
  snapshots to WebGL render/present/clear without CPU pixels. The caller owns GPU
  disposal. The live demo defaults to GPU and switches canvases without replacing
  the VM/audio binding; full-frame rational sizing preserves pointer mapping.
  `clear()` forgets removed-screen presentation across restoration.
  `background.js` exposes AMOS.
  Generated modules embed scheduler, operations, display and font, without imports.
- `lib/amos/fullscreen.js` owns browser fullscreen for a stable container. Fit CSS
  around the canvas without resizing its bitmap/GPU buffers; margins stay outside
  the pointer rectangle. Preserve the container across renderer switches/Restart.
  Escape exits fullscreen before reaching AMOS, and disposal exits only its own
  container, including late requests. See `docs/fullscreen.md`.
- Key State is a nondestructive per-program raw held map, separate from text
  and Scancode. Canvas records mapped keydown/keyup before joystick consumption;
  lifecycle/blur/visibility/detach clear owned state, while Clear Key/Key Speed
  preserve physical holds. Host sendKey never implies held state. See
  `docs/key-state.md`. Uncached named Goto/Gosub operands normalize to ordinary
  checked labels. Only unverified slot-1 Sam Play base tokens resolve the existing
  1–3 numeric argument family; cached overloads keep exact arities.
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
- Explicit Flash cycles and selected-screen Flash Off share that palette wake.
  Catch-up reduces writes by field, preserving Flash-before-Fade ties and later
  Flash writes after Fade completes. Jobs follow actual screen identity; see
  `docs/flash.md`. Implicit Screen Open flashing and wrapped speeds remain open.
- Screen Display/Screen Offset manage bounded nonoverlapping windows. View commits
  geometry and source offsets; Canvas renders the same physical copper snapshot.
  Full bitmap storage remains authoritative. Setup can span real blank rows,
  with each chunk completed before fetch. See `docs/screen-windows.md`; general
  placement/priority, wrapped DMA and HAM fine scroll remain open.
- Two-operand Screen Copy resolves Logic/Physic integer selectors at execution
  and copies common bitmap planes without swapping identities or invoking
  Autoback/Bob hooks. Saved Bob backgrounds retain their existing owners. See
  `docs/screen-copy.md`; rectangle/minterm variants and exact DMA timing remain open.
- Reserve/Set/Reset Zone and Zone queries use per-screen unsigned-word rectangles,
  inclusive edges and lowest-number overlap priority. They do not draw or change
  presentation. Keep hardware mouse conversion separate from the existing Canvas
  pointer contract; the original editor-panel fixture injects hardware coordinates.
  See `docs/zones.md` for bounds and remaining mouse/zone forms.
- Limit Mouse captures per-program hardware bounds; Mouse Click compares held
  buttons with the previous query rather than queuing events. Canvas preserves
  default local coordinates and opts into committed raster hardware coordinates
  with `mouseCoordinates: 'hardware'`. Focus/lifecycle cleanup clears buttons and
  click history, preserving limits and position; Key Speed leaves them alone.
  X/Y Mouse assignment requires explicit Limit Mouse bounds and uses doubled
  unsigned-word clamps with EntNul as no-op; keep it separate from host injection.
  Mouse Zone queries the current screen's live window and source offsets,
  including before View, without scanning priorities or consuming clicks.
  See `docs/mouse.md` for the bounded migration gate and source evidence.
- `lib/display/model/` contains the versioned snapshot codec, revisioned chip
  memory, static physical-screen bridge and bounded normal ILBM/ByteRun1 loader.
  `lib/display/reference/render.js` provides basic planar render/explainPixel.
  Generated modules embed CPU snapshot/reference helpers; `snapshotPlayfield`
  exports physical pixels only, with sprites still a separate presentation layer.
  See `docs/planar-display.md` for the implemented subset and remaining gates.
- `lib/display/reference/sprites.js` resolves eight physical channels, attached
  pairs and playfield priorities. `snapshotDisplay` publishes direct AMOS sprite
  rows, including low-four-plane attached pairs from 4–6-plane images (odd numbers consume a blank
  channel before the next even pair); `snapshotPlayfield` remains sprite-free.
  Bounded DMA/reuse/manual registers
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
  from `presentation/layout.js`. Bounded live host switching/input is implemented; arbitrary viewport/letterbox
  input routing, HAM/events and full mode/capture parity remain open. Never count a CPU fallback as GPU execution.
- The live `wonderland-game` scenario embeds the entire original program/assets.
  Its finite input-only replay spends three lives through natural collisions and
  fades, restarts twice, returns to title and starts a fresh game. No variable/IP
  edits; injected gamepad/CPU-GPU evidence is not an Amiga capture. See
  `docs/wonderland-game.md`. The optional `browserAudio.js` session owns gesture
  activation, mute, context closure and replaceable program bindings. Drop muted
  effects; never replay queued sounds or let stale bindings stop a new program.
  Editor requester/writeback remains unintegrated; surface errors and require Restart.
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

Bare Cline clears the full current 8x8 text row in paper colour without moving
the cursor. Use existing drawing/Autoback/Bob hooks; counted Cline and general
text controls/windows remain gated. See docs/cline.md for the independent
portable-font/rainbow expectations and original game-load scope.
