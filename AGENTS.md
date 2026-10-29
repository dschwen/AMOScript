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
- Polygon ($0eba) supports explicit 3..16 signed-word pairs with
  validated closure capacity, portable even/odd interiors and a solid inclusive
  boundary. InPolygon bypasses GfxFunc: keep logical-only writes, no Bob/Autoback
  replay and unchanged cursor/line phase. Original KugelanimBerech.Bak completes
  eight IFFs; native AreaEnd edge parity remains unverified. See docs/polygon.md.
- Set Line stores a per-screen low-word mask and preserves a separate portable
  phase counter. Patterned Draw/Draw To/Box use bounded signed-word endpoints,
  MSB-first steps and opaque Ink background; default solid clipping stays intact.
  Box follows the original PolyDraw traversal. Rewind phase for Autoback replay
  and preflight patterned geometry before Bob hooks. Original 333/354/356 run
  on a declared blank/palette preview, with prepared cell Input# replacing 355.
  Three independent Canvas/GPU frames cover it, not full editor/native capture.
  See `docs/set-line.md`; general graphics draw modes remain gated.
- Edit emits a terminal control and frozen `state.editRequest` source metadata.
  Halt/cleanup audio, palette wakes and held input before optionally calling
  synchronous `system.command('Edit', request)` once. No adapter is required and
  no editor UI is implied. Consume before notification; host failure/reentry must
  not repeat it or run old cleanup after a replacement VM starts. Retain final
  state/frame for inspection; Resume cannot continue it. Original ROUNDTURN runs
  with PHALT/BEWEG stubs/guards in six cases, twelve Canvas/four GPU frames. See
  `docs/edit.md`; source-editor UI and native teardown/captures remain open.
- Swap exchanges same-type integer/float/string scalars/elements. Keep its AST
  pure, capture and validate both lvalues left-to-right, retain array objects/
  linear offsets and local owners. Check array existence/rank before callbacks
  and each subscript before the next. Then read current values and store second
  then first. No promotion/re-rounding or partial stores on lookup failure.
  Original high-score insertion/sorting matches five independent paired orders
  and fifteen Canvas images/three GPU frames in a declared Print Using preview.
  Entry UI, scoresave and menu return remain open; see `docs/swap.md`.
  Swap is $00a6 at 1073; Edit $0670 at 956 now uses the terminal host boundary.
- Rainbow Del removes slot 0–3 or all tables for any negative selector/bare form;
  absent valid slots are no-ops. Keep other slots, immutable snapshots, indexed
  pixels, selection/View and running palette jobs intact. Recreated slots are
  fresh. Original 557 runs through a declared HOPSCREEN Wait Key guard; three
  independent Canvas/GPU images cover overlap fallback and base-palette restore.
  Bounce/editor return and native timing remain open; see `docs/rainbow-del.md`.
- Get Icon captures current/explicit logical bitmap regions with exclusive bounds,
  word-rounded widths, zero right padding and new unmasked/zero-hotspot records.
  Keep existing palettes/other records; new banks use the selected screen palette.
  Preflight before mutation, retire icon-bank raw addresses on successful capture,
  and avoid drawing/Autoback/Bob hooks. Original missing-level 480 and overwrite
  490–491 run on prepared stripes with WTIN/WTREL guards and declared overwrite
  restoration. Six independent Canvas/GPU frames cover them, not full requesters
  or editor persistence. See `docs/get-icon.md` for bounds and source evidence.
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
- Sqr ($0768) promotes numeric arguments to float and uses a source-derived
  restoring FFP mantissa recurrence; negative inputs reject before assignment.
  Keep static/DATA, Val and typed storage consistent. The unchanged pinned Kugel
  source now compiles but produces colour -1 at line 14, byte 520 after 240132
  instructions. Preserve that source error and strict Plot checks; its partial
  sphere/demo is not completed execution or a native capture. See docs/sqr.md.
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
  Its end tunes are AMOS Music banks, not MODs. The owned Music-bank decoder and
  direct field player now cover both tunes with independent full first-wrap
  PAL/NTSC traces and 25 native Web Audio comparisons. Music/Mvolume/Music Off
  now run in the VM with separate driver wakes, checked bank retirement/write
  guards, shared reserved voices, master fade and Stop/Resume. Stacked songs and
  Music/Tracker/sample voice stealing reject. The complete unchanged Roller II
  source compiles; end-state graphics/full gameplay remain open. See
  `docs/amos-music.md`. Never count a pattern inspector or loop flag as tracker playback.
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
  Save Iff ($0afc) embeds a pure ILBM writer with default ByteRun1 compression,
  zero-padded planar rows and current palette/mode/AMSC metadata. Validate/encode
  completely before one synchronous files.write with the retained resolved name.
  No drawing/Bob/Autoback hooks; double buffers/clones and $0b0c remain gated.
  Original KugelanimBerech saves rollerball after its key prompt; independent
  decoding/reload and exact Debug exports pass. See docs/save-iff.md.
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
- Screen Display/Screen Offset manage bounded windows; equal-width lowres overlaps
  use priority slices even without an explicit Screen To Front. Original DIW
  geometry survives late background resumes; direct sprites require their changed
  palette registers before setup-row capture. The original Roller II editor entry,
  tile placement, panel selection and level-test/return have ten Canvas/GPU checks.
  Committed windows clip at nonlaced PAL/NTSC end 310/260, preserving parked
  geometry and checked bitmap ranges. Share the clipped crop with pointer input;
  late first slices enable DMA at their real start, and setup-only slices fetch
  no pixels. All-off-field windows use a zero-bitplane backdrop snapshot. Wider actions
  and persistence remain open. View commits
  geometry and source offsets; Canvas renders the same physical copper snapshot.
  Full bitmap storage remains authoritative. Setup can span real blank rows,
  with each chunk completed before fetch. See `docs/screen-windows.md`; general
  placement/priority, wrapped DMA and HAM fine scroll remain open.
- Two-operand Screen Copy resolves Logic/Physic integer selectors at execution
  and copies common bitmap planes without swapping identities or invoking
  Autoback/Bob hooks. Saved Bob backgrounds retain their existing owners. See
  `docs/screen-copy.md`; explicit minterms and exact DMA timing remain open.
- Zoom ($10d6) uses ten numeric operands, exclusive in-bitmap rectangles and
  ZooTab reduction/enlargement sampling. Resolve source then destination;
  preserve raw common planes and column/plane/row live alias feedback, bypassing
  Bob/Autoback hooks. Validate geometry/table bounds before writes. The unchanged
  RollerIIIntroIdee source and R.abk match independent icons/all 29 frames and
  complete the final key prompt; four Canvas/GPU comparisons pass. See docs/zoom.md.
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
- The live `roller2-game` scenario embeds the complete unchanged source and the
  current supplied asset manifest under `examples/Roller2/current`. The playable
  AMOS file has source-level edge-guard ordering fixes on lines 642/645 and a final
  help-page offset fix on 1129 (subtract 48 for entries 49–52); preserve
  the original frozen source and keep compiler/bank checks unchanged. Changed assets
  and restored score/bounce images are pinned there; unchanged files share older
  bytes. Keep the older manifest frozen for bounded fixtures. Current input/host
  replay follows six first-level collectibles/warp into level 3, Timer expiry,
  game-over image/Music, restored scores, menu/MOD reload and a fresh game. No VM
  variable/IP/bank edits. Level-3 time-bonus pickup and repeated bottom-edge bump
  now pass through the corrected AMOS source. Thirty Canvas frames, six independent
  image regions and fifteen GPU comparisons pass. The old replay retains its historical missing-
  file error; it is no longer a current-demo blocker. Session writes survive only
  Restart; shipped-score qualification, editor persistence/win/completion and native captures
  remain open. See `docs/roller2-game.md`.
- The live `wonderland-game` scenario embeds the entire original program/assets.
  Its finite input-only replay spends three lives through natural collisions and
  fades, restarts twice, returns to title and starts a fresh game. No variable/IP
  edits; injected gamepad/CPU-GPU evidence is not an Amiga capture. See
  `docs/wonderland-game.md`. The optional `browserAudio.js` session owns gesture
  activation, mute, context closure and replaceable program bindings. Drop muted
  effects; never replay queued sounds or let stale bindings stop a new program.
  Editor requester/writeback remains unintegrated; surface errors and require Restart.
- Full-game pages launch directly through a prominent Play Game button; browser
  checks/captured frames stay in a collapsed section. The live-only evaluator path
  must reach audio/fullscreen requests before its first await. Roller II stays on
  its original intro and Wonderland on its original menu, with no injected input
  or input-profile overrides in either launcher; repeat Play retains the VM.
  Keep Stop/Restart/disposal and fullscreen focus cleanup covered in both demos.
- Default font bytes now include pinned public-domain Latin-1 rows 160–255;
  Print/Writing/Text share that coverage, retaining ASCII pixels and `?` fallback
  for C1/unsupported characters. This is portable font evidence, not Topaz.
- `browser.js` optionally owns a virtualJoystick cross in a stable fullscreen
  container. Merge raw touch/keyboard/Gamepad masks before cancelling opposites;
  never synthesize AMOS text/raw keys/mouse clicks for touch. Preserve independent
  pointers and clear holds/listeners on cancellation, blur, Stop, exit and detach.
  Key Speed preserves holds. Auto is for coarse/touch devices in owned fullscreen;
  explicit visibility/inline options belong to the host, not the compiler.
- `tools/build_game_page.js` builds a standalone user page from AMOS plus optional
  asset JSON (paths relative to the manifest, optional prefix/size/hash checks).
  Keep reads synchronous and preloaded, session writes honest, and output exclusive.
  `--debug` opts into a shared Debug menu with new/modified session-file downloads
  and bounded source error logs; normal pages keep compact icon controls and errors.
  Download byte strings through Uint8Array/Blob, filter against the initial snapshot,
  and revoke owned URLs on refresh/disposal/page exit.
  `gamePageRuntime.js` is the editable sample harness. See
  `docs/game-webpage-tutorial.md`; its generated sample is a gallery/browser test.
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

Rectangular Screen Copy `$09a8` has eight numeric operands and exclusive source
ends. Pair source/destination clipping as native Sco0, snapshot overlap sources,
copy common low planes and preserve raw logical/physical/Bob ownership. Signed
word geometry is bounded; wrapped clipping and explicit minterms remain gated.
The pinned original Tunneltest now uses its supplied external icon bank and
original IFF background; 48 independent frame hashes and five GPU frames
cover it. IFF uploads finish before VM execution. See docs/screen-copy.md.
Keep the README concise and the gallery games/showcases prominent. All technical
browser demos retain HTML Preview links inside the closed-by-default checks group.

Roller II full-game hosts map fire to ControlLeft/ControlRight, preserving Enter
for high-score text and Space for pause. Browser modifier filtering permits only
explicitly configured Ctrl joystick chords; unmapped Ctrl and Alt/Meta shortcuts
must not leak text or retain owned holds. Keep the zero-score-table full-source
high-score entry/writeback replay distinct from an unmodified saved-score capture.

- Frame Load ($25e0) reads a checked ANIM prefix from an Open In cursor into a
  managed temporary fast `Iff     ` bank; raw nested forms end with AenD. Frame
  Play ($25ec) returns checked continuation addresses and patches the selected
  logical bitmap without private timing/history repair or Bob/Autoback hooks.
  Preserve caller buffer initialization/swaps/waits. All twenty KugelAnim frames
  match independent Python hashes; both unchanged Logoanim sources finish with
  pointer input and 16 GPU comparisons. Raw writes/shrink, restored-bank playback,
  other operations/overloads and native captures remain gated. See docs/anim5.md.
  Load Iff treats transparent-colour metadata opaquely; actual mask planes remain
  gated. ILBM DRNG flags exactly zero retain frozen validated metadata with no
  palette job; active/reserved flags reject.

- The ANIM-5 demo features a live original-program player before collapsed test
  captures. tools/anim5Player.js owns real timers, Canvas/WebGL input/presentation,
  source-version selection, pause/resume, restart and fullscreen; page exit retires
  its timers/VM/GPU. No fake clock or startup input belongs in this live path.

- Open Port ($18de) uses channels 1–10 and an explicit synchronous ports.open
  adapter returning write/close handles. Device names bypass Dir$ and files;
  Print # emits byte strings immediately with TAB/CRLF separators. Guard callback
  reentry and consume handles before Close callbacks. End/Edit/failure close owned
  ports; Stop preserves them for Resume, and hosts dispose paused VMs with
  closePorts(). lib/amos/ports.js captures output-only PAR: with checked bounds.
  Three unchanged printer programs match 5,661 independently transcribed bytes;
  the open-port demo exports exact Uint8Array/Blob downloads with URL cleanup.
  Uncached untyped identifiers followed by bracketed statement arguments normalize
  to checked ordinary procedure calls. Input, Port(), SER:/PRT:, physical printing
  and PCL interpretation remain gated. See docs/open-port.md.

- Signed Screen Display supports Y -4095..28671 with nonwrapping biased ends.
  Commit clipped raster [26,310) PAL / [26,260) NTSC geometry together with
  pointer mapping; advance planar source pointers without altering bitmap/window
  identity. Early-ending/top-cropped windows use explicit copper DMA starts/stops,
  and following normal windows re-enable DMA. Preserve setup rows/budgets, strict
  full bitmap ranges and off-field no-fetch snapshots. Both unchanged RolIntrIdee2
  sources complete: 200 independent frames, 28 GPU/pointer comparisons and live
  version-selectable playback with optional owned sample sound. Activate sound
  before the first VM tick; dispose VM/timers/GPU/audio on replacement/page exit.
  Wider wraps/clamps/native captures remain gated. See docs/screen-slide.md.

- Planet Zybex is the next full-game showcase target. Keep its unchanged source,
  seven level banks and hashes in examples/PlanetZybex. Current planet-zybex demo
  is explicitly a background preview: original Load/Unpack excerpts plus guards,
  not the full game. No AMAL stubs or injected VM/asset edits may stand in for
  gameplay. Track startup, AMAL/manual update, wide/computed sprites and full
  progression in docs/planet-zybex.md; retain Roller II/Wonderland regressions.
- Slot-2 Unpack To ($0056) decodes a checked full SCCode/BMCode screen from a
  generic bank. Own input; bound byte/flag/pointer streams and decode completely
  before normal screen replacement, metadata and palette installation. Retain
  bank identity/addresses and clone/Auto View contracts. Other overloads/modes,
  partial rectangles and raw addresses remain gated. Seven worlds/35 independent
  windows and actual GPU comparisons are covered. See docs/packed-pictures.md.
- Amreg ($1fa2) globals RA–RZ are per-factory signed WORDS, not longs. Store low
  words and sign-extend integer queries. Reuse this storage for the future AMAL
  interpreter. Original clear_amal passes a declared register fixture; channel
  overloads and program execution remain gated. See docs/amreg.md.
- The complete unchanged `examples/BobTest/BobTest.amos` now runs its 64 Bobs and
  500 movement frames in the live `bob-test` showcase. It uses IDs 1–64, so this
  host passes `maxBobs:65`; the per-factory default remains 64, bounded to 1–256.
  Circle is a bounded lowres solid portable midpoint outline; Paint is the
  two-argument seed-colour fill with the seed retained before Bob/Autoback hooks.
  Get Bob captures exclusive logical rectangles into transparent bank-1 records
  through the shared Get Icon capture path. All 32,064 positions, three generated
  images, five independent composites, restored background and eight Canvas/GPU
  frames pass. Source busy-loop timing and native circle raster parity remain
  open; see `docs/bob-test.md`. Keep both original key prompts in the live host.
- At ($13c6) returns pure ESC-X/Y byte strings with optional 0..207 coordinates
  and EntNul omissions. Its string type must survive storage/DATA/procedure calls;
  only the window writer consumes controls. Keep partial escapes per screen and
  replay Autoback from the original cursor/escape state. Print comma tabs predict
  cursor changes without drawing or replaying expressions. Other window escape
  commands remain gated. Planet Zybex's declared score fixture adds original
  hires strip/lowres playfield setup and both score statements to its preview;
  four independent PAL/NTSC Canvas/GPU frames pass, 39 GPU frames total.
  Separate hires strips may accompany aligned equal-hardware-width lowres
  priority slices with shared COLOR00; overlaps retain lowres restrictions and real
  setup rows/budgets. No AMAL/manual-update or gameplay claim; see docs/at-text.md.
- Default ($0cee) restores the pinned shipped 320x200/16-colour interpreter
  profile, retires all screens/clones/committed windows, Bobs, rainbows and old
  palette jobs; Auto View/Break become on and automatic Bob/Sprite UPDATE off.
  Logical Sprite coordinates survive with image zero. Clear 26 AMAL words; show
  built-in mouse 1, installing native default limits only for unset/zero minima.
  Start the shipped 16-step colour-3 flash. MusDef stops owned Music/Tracker/
  samples, loops and wakes, restores bank 5/volume 56, regenerates portable noise
  from retained seed/phase and preserves LED/filter. Keep banks/addresses, files,
  directory, variables/scopes/DATA, Timer, random and held/queued input intact.
  Default reentry rejects; host errors retain source context and cancel wakes.
  Original Zybex 90–92 now run with declared key guards in the preview, stopping
  before Set Sprite Buffer 93. 41 Zybex GPU comparisons plus close/clear checks;
  computed buffers, custom preferences and native teardown/timing remain open.
  See docs/default.md. Factories without Default retain existing Screen Open/startup defaults; after
  Default, subsequent Screen Open inherits the restored native DefPal.
- Set Sprite Buffer ($1986) owns three native-format direct-sprite stream buffers
  in lib/amos/spriteBuffer.js, embedded in standalone factories. For 16..4094,
  allocate (n+2)*96 bytes before replacing state; equal stored size is a no-op.
  Resize clears logical image assignments/presentation, preserves x/y and shape,
  and shows the pointer. Default restores n=128; factory HsInit starts at 128
  stored rows. Sprite Update rotates physical/logical/intermediate slots, and the
  structured writer consumes actual POS/CTL/DATA/DATB words. Preserve low-four-
  plane attachment, odd-channel consumption, frozen records and pointer ownership.
  Native HsDm height+1 >= (storedRows-2) ignores a new image, retaining prior output.
  CPU-owned stream bytes are separate from bank/chip addresses; no fake Start or
  RGBA overlay. Computed/wide sprites, wrapped/OOM fallback and exact DMA timing
  remain gated. Original Zybex 90–93 now runs; full source stops at Amal Off 179.
  Ten matrix GPU frames bring Zybex to 51; see docs/sprite-buffer.md.
- Gr Writing ($1066) supports per-screen modes 0/JAM1 and 1/JAM2. Text zero bits
  and line-pattern holes preserve pixels in JAM1, use graphics BPen in JAM2.
  Track initial BPen separately from window Paper; explicit Ink background updates
  both graphics paths. Preserve legacy defaults until explicit Gr Writing, retain
  Print/Writing and solid primitives, and reject other modes before mutation.
  Keep indexed writes inside existing Bob/Autoback hooks and line preflight/phase.
  Original Zybex 189–199 runs on a declared blank screen with opaque/restoration
  comparisons; six PAL/NTSC Canvas/GPU frames bring Zybex to 57. Full source still
  stops at Amal Off 179; nine encodings remain. See docs/gr-writing.md for native
  mode/cursor/font/raster gates and the fixture's omitted finish-message paths.
- Channel ($1f94) stores per-factory native type/number selectors, initially
  channel n -> Sprite n for all 64 pairs. Support Bob/Sprite numbers 0..63,
  independent of object/image/screen existence and configured Bob count. Validate
  channel before evaluating target once via a compiler thunk; write only after
  both bounds pass. Do not create/move/render objects or schedule AMAL. Default
  restores identity routes; Stop/Resume retains them. channelBinding returns a
  frozen independent snapshot. Future AMAL installation must capture/resolve the
  pair, not retarget active programs through this table. All 27 original Zybex
  statements compile; declared original enemy/player/bullet loops check 192 routes
  while preserving independent world pixels. 58 Zybex GPU comparisons; eight
  encodings remain, full source still stops at Amal Off 179. See docs/channels.md
  for omitted AMAL/manual update behavior and unsupported target forms.
- Manual AMAL in lib/amos/amal.js owns immutable parsed strings and ten local
  words per installed program, sharing existing Amreg globals. Synchro Off is
  required; automatic installation rejects. Support Let/X/Y/A/registers,
  left-to-right word operators, checked initial labels, ten-jump yields,
  Pause/End, Move's native 8.8 slopes/half-pixel fractions and XS/YS/XH/YH.
  Compile before retiring an old program; resolve the captured Channel target
  after retirement. Preserve Bob/Sprite identity across ordinary statements;
  rebindings do not retarget installed programs. On enables; Off deletes.
  Synchro changes intent only; Update Off disables both automatic publications,
  Update restores/draws/swaps Bobs then publishes Sprites. No AMAL timer or RAF
  stepping. Object/screen retirement and resized Sprite pools remove owned
  programs; Default resets manual mode, main End/Edit/failure clears programs,
  Stop/Resume retains their state. Snapshot records are frozen independent copies.
  The complete unchanged Zybex source now compiles (1122 instructions, zero unknown
  encodings) and reaches unsupported Autotest at line 276, byte 11614, character
  11. Its separate unchanged Bob 21 program runs with prepared trigger inputs,
  a declared thirteen-pass loop and original manual housekeeping on level-1
  background. Twenty-eight independent PAL/NTSC frames/ten GPU comparisons bring
  Zybex to 68. See docs/amal.md for unsupported grammar/automatic/computed-sprite,
  source bounds, native timing/capture and connected-gameplay gates.
- AMAL Autotest activates at its declaration, then runs before normal resumption
  with a separate twenty-jump quota. eXit/closing/quota preserve Move state;
  Direct resets movement and runs its main-mode destination in that same Synchro.
  End clears tests; AU() disables them. Labels share one initial namespace, with
  native main/Autotest mode checks; nested blocks, cross-mode Jump and misplaced
  Direct/eXit reject. For/Next uses matching local/global registers, evaluates both
  expressions before storing start, captures per-instruction bounds outside frozen
  IR, executes body first and yields only on repeats. Preserve signed wrap and
  zero bound cells on unentered For paths. BC reuses live Bob masks/owners and the
  shared collision table via unsigned-word selectors; no drawing/mask generation.
  Errors retain executing test/installation context once. The complete unchanged
  Zybex now passes the first two installs and gates at Z: line 307, byte 13240,
  character 135. Original 263–276 runs on a declared level-1 bitmap/eighty-pass
  loop, with optional stationary original-image bullet. 324 independent PAL/NTSC
  frames include collisions 6/70 and source +10 resets/delays; twenty GPU checks
  bring Zybex to 88. See docs/amal.md for omitted gameplay and remaining function,
  animation, automatic-sync, computed-sprite and native-capture boundaries.
