# Integrated Amiga display architecture

Status: design, not an implemented WebGL backend. This integrates the
[Amiga/WebGL proposal](amiga-webgl-display-plan.md) into the existing compiler and
[display contract](display.md). PLAN.md tracks delivery; the proposal supplies
the P0–P12 feature and acceptance catalogue. Repository-specific contracts below
resolve its schematic interfaces before implementation.

## Existing system and ownership

Keep Buffer → TokenReader → Parser → Lowerer → Transpiler and the instruction
driver. Display acceleration does not change expression semantics or codegen
control flow. AMOS commands continue to call shared runtime operations.

| Current component | Responsibility during migration | Target responsibility |
| --- | --- | --- |
| `lib/amos/display.js` | Indexed logical/physical buffers, palette, drawing/text, screen lifecycle | Stable AMOS display facade over planar storage and the frame builder |
| `lib/amos/operations.js` | Banks, saved-background Bobs, pending/presented direct sprites | CPU drawing/object semantics; publish structured sprite state |
| `lib/amos/driver.js` | Cooperative ticks, waits, fake clocks, stop/resume, object-update flush | Publish display revisions after semantic updates; retain language-clock ownership |
| `lib/amos/browser.js` | Canvas 2D adapter, focus/input, render coalescing | Shared host/input lifecycle with selectable CPU/WebGL presentation |
| BankReader/BankWriter | File formats and per-instance decoded assets | Keep format contracts; maintain/invalidate display-visible planar asset allocations |
| `lib/Transpiler.js` | Standalone factory with embedded CPU runtime | Embed required CPU model/reference helpers; keep WebGL browser resources in the host |

Direct 16-pixel, 1/2-plane AMOS sprites retain pending/presented state and
hardware-coordinate helpers. The manager publishes structured physical rows;
Canvas and the CPU reference share the same priority resolver. The opaque
`setCompositor` RGBA callback has been retired. Bounded DMA/reuse/manual-register
decoding also emits those rows. Computed/attached AMOS allocation and exact
DMA/shifter timing remain open; see [sprite contract](sprite-display.md).

The existing indexed renderer is a migration regression oracle for its supported
subset. It is not the proposed hardware reference renderer, nor proof of Amiga
accuracy. Preserve independent source/emulator evidence separately from CPU/GPU
parity.

## One rendering boundary

```text
AMOS operations / CPU drawing / bank and object managers
                       │
        display storage + AMOS copper builder
                       │
       bounded copper interpreter + sprite line builder
                       │
          immutable DisplaySnapshot: chip + FrameState
                       │
          ┌────────────┴────────────┐
     JS reference              WebGL2
     decode/resolve           decode/resolve
          └────────────┬────────────┘
            explicit field composition
                       │
           scale/aspect presentation + input transform
```

The AMOS builder synthesizes copper for ordinary screen/palette/rainbow state.
User copper lists enter the same bounded interpreter. Pointer advancement, signed
modulos and register-write ordering are resolved there, not independently in each
renderer. The shared copper path now drives `snapshotDisplay`/`renderDisplay`
for representable OCS screen stacks; see [the implemented subset](copper-display.md).
The static-frame helper remains for full-bitmap migration/debug exports and IFF
fixtures, rather than becoming a second hardware scheduling implementation.

Both renderers take the same frozen snapshot and produce canonical RGBA bytes.
They never mutate chip RAM, advance the VM, update Bobs/sprites, consume input or
read live screen objects. `explainPixel` takes that same snapshot. Debug diff mode
renders the same revision twice without running the program twice.

## Pixel storage migration

1. Keep indexed arrays authoritative initially. Pack the **physical** array into
   planar mirror allocations for a static frame. Logical-only drawing remains
   invisible until Screen Swap. Palette changes need no bitplane repack.
2. Give each logical/physical buffer an identity and revision. Track dirty ranges
   per buffer; a shared single buffer has one allocation, while Double Buffer
   creates another. Swap exchanges references, not just texture names.
3. After reference parity, move drawing/text, paste and Bob capture/restore onto
   CPU planar helpers. Planar chip bytes then become authoritative. Indexed views
   become derived compatibility/readback views; retire the mirror writer.

There must never be two writable sources of truth. The initial bridge must detect
or fully repack exposed-array writes until a tracked-write API replaces them.
The final API must either synchronize compatible pixel views or explicitly retire
direct mutation; it cannot silently accept writes that the renderer misses.

Use word-aligned plane rows (`ceil(width/16)*2` bytes), keeping logical width
unchanged and clearing padding bits. Existing small/non-word-width screens must
remain valid. Bob backgrounds retain buffer identity, plane selection, minterm,
mask, clipping and Autoback behavior from [buffering.md](buffering.md). Bobs and
pastes write CPU storage; hardware sprites compose over it and never alter Point.
Keep collisions and Save on CPU state, independent of renderer availability.

Allocate display-visible planes and sprite/image data in the modeled address
space. Generic fast/work banks do not all become chip RAM simply because they
exist. Preserve bank object/image identity, mask/orientation rules and Save's live
normalization; invalidate corresponding planar caches on image/bank changes.
Configured chip capacity and source-located allocation errors are explicit;
the current chip/fast metadata is not a full Amiga allocator.

## Snapshot and coordinate contract

ABI v1 and the fixture/diff harness are implemented in
[the snapshot contract](display-snapshots.md). Typed notation in the proposal does
not require TypeScript or a new test runner. The snapshot header records:

- schema version, display profile/chipset, revision and immutable chip bytes;
- native output width/height, field line count, field parity or null, video rate,
  hardware-to-output origin and rational pixel-aspect metadata;
- line register/palette/sprite/event arrays, their strides and exact lengths;
- any exact event-overflow representation and explicit previous-field fixture
  data when testing woven output.

Arrays must be owned copies or otherwise immutable for their entire render/diff
lifetime. Serialize numeric tables with declared byte order, bounds and hashes;
chip bytes retain big-endian Amiga word layout. Reject malformed/truncated blobs,
invalid pointer ranges, inconsistent field dimensions and unsupported versions.

Use an integer native sampling grid: normally 640 samples across a 320-lowres-pixel
OCS window, and 1280 for ECS superhires or AGA profiles. Lo/hi/shres pixels occupy
an integer number of samples in the chosen profile. A 640-wide raster cannot
represent ECS superhires pixel-exactly. Overscan/cropped dimensions remain explicit.
Define non-interlaced field lines separately from woven output height; do not
double a 512-line output a second time.

Pixel-aspect metadata applies to the native sampling grid, with field/woven
height accounted for; do not apply a lowres source-pixel ratio unchanged to a
hires sampling grid.

Normalize display-window bounds, sprite starts and event x positions to **native
output sample units** on the CPU. Signed positions allow left-edge clipping.
Fetch offsets and scroll delays are decoded into source-pixel units separately.
Keep AMOS hardware coordinates, source pixels, native samples and CSS/device
pixels distinct, with named transforms rather than implicit scale factors.
Test word arithmetic in X/Y Hard/Screen independently from host scaling.

For the proposed sprite table, store signed hstart bits in `r`; use an active bit
in flags, not `0xffffffff` as the inactive x sentinel, since x=-1 is a legitimate
edge position. The AMOS manager owns logical/computed-to-eight-channel allocation;
FrameState carries physical per-line results, including reuse and attachments.
Renderers do not allocate channels or reinterpret AMOS object IDs.

Public pixel output is top-left-origin, row-major RGBA bytes with stride
`width*4`, exposed as Uint8ClampedArray. Internal Uint32 packing must not leak host
endianness. Normalize GPU readback origin, alpha and colour conversion before
zero-tolerance comparisons. Compare native output before aspect/CRT/CSS effects.

## Timing, fields and event limits

Keep render requests separate from language time. Initially snapshot after the
driver's existing automatic Bob/sprite flush; retain synchronous Screen Swap and
cooperative update behavior. requestAnimationFrame presents the latest committed
revision and never executes AMOS or advances a field on its own.

Introduce the actual PAL/NTSC field clock as a separately tested timing change,
using injected `now`/timers and the existing vblHz contract. Budget exhaustion,
pause/resume, sleeping, input and Stop must keep their documented behavior.
50/60/120/144 Hz browser refresh must not change game speed. Distinguish rAF frame
repeat from a new emulated field, even when display bytes did not change.

Reference field rendering stays pure. Weaving takes explicit previous output plus
the new field and parity in a separate composer owned by the display instance.
GPU FBO history is a cache of that state, not its sole owner. Field fixtures and
context restoration must preserve the other field without hidden renderer state.
CPU ownership can retain both field snapshots for reconstruction, without
requiring a full CPU render on every GPU frame.

Mid-line palette events affect resolution; scroll/mode events affect **decode**
as well. HAM state advances in source-pixel order, with palette lookups at the
originating set pixel, independent of repeated presentation samples. Apply
sprites where the video profile permits even outside the bitplane window; do not
let a playfield-border early return discard sprite output.

The 32-event GPU table is a fast-path capacity, not permission to drop writes.
Retain ordered events in the CPU snapshot. Overflow uses exact segment boundaries
and required palette/register state, or selects the CPU reference for that frame.
A fixed 40-segment palette is usable only when it represents every event exactly;
it cannot quantize arbitrary positions or represent scroll changes by itself.
Parity tests report whether GPU or fallback actually ran. Bound copper steps,
jumps, memory accesses and total event storage; reject resource-limit overflow
with context rather than hanging. Validate proposed fetch/timing formulas and
visible register support against hardware references and captured scenes.
The final M9 overflow gate requires actual GPU parity through exact segments;
transitional CPU fallback does not satisfy it.

## Browser host and failure lifecycle

Keep `createCanvasHost(canvas)` as the existing 2D entry. Plan a separate
`createDisplayHost(container, { renderer: 'auto' | 'reference' | 'webgl2' })` which
owns presentation surfaces and a stable focus/input element. This is a proposed
API, not a currently accepted option.

Use separate 2D and WebGL canvases for switching/fallback: an HTML canvas's context
mode cannot be changed from WebGL to 2D by a later getContext call. See the
[canvas context rules](https://html.spec.whatwg.org/multipage/canvas.html#dom-canvas-getcontext).
Creation failure selects CPU; context loss switches to CPU without restarting the
program. Restore textures, programs, FBOs and field history from CPU-owned state,
then resume GPU presentation only after a complete upload. Keep input and timers
running according to VM state throughout. Detach cancels rAF/listeners and releases
GPU resources; replacing programs releases their allocations/history. Stop pauses
execution, while detach/dispose own host resource destruction.

Map pointer positions through the content rectangle, letterboxing, integer/aspect
scale, native raster and screen/hardware transforms. Preserve the existing local
setMouse injection contract during the bridge. AMOS hardware mouse query semantics
need a separate explicit migration/test gate before multi-screen hardware mode;
backend switching alone must never change query results. Restore the previous
cursor when detaching, preserving Hide On/Show On behavior.

WebGL2 setup follows the [Khronos specification](https://registry.khronos.org/webgl/specs/latest/2.0/):
check texture/FBO limits, use integer addressing and nearest-filtered integer
textures, disable unintended blending/dithering in exact passes, and test actual
readback. Dirty ranges are revisioned; each renderer tracks its own upload revision.
One consumer cannot clear dirty state needed by another. New/lost contexts and
stale upload histories require full upload. Performance targets remain targets
until measured; SwiftShader parity is not phone/laptop performance evidence.

## Repository layout and delivery gates

Use JavaScript/CommonJS-compatible CPU helpers under `lib/display/`:
`model/` (ChipMemory, schema, registers), `copper/` (builder/interpreter),
`reference/` (decode/resolve/sprites/explain), `presentation/` (field composition),
and `webgl/` (context/textures/shaders). `lib/amos/display.js` remains the facade.
Use `test/*.test.js`, `test/fixtures/display/` and the existing Playwright tooling.
Do not migrate the compiler to TypeScript/Vitest as a prerequisite. Headless output
keeps working without DOM/WebGL; browser GPU code stays host-owned and instance-local.

| Gate | Proposal phases | Work and acceptance |
| --- | --- | --- |
| D0: baseline and ABI | P0 | Baseline restored; ABI v1 codec, hashed fixture loader, byte diff/PNG artifacts and independent planar/PNG fixtures implemented. 328 tests pass locally. Chromium covers sprite/input, actual WebGL2 readback, native planar/copper pixels and PNG decode. Hosted CI remains unobserved. |
| D1: CPU bridge | P1 + early P11 | Implemented: ChipMemory/dirty queries, planar reference/explainPixel, bounded ILBM/ByteRun1 and standalone physical playfield export, now including EHB. Text/images/Bobs/Autoback, padding and logical/physical comparisons pass. See [planar contract](planar-display.md); physical sprites remain outside this bridge. |
| D2: copper and screens | P2–P3 + P11 | OCS interpreter/stack builder, EHB screens, static scroll/DPF, laced IFF fields and explicit composition implemented. General AMOS positioning/offset/rainbow/copper commands, superhires and live field/input timing remain. M2/M3 capture gates remain open; see [mode contract](display-modes.md). |
| D3: hardware reference | P4–P5 + P11 | HAM6 CPU/ILBM/Canvas path implemented with independent synthetic goldens (see [contract](ham-display.md)); eight-channel reference composition, attached pairs, priority matrices and direct AMOS snapshot export now pass local synthetic tests (see [sprite contract](sprite-display.md)). Bounded DMA/reuse/manual registers are implemented. Canvas now shares structured rows and the resolver. DMA contention/latch timing and computed allocation remain open. Retain M4/M5 fixtures/captures. |
| D4: GPU path | P6–P9 | Integer/table texture infrastructure, exact shader readback, dirty-row uploads and context loss/restore/disposal pass locally; see [resource contract](webgl-resources.md). Non-HAM decode/resolve now passes 151 local GPU/CPU frames, including 100 seeded inputs; see [renderer contract](webgl-renderer.md). Scaling, switching/live diff, full mode/capture coverage and HAM/event parity remain open. No silent fallback counted as GPU parity. |
| D5: canonical storage | P11 | Move drawing, Bob saved backgrounds and display-visible assets to authoritative planes; compare to bridge, then remove duplicate writable pixel storage. Keep CLI/bank serialization/collision behavior. |
| D6: release/performance | P12 + M11 | Captured command suites, 60-second real-game replay with zero native mismatches, measured CPU/GPU budgets and ten-minute refresh-rate pacing. Workers/CRT and optional P10 AGA follow their own gates. |

All detailed M0–M12 acceptance cases remain required for their corresponding
features; this mapping does not replace them with easier existing tests. External
emulator captures stay an evidence gate, not a reason to stop independent work.
AGA is an explicit optional expansion after OCS/ECS. WebGL delivery does not erase
the broader PLAN.md requirements for numeric fidelity, audio or the ASCII frontend.

Baseline restoration regenerated all three demos; `npm run check` now passes
328 tests. `npm run test:browser` covers native planar/copper exports, direct-sprite/cursor checks and a WebGL2
SwiftShader probe exercising R8UI memory, uint address arithmetic, RGBA8UI
framebuffer output and normalized readback. GPU resource tests also verify all
ABI textures, dirty uploads and real loss/restore/disposal. This establishes infrastructure,
not a hardware capture or target-device performance result. The separate
[non-HAM renderer](webgl-renderer.md) now establishes actual GPU parity for the
implemented fixture subset, without closing unfinished mode/capture gates.
