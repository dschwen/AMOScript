# Set Sprite Buffer

`Set Sprite Buffer lines` (`$1986`) now owns a real triple buffer for the existing
direct-sprite path. Planet Zybex’s unchanged original line 93 requests 48 lines;
this allocates **4,800 bytes** and executes without an open screen. The complete
source now stops at **Amal Off, line 179, byte 8844**: ten unsupported encodings
remain. This does not implement AMAL or computed/wide sprite allocation.

The [Planet Zybex preview](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex.html)
includes this command in its guarded startup option. Its collapsed browser checks
also expose a declared direct-sprite resize/redraw matrix as captured frames.

## Allocation and lifetime

For the supported `lines=16..4094` profile:

| Quantity | Native-derived size |
| --- | --- |
| Stored column rows | `lines + 2` |
| Bytes per physical channel/column | `4 * (lines + 2)` |
| Bytes per eight-channel buffer | `32 * (lines + 2)` |
| Three-buffer allocation | `96 * (lines + 2)` |

The rows include control/termination storage. Physical, logical and intermediate
slots are distinct. Sprite Update packs the logical slot and rotates physical
← logical ← intermediate ← old physical, as in `HsAFini`. The published stream’s
POS/CTL and DATA/DATB words are read when building snapshot `lineSprites`.
Indexed bank images are not composited onto the playfield or sent as RGBA
sprite overlays. Canvas/reference and WebGL consume the same resulting rows.

Allocation happens before replacing the live pool. Unsupported sizes reject
with source context before clearing assignments, changing the pointer or losing
presentation. The portable cap is 128 KiB per phase/384 KiB total; wrapped-word
sizes, Copper Off and native low-memory fallback allocations remain unsupported.
No preference or physical Amiga heap exhaustion is simulated.

A same-size request returns without allocation, erasure, pointer changes or
processing pending logical commands. A changed allocation immediately clears
logical image assignments and frozen presented streams, retains remembered x/y
coordinates, and resets Hide/Show nesting to visible. The successful native path
preserves the selected mouse shape; the default-shape fallback is a separate
allocation-failure path outside this profile. Bob state, screen pixels/palettes,
audio, input and asset banks/virtual addresses are unaffected. AMAL programs
are not executable yet; retiring their Sprite-channel motions must join this
path when those controllers are implemented.

The initial factory pool follows `HsInit(128)`, with 128 stored rows/12,288 bytes.
`Default` follows `SBufHs(128)`, producing 130 stored rows/12,480 bytes. Repeating
Default reuses that allocation while clearing the sprite presentation. Initial
factory defaults are portable runtime choices, not a native startup capture.

## Height admission and direct publication

For a new direct image, native `HsDm` rejects when `imageHeight + 1 >= HsPMax`,
where `HsPMax = storedRows - 2`. Thus `Set Sprite Buffer 48` admits heights through
46 in this source profile. An oversized image leaves an earlier presentation and
position intact, while logical I/X/Y Sprite queries retain the pending command.
With no earlier image it stays invisible. A resize erases that earlier assignment.
Increasing the allocation and reissuing Sprite can admit the image.

The existing supported image width is 16 pixels, depths 1–6, maximum height 270.
Three-plane images publish the low two planes; four through six planes publish
the low four using an attached even/odd pair. Odd starting numbers consume a blank
channel first. Unsupported width/depth/height and computed logical numbers stay
explicit errors. This slice does not bypass those gates for Zybex’s Sprite 15.

Packed words are big endian and MSB leftmost. Zero terminators and unused padding
are initialized deterministically. Pointer reservation changes repack the three
slots from frozen presented records, preserving the established Show/Hide behavior
without admitting pending Sprite Update Off commands. Exact native copy-counter,
blitter, interrupt and inactive-memory contents remain timing/capture gates.

## Ownership and diagnostics

`lib/amos/spriteBuffer.js` owns the allocation and is embedded into standalone
factories. When assembling the older UMD runtime scripts manually, load
`spriteBuffer.js` before `operations.js`; generated pages already embed it.
`state.spriteBuffer` publishes frozen size/generation/slot diagnostics;
`spriteBufferSnapshot()` returns an owned byte copy for inspection. Admission uses
the private pool’s capacity. No raw Sprite-buffer address is fabricated for AMOS
Start/Peek/Poke. Stream storage is CPU-owned and separate from the display chip
allocator and bank-memory address space; native chip-pointer/DMA/bus allocation
remains future work. Existing structured sprite rows still pass through the
shared copper snapshot/CPU/GPU resolver.

Old snapshots remain immutable after resize, rotation and pool reuse. Stop keeps
the last presentation for Resume/inspection. Replacement releases the manager’s
old storage; only independently exported copies survive. No asynchronous resource
or new browser adapter is introduced.

## Evidence and verification

Primary evidence is AMOS-Professional-Official revision
[`533b4b1f5acd604814513f78e02c7b4796cb0531`](https://github.com/AOZ-Studio/AMOS-Professional-Official/tree/533b4b1f5acd604814513f78e02c7b4796cb0531):
[`+Lib.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BLib.s)
`InSetSpriteBuffer`, and
[`+W.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BW.s)
`HsInit`, `HsSBuf`, `HsRBuf`, `HsDm`, `HsAff`/`HsAFini`, `HsBlit`, `MShow` and
`HAa3`. The manual’s [Sprite-buffer section](https://amospromanual.dev/07-01-hardware-sprites.html)
provides allocation context; the strict height and equal-size behavior follow the
executable source.

Six unit groups cover sizes/bounds, independent stream words, all three slot
rotations, owned snapshots, same-size/pending state, resize/pointer behavior,
source typing/errors, height admission, no-screen execution and Default/bank
ownership. Literal two-row plane words (`5555/aaaa`, `3333/cccc`, `0f0f/f0f0`,
`00ff/ff00`) independently specify the rendered image.

`tools/reference/sprite-buffer.py` specifies the five-stage matrix without loading
the compiler, decoder or renderer: draw, same-size request, erase on resize,
redraw at a new position, then Default. Ten PAL/NTSC Canvas/GPU frames match full
independent RGB hashes. GPU tests forbid CPU presentation. These add to the
original startup, background and score checks for **51 Planet Zybex GPU
comparisons**, plus original close/clear checks. The matrix uses a declared test
bank; it does not replace a player or enemy in a running game.

Run `python3 tools/reference/sprite-buffer.py`, `npm run build:demo`,
`npm run check` and `npm run test:browser` to rebuild and verify.
