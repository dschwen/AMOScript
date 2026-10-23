# Physical sprite CPU reference

The reference renderer consumes ABI v1 `lineSprites`, eight four-word channels
per line: signed native hstart, DATA, DATB, flags. Bit 31 marks activity; bit 0
on an odd channel attaches it to the preceding even channel. DATA/DATB are
16-bit words, MSB leftmost, with DATA supplying the low pixel bit. Unsupported
width flags, even-channel attachment and oversized words reject with line/channel
context. This validation belongs to the renderer; the wire codec remains structural.

Sprite pixels span `samplesPerLowresPixel` native samples independently of
playfield resolution. Starts can be negative; output clipping does not shift bit
selection. Each line supplies its own words and positions, so the renderer has
no hidden DMA or field history. The current native crop permits sprite evaluation
outside bitplane windows; exact hardware blanking/border visibility remains a
capture gate. Line flag bit 2 records sprite DMA status; the channel's active bit
records armed output. Disabling DMA does not hide an already armed channel.

Unattached zero is transparent. A pair uses palette entries `17+4*pair` through
`19+4*pair`; within a pair the even channel wins. Attachment combines the even
channel's low two bits with the odd channel's high two bits and uses registers
17–31 for nonzero values. Independently positioned attached channels contribute
their bits at their own starts. These rules follow the
[sprite hardware chapter](https://bastya.net/AmigaDevDocs/hard_4.html).

The first nontransparent pair wins among sprites, then playfield masking applies.
Normal playfields use BPLCON2 bits 5–3. In dual mode, bits 2–0 control PF1 and
bits 5–3 control PF2; each nonzero group can hide the sprite, including a group
covered visually by the other playfield. Priority codes 0–4 place zero through
four sprite pairs ahead of a playfield. Undocumented codes 5–7 reject when sprite
channels are active. The hardware manual's
[priority table and overlap example](https://amigadev.elowar.com/read/ADCD_2.1/Hardware_Manual_guide/node0159.html)
define this behavior. HAM carry advances before sprite composition; sprites do
not replace stored commands or alter subsequent colour history.

`explainPixel` retains the underlying playfield palette result and adds the
candidate sprite's channel, pair, attachment, value, palette index, visibility and
blocking playfield numbers. `final` reflects the sprite only when visible.

## Bounded copper DMA and manual registers

[spriteDma.js](../lib/display/copper/spriteDma.js) now runs inside the common
copper interpreter and is embedded in standalone modules. It loads POS/CTL
control pairs, fetches DATA/DATB rows for VSTART through VSTOP-1, advances
word-aligned pointers and loads the next descriptor on the stop line. That
control line supplies the gap for vertical channel reuse. Zero-height entries
fetch another control pair instead of pixel data. Both vertical high bits and
horizontal bit zero are decoded; attached odd channels retain their flag.

DMA requires master+sprite enable. Disabling it retains the last armed row.
Manual writes to DATA arm output, CTL disarms it, and POS changes position.
DATB can be loaded before DATA without arming. Rendering uses armed channels
even with DMA off. The hardware manual's
[automatic/manual descriptions](https://bastya.net/AmigaDevDocs/hard_4.html)
establish these operations; these tests remain source-derived, not captures.

The bounded scheduler uses two word slots at `$15+4*channel` and
`$17+4*channel`, with blanking control reload at PAL line 25 or NTSC line 20.
The [upstream WinUAE source](https://github.com/tonioni/WinUAE/blob/master/custom.cpp)
also distinguishes blanking reload, vertical fetch state and individual word
slots. This is a fixed-clock CPU profile, not WinUAE execution or a complete
bus-arbitration model. An overlapping active bitplane fetch rejects explicitly.
Copper/CPU bus stalls, register pipeline delays, arbitrary shifter-latch timing
and hardware blanking remain capture/timing work.

The raw screen builder accepts `spritePointers`, exactly eight aligned chip
addresses including safe null streams for unused channels. Providing them
enables sprite DMA and installs all pointer registers before beam execution.
The caller owns stream storage in the same chip array as the copper list and
planes. Omitting pointers preserves the existing AMOS bridge path, which
publishes sprite-manager rows directly after interpreting its screen list.

`maxSpriteWords` bounds DMA reads (default/maximum 16384; zero forbids reads).
Out-of-bounds reads identify channel, address and copper PC/beam context.
Diagnostics expose `spriteWords` and owned final pointer registers. DMA writes
inside the output crop are retained as register events; the reference explicitly
rejects those event-bearing frames until the event renderer is implemented.

## AMOS publication and migration

`snapshotDisplay()` and `renderDisplay()` now include direct AMOS channels from
the sprite manager's presented frames. The writer packs their frozen image rows
into DATA/DATB and translates lowres hardware coordinates using snapshot origin.
Screen-stack palettes and BPLCON2 priorities come through the common copper path.
Pending manual moves and Sprite Off take effect at Sprite Update, matching the
existing Canvas presentation. Channel zero remains reserved while the mouse
pointer is visible. Publishing neither updates sprites nor advances the VM.
Each snapshot owns its arrays and survives subsequent updates unchanged.

`snapshotPlayfield()` remains a sprite-free full-bitmap migration/debug API.
Canvas now consumes the same structured row writer and sprite resolver as
the CPU reference; the opaque `setCompositor` RGBA callback and its duplicate
priority implementation have been removed. Canvas still converts authoritative
indexed playfield pixels, preserving the staged planar migration. The direct
browser-script runtime loads the shared colour/sprite helpers before display.js;
generated modules embed them. Computed AMOS allocation, attached/wide image forms,
collision registers, DMA slot contention and mid-line sprite events remain open.
Raw physical attached tables do not imply those AMOS commands are implemented.

Tests cover all eight channels, word patterns, transparency, all documented
priority placements against both playfields, PF2PRI permutations, all attached
colour indices, misaligned attachment, signed/right clipping, two/four native
sample grids, per-line changes, armed output and owned snapshots. DMA tests add
all channels, chained descriptors, zero height, PAL/NTSC reload, high position
bits, disabled-DMA retention, manual register writes, bounds and contention.
Chromium also renders the descriptor/reuse fixture through import-free factories
and Canvas, saving `test/artifacts/sprite-dma.png`. Standalone
programs and Chromium compare manual updates/movement/clearing to Canvas.
These are synthetic/source-derived expectations, not external AMOS captures or
proof of complete hardware timing. GPU composition remains a separate milestone.
