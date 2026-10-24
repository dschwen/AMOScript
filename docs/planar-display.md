# Planar display bridge and basic reference renderer

P1 now has CPU chip storage, a basic bitplane reference renderer, a physical-screen
exporter and a bounded normal-mode ILBM loader. This is the first implementation
step in [the display architecture](display-architecture.md). The
[bounded copper/stack path](copper-display.md) is now implemented separately;
sprite contention/computed allocation, remaining advanced modes and GPU rendering
remain open. Indexed screen
arrays still own AMOS drawing state.

## Physical-screen export

CommonJS displays and standalone generated factories expose:

```js
const snapshot = program.display.snapshotPlayfield();
const rgba = program.display.renderPlayfield();
```

Both methods accept an optional screen number without selecting that screen.
`snapshotPlayfield` returns ABI v1 `{ chip, frame }`; `renderPlayfield` exports a
snapshot and runs the basic CPU reference. Neither advances instructions, waits,
objects, fields or clocks. The helpers are embedded in generated modules and
need no imports, DOM, Canvas or GPU. The current Canvas host keeps using `rgba()`.

The export contains the **physical playfield only**. Bobs/static pastes/text are
already pixels there, so they are included. Hardware sprites are a separate
presentation layer and deliberately absent; this is not yet the final shared
display snapshot with structured physical sprite channels. Do not compare its
output to sprite-overlaid `rgba()` as if it represented the same layers.

Lowres pixels occupy two native samples; hires pixels occupy one. Therefore an
AMOS 320×200 lowres screen produces 640×200 RGBA pixels, while a 640×200 hires
screen produces 640×200. The default native-grid pixel aspect is 1/2 for lowres
and 1 for hires, preserving the current square source pixels after presentation.
This is bridge geometry, not a calibrated PAL/NTSC capture. Nominal field rate
defaults to 50; it does not introduce a second clock. `displayOptions` accepts
`snapshotVideoRate` and `snapshotPixelAspect` rationals and `snapshotChipBytes`
(512 KiB/1 MiB/2 MiB, default 2 MiB). Actual field-clock integration remains D2.

The bridge allocates a contiguous mirror for each presented indexed-buffer
identity, with each plane stored contiguously and rows word-aligned. Each new
snapshot fully repacks that physical array, so direct host pixel writes cannot
escape export merely because display.version did not change. Padding bits/bytes
are cleared. Changed chip bytes update dirty revisions; palette-only changes do
not rewrite plane bytes. Published snapshots own copies and never change after
later drawing/swap/export. Frame revisions increase on publication; they are
distinct from internal chip-write revisions.

Screen Swap exchanges logical/physical identities. Existing allocations follow
those identities when the buffers are presented again. Logical-only drawing is
hidden until the swap; Point still reads the logical array. Reopening/closing a
screen releases its mirror allocations; abandoned buffer identities are pruned.
Chip exhaustion, malformed physical arrays and out-of-range indices reject
without changing indexed AMOS pixels. The exporter allocates only the buffers
actually exported, not every bank or screen in advance.

## CPU memory and renderer

[ChipMemory.js](../lib/display/model/ChipMemory.js) implements aligned allocations,
release/coalescing, bounded byte and big-endian word access, owned byte snapshots
and revisioned 2048-byte dirty rows. Allocation handles belong to their instance;
released allocations are cleared. No-op tracked writes do not increment revision.
Writes directly through `bytes` require `markDirty(address, length)`.

Each consumer calls `dirtySince(itsLastUploadedRevision)`, then retains the returned
revision independently. Queries do not consume state. Revision -1, lost contexts
and expired history require full upload. The default history retains 128 write
operations; rows from overlapping/adjacent writes merge in query results. This
module does not implement an Amiga operating-system allocator or chip/fast bank
addresses. The bridge's copied snapshots currently use full transfer boundaries;
connecting their lifetime/revisions to GPU upload caches belongs to D4.

The [reference renderer](../lib/display/reference/render.js) exposes:

```js
const reference = require('../lib/display/reference/render');
const rgba = reference.render(snapshot.chip, snapshot.frame);
const trace = reference.explainPixel(snapshot.chip, snapshot.frame, x, y);
```

It validates ABI structure, decodes normal/EHB/HAM6/dual-playfield planes MSB-first, treats plane zero
as the low index bit, and reads each line's own pointers/palette/window. Native
lowres/hires sampling, borders, vertical-window/bitplane-DMA flags and opaque
12-bit palette expansion are supported. Pointer reads are bounded with raster
line/x diagnostics. A pixel trace includes source x, byte addresses/values, bits,
raw index, palette entry and final colour. Zero-plane lines produce colour zero.

EHB, static scroll/fetch offsets, dual playfields and explicit image fields are
now implemented; see [the mode contract](display-modes.md) and
[HAM6 contract](ham-display.md). Superhires, AGA,
mid-line events reject explicitly. Physical sprite tables are now supported
by the common renderer; see [sprite contract](sprite-display.md). A separate pure
composer accepts explicit history for weave/line-double output. Static decoding does
not yet model copper/fetch slot timing, DMA bandwidth, latch behavior or chipset
revision quirks; source/emulator capture gates remain required before claiming a
complete hardware oracle. Renderer calls are pure and share no mutable state.

`staticFrame.js` builds simple frame tables for the bridge, IFF and fixtures. This
is the architecture's bootstrap path. `snapshotDisplay`/`renderDisplay` now use
the common copper builder/interpreter for representable OCS views. Full-bitmap
debug/migration export and IFF fixtures retain this helper; it must not grow into
a second independent implementation of copper scheduling semantics.

## ILBM support

[ilbm.js](../lib/display/model/ilbm.js) exports `readIlbm(bytes, options)` and returns
`{ snapshot, image, mask }`. It parses a standalone FORM ILBM with BMHD/CMAP/CAMG/
BODY, word-padded chunks and row-interleaved source planes. It supports 1–5 normal
planes plus six-plane EHB and five/six-plane HAM, no compression or row-bounded ByteRun1 (including NOPs),
and lowres/hires (maximum four planes in hires). LACE selects explicit fields.
Rows are deinterleaved into contiguous chip planes. The implementation follows
the [original ILBM specification](https://wiki.amigaos.net/wiki/ILBM_IFF_Interleaved_Bitmap).

CMAP high nibbles become OCS RGB and expand by 17. Missing colours use a documented
evenly spaced grayscale default. Absent CAMG defaults to lowres; unsupported
mode IDs reject instead of being guessed. Legacy CAMG SPRITES (`$4000`) is
retained as metadata and removed from display-mode interpretation. PAL/NTSC
monitor IDs (`$21000`/`$11000`) select nominal 50/60 Hz unless overridden;
their extended marker is removed before checking supported pixel-mode bits.
Other monitor IDs remain unsupported. BMHD aspect is converted from source
pixels to native samples. Signed image position/page metadata is retained; it
does not move the standalone crop window. Options include `chipBytes`, `origin`
and nominal `videoRate`.

Mask planes are decoded separately and returned in `mask`; transparent-colour
metadata is retained. These describe brush/paste transparency, which is not an
extra hardware display plane. The returned standalone snapshot is opaque.
Lasso masking, other extended CAMG modes, deep colour, DEST merging
and active palette-changing/cycling extensions reject. Up to 256 inactive CRNG
records are retained as frozen metadata; size, reserved word, flag bits, range
ordering and placement before BODY are checked. This enables the original
Wonderland assets without implementing animated cycling. Unknown nonsemantic chunks
are skipped with bounds checks. Palette presence/count, CAMG presence and AMSC
presence are retained as image metadata. The AMOS
[Load Iff command](title-display.md) now uses this utility for opaque non-laced
images; AMSC placement rejects explicitly. Existing bank Load behavior is unchanged.

Inputs are bounded to 16 MiB, dimensions to 2048×2048, and decoded plane storage
to configured chip capacity. ByteRun1 packets may not cross plane-row boundaries;
truncation, duplicate properties, missing padding, trailing data, unsupported
compression and impossible allocations reject. Trailing compressed NOPs are
accepted. Errors include file byte positions where relevant.

## Evidence

Tests cover independent stripe/word/row/padding expectations on every plane,
the existing [ABI fixture](../test/fixtures/display/README.md), signed border
positions, palette changes, bounds and unsupported-mode failures. Standalone
Graphics/Bobs/Test14 programs compare native output to indexed output, including
hidden drawing, swaps and Bob restoration. Autoback 0/1/2 and hires are exercised.
Chromium checks native planar pixels from a generated module without imports.

The independent ILBM matrix contains raw and ByteRun1 pictures at 2/4/8/16/32
colours with odd widths, row padding and all palette indices. PNG goldens come
from pixel formulas and independent Python encodings, not the production loader.
These establish synthetic behavior and migration parity, not AMOS captures or
GPU parity. Detailed capture/performance and D2–D6 gates remain open.
