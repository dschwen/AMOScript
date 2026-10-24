# Copper interpreter and shared screen builder

Status: bounded OCS register/beam interpreter, a constrained screen-stack builder
and standalone display exports are implemented. The local fixtures below are
synthetic/source-derived. The M2 requirement for three emulator captures remains
open; this is not a cycle-accurate chip emulator or a complete D2 implementation.

## Display APIs

Generated factories and CommonJS displays now expose:

```js
const snapshot = program.display.snapshotDisplay();
const rgba = program.display.renderDisplay();
```

Both methods accept a screen number or an array of numbers, plus an optional
geometry object. They preserve screen selection, VM state, clocks and pending
object updates. Physical buffers are packed by the existing planar bridge, then
the common builder/interpreter produces the frame. This path includes text,
pastes, presented Bobs and the direct AMOS sprite manager's frozen physical
channels; see [sprite reference](sprite-display.md). The raw copper interpreter
now also decodes bounded sprite DMA streams and manual register writes. The
Canvas now shares the structured sprite writer and priority resolver; indexed
playfield storage remains the migration path.

For example, `snapshotDisplay([1, 2], { origin: { x: 128, y: 50 },
outputWidth: 640, lines: 200 })` exports a physical stack using the screens'
hardware positions. Without geometry overrides, the crop encloses the requested
views. Multiple views are sorted vertically; they must not overlap. Their native
sampling grid is shared, so lowres pixels occupy two samples and hires one.
Geometry can override `standard`, `origin`, `outputWidth`, `lines`, `videoRate`
and `pixelAspect`. `displayOptions.snapshotStandard` defaults to PAL.

`Screen Display`, `Screen Offset` and user-copper commands still need integration.
[Table-based AMOS rainbows](title-display.md) now schedule bounded per-row palette
MOVEs through this builder, including restoration and PAL wrap. Canvas uses the
same rainbow table selection. Auto View stages screen replacement; the default
snapshot and Canvas follow the presented screen. Exact VBL list timing remains open.

`snapshotPlayfield`/`renderPlayfield` remain the full-bitmap migration/debug path
from [the planar contract](planar-display.md), including virtual/odd/small screen
sizes that do not fit current OCS register windows. They do not pretend those
dimensions are physical scanout. The hardware builder rejects unrepresentable
windows; it does not silently crop/reinterpret the old API.

## Interpreter contract

[interpreter.js](../lib/display/copper/interpreter.js) exports
`interpret(chip, options) → { snapshot, diagnostics }`. It has a dependency-injected
factory for standalone embedding. `chip` is a complete 512 KiB/1 MiB/2 MiB byte
image; options.address is the initial COP1LC byte address. An optional 256-word
Uint16Array `initialRegisters` supplies CPU register state before beam execution.
Absent that table, master/copper/bitplane DMA are initially enabled and other
registers are zero. COP1LC is initialized from address; no VM or browser globals
are read. Inputs are copied for the returned ABI v1 snapshot.

The modeled register subset is shared through
[registers.js](../lib/display/model/registers.js): COP1LC/COP2LC, jump strobes,
DIWSTRT/STOP, DDFSTRT/STOP, DMACON, BPL pointers, BPLCON0/1/2, signed BPL1MOD/2MOD,
SPR0–7 pointer/POS/CTL/DATA/DATB registers, COLOR00–31 and NOOP.
Protected/unsupported MOVE destinations reject explicitly.
DMACON writes implement set/clear rather than replacing the register word.
Pointer register bit zero and modulo bit zero do not form address bits.

Instruction words are read big-endian from bounded/aligned chip addresses:

- MOVE and SKIP consume four colour clocks. SKIP conditionally skips one complete
  instruction without executing/validating its register destination.
- WAIT reads in four clocks, compares masked beam coordinates and uses two wake-up
  clocks. V7 is always compared; BFD controls the independent blitter-finished
  condition. `blitterBusyUntil` is an explicit elapsed-colour-clock input, default
  zero for the existing synchronous CPU drawing operations. No blitter engine is
  simulated by that input.
- COPJMP1/2 transfer the corresponding pointer to the instruction PC. The usual
  `$FFFF,$FFFE` terminator holds state through the rest of the field.
- The low eight vertical counter bits wrap at line 256. The standard
  `$FFDF,$FFFE` barrier followed by another WAIT passes that boundary; it is not
  relabeled as an absolute high-line instruction.

The beam model uses 312 PAL lines of 227 colour clocks, or 262 NTSC lines with
alternating 227/228 clocks. Rates default to nominal 50/60; interlace field counts
and exact broadcast pacing belong to the later field-clock gate. Ordinary
snapshots do not run a real-time clock or advance AMOS Wait Vbl.

The mask/cycle rules follow the Commodore
[Copper instruction description](https://www.amigadev.elowar.com/read/ADCD_2.1/Hardware_Manual_guide/node0049.html),
[horizontal counter description](https://www.amigadev.elowar.com/read/ADCD_2.1/Hardware_Manual_guide/node004C.html)
and [comparison/blitter rules](https://www.theflatnet.de/pub/cbm/amiga/AmigaDevDocs/hard_2.html).
These establish the bounded model, not exact DMA arbitration or captured timing.

## Fetch and frame publication

The interpreter runs the entire field, including lines outside the requested
crop, so earlier active fetches still advance pointers. At DDF start it latches
plane bases and validates the fetched range. At fetch completion it applies the
fetched byte count plus the current signed odd/even modulo. Pointer rewrites
after fetch completion affect the next line without changing the current latch.
DMA configuration/pointer writes during active fetch reject until word-level
fetch arbitration is implemented.

For the supported normal fetch windows, lowres byte count is
`((stop-start)/8+1)*2`; hires is `((stop-start)/4+2)*2`. Raw timing/window encodings
outside this model reject. Native x uses four samples per colour clock and two
per lowres hardware coordinate. DIW register decoding preserves OCS's implicit
stop high bits. The [display-window reference](https://www.amigadev.elowar.com/read/ADCD_2.1/Hardware_Manual_guide/node002E.html)
and [ECS comparison](https://www.amigadev.elowar.com/read/ADCD_2.1/Hardware_Manual_guide/node00A8.html)
explain the limits; DIWHIGH support remains open.

Palette/window state is captured at the crop's left edge; pointers come from
that line's fetch latch. In this deterministic ordering, a write completing at
the capture clock becomes an x=0 event. Writes affecting the crop retain ordered
native-x/register/value records. Fast-table overflow retains complete streams as
specified by [ABI v1](display-snapshots.md), never dropped/quantized writes.
The basic reference still rejects mid-line events, rather than displaying an
unapplied event stream as correct. Event-bearing rendering remains P9 work.

Default limits are 65536 executed instructions, 32 fast events per line and
65536 total retained events. Configurable bounds are validated. Jumps, reads,
fetch spans, pointer arithmetic, unsupported registers and exhausted limits
diagnose PC/beam context. Field exhaustion ends a pending WAIT without hanging.
Sprite reads have a separate `maxSpriteWords` budget (default/maximum 16384);
see [DMA scheduling and limits](sprite-display.md#bounded-copper-dma-and-manual-registers).
Diagnostics return instruction count, PC, elapsed clocks, terminator state, sprite
word count and
an owned final register table. Queries do not expose mutable interpreter state.

## Builder and current limits

[builder.js](../lib/display/copper/builder.js) takes 1–8 view records containing
width, height, depth, hires, plane pointers, rowBytes, palette and hardware x/y.
It returns big-endian list bytes, initial CPU register state and interpreter
options. Install the bytes in a ChipMemory allocation, then interpret at that
address. The display facade does that automatically and reuses/releases its
list allocation without modifying published snapshots.

The first view is installed as pre-beam CPU state. Subsequent views produce WAIT
and changed-register MOVEs; pointer pairs are always rewritten because previous
DMA advanced them. Modulos account for physical row stride versus fetched width.
The interpreter supplies all per-line pointer/palette tables. The builder does
not duplicate per-line rendering or pointer-advance semantics.

The current builder supports x=128 OCS windows, lowres 1–6 planes, hires 1–4,
word-padded rows and representable DIW end positions. Each transition must finish
its changes before DDF start in left blanking; excessive palette/pointer setup
rejects explicitly. Arbitrary positioning, overlapping screens, larger palette
transitions with blank-line scheduling, AMOS offsets, ECS/AGA, sprite bus contention,
interlace and user AMOS copper commands remain open. The interpreter records
supported mode/scroll events but does not claim all mid-line register effects.
Static scroll, EHB and dual-playfield views are now supported, including early
DMA prefixes and signed fetch offsets; see [the mode contract](display-modes.md).
Normal DDF start is $38 in lowres and $3C in hires. The basic reference now
resolves these static modes; mid-line events still reject there.

Fixed instruction costs do not model DMA contention, refresh allocation, fetch
slot starvation, chipset latches or revision-specific behavior. Captures must
validate timing before this becomes a hardware oracle. Performance is unmeasured.

## Verification

Independent literal instruction words test per-line rainbow colours, masked
WAIT/SKIP, unmaskable V7, PAL wrap, jump strobes, DMA disabling, bounds/budgets,
signed odd/even modulos and pointer changes after fetch. Overflow fixtures assert
exact event positions/order and full streams, while the renderer rejects them.
Different-depth/palette screen stacks render expected bands through the builder
and the same interpreter. A mixed lowres/hires stripe fixture checks the two
sampling rates on one native grid and the hires pointer stride. Screen selection,
hidden logical drawing, swaps and
old-snapshot independence are checked at the facade boundary.

Standalone Graphics/Bobs/Test14 factories compare copper-built output to indexed
and static planar output, including Bob animation/restoration. Chromium checks
native copper-built pixels from a generated factory without imports. No fixture
here is labeled an emulator capture. M2's three-capture requirement and the
remaining D2/P3 screen/mode/field/input requirements remain open.
