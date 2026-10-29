# Computed and wide Sprites

Logical Sprite numbers **8–63** now use the shared eight-channel hardware Sprite
pool. Direct numbers **0–7** retain their fixed starting channel. Word-aligned
images wider than 16 pixels split into 16-pixel strips; four through six planes
use even/odd attached pairs, publishing the low four planes. One through three
planes use single channels and the low two planes. Supported height remains
1–270. These are Sprite streams, not Bobs or RGBA overlays.

Planet Zybex's original `Sprite 15,176,124,1` now executes. The unchanged game
next stops while compiling the ship AMAL string at **line 1142, byte 54290,
character 37** (`Expected AMAL register` at its unsupported `J1` input function).
Ship input and independent animation lanes remain necessary for connected play.

Choose **Computed ship sprites (image/allocation preview)** in the
[Zybex demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex.html).
Advance through all thirteen original ship images, three ships on separate rows,
a contention example, mouse reservation and Sprite Off. This fixture retains
original level Load/Unpack and the initial Sprite statement; the image/allocation
matrix and key guards are declared harness statements. No ship AMAL code or
running-game state is replaced.

## Packing and ownership

`lib/amos/spriteBuffer.js` packs POS/CTL and DATA/DATB words into the existing
three owned buffers. Direct objects reserve their consumed channels for the
whole field. An odd starting attached direct object consumes an empty channel
before its even pair; a wide direct object consumes subsequent channels and
truncates at channel 7. The visible mouse reserves channel 0.

Computed objects sort by hotspot-adjusted, clamped top then logical number.
A rotating search admits a strip when its channel(s) are free of direct/mouse
reservations, its top is at least the previous object's bottom plus one, and
`usedLongs + height + 1 < lineLimit`. Attached strips require an even pair and
capacity in both columns. Each appended record overwrites the earlier zero
terminator and leaves a new zero terminator. Pool exhaustion can omit a whole
object or the remaining strips of a wide object, without changing logical
I/X/Y Sprite queries. Failed searches retain their last candidate for the next
object. Native packed-control addition advances each strip horizontally.

The snapshot publisher walks every record in a column. It writes structured
per-line physical channels into the shared copper snapshot. Canvas/reference and
WebGL use the same sprite resolver; GPU checks prohibit CPU presentation.
No bank pixels, playfield planes, palettes, Bob backgrounds or chip/bank address
identities change during packing. Storage remains the CPU-owned native-format
pool described in [Sprite buffers](sprite-buffer.md), not an emulated DMA heap.

AMAL installations can capture computed Sprite intent objects. Manual Synchro
updates intent; Update publishes it. Ordinary Sprite commands retain identity;
Sprite Off, changed Set Sprite Buffer and Default retire matching programs.
Stop retains presentation and motion state; terminal cleanup retires programs.
Frozen snapshots and exported buffer byte copies survive subsequent reuse.

## Source evidence and limits

The allocation model follows `Hss4`/`Hss20` (shared Sprite insertion), `HsAff`
(direct reservations), `HsA3`/`HsA6` (single channels), `HsMAff` (attached pairs),
`HsBlit` (strips/planes) and `HsAFini` (buffer rotation) in
[AMOS-Professional-Official +W.s, revision 533b4b1](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BW.s).
The original linked-list/blitter machinery is represented by a sorted list and
checked stream writer. Reserved pairs are excluded safely even in mixed direct
layouts; incidental native null-pointer/column aliasing behavior is not reproduced.

This is bounded source-derived allocation evidence, not an Amiga capture.
Exact copy-counter/interrupt timing, DMA contention, unusual packed-coordinate
wraps, native behavior for every mixed-reservation topology, configured mouse
artwork and raw chip-pointer access remain unverified. Automatic AMAL scheduling,
Sprite Col and other wider AMAL functions remain explicit gaps.

## Verification

Seven test groups cover independent literal control/plane words, insertion
order, even-pair alignment, direct/mouse reservations, wide truncation, the
one-line reuse gap, cumulative strict capacity, shallow planes, immutable
snapshots, AMAL ownership and lifecycle. The original ship matrix runs in both
PAL and NTSC and matches independent complete raw-asset composites.

`tools/reference/planet-zybex-amal.py` decodes the original packed background
and AmSp bitplanes independently, then creates seventeen PNG/hash expectations.
The contention case explicitly expects only the admitted first strip. It imports
no production compiler, allocator or renderer. Browser checks add **34 Canvas
frames and 34 actual GPU comparisons**, bringing Zybex to **142 GPU comparisons**.
The live preview is tested through real buttons, all seventeen stages, renderer
replacement, fullscreen and disposal. The separate full-source test asserts the
new ship-AMAL failure and complete owned-work cleanup.

Regenerate with `python3 tools/reference/planet-zybex-amal.py` and
`npm run build:demo`; verify with `npm run check` and `npm run test:browser`.
