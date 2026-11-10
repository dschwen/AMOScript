# Interlaced Unpack Screen

`Unpack bank To screen` now creates bounded interlaced packed screens, including
overscan windows up to 384 hardware pixels wide. The packed reader preserves the
LACE bit; the destination keeps mode `$0004` (lowres) or `$8004` (hires). Every
logical bitmap row remains authoritative and available to drawing and Screen
Copy, including rows below the visible field. Decode, placement and source bounds
are checked before replacing the destination. Existing-screen bitmap-only Unpack
keeps its previous behavior and never adopts the source mode or palette.

## Bitmap rows and hardware fields

AMOS `UnPack_Screen` in `+Lib.s` creates the bitmap, copies the packed display and
source-offset fields, then runs `UnPack_Bitmap`. `EcCopper` / `EcAct2` in `+W.s`
clamps the requested window height to the bitmap and shifts it right once for
LACE. `EcCopHo` doubles the physical row displacement before adding the logical
source Y offset. The interlace pointer/modulo updates are registered through
`InterPlus`. The source is pinned in the existing
[official AMOS reference](https://github.com/AOZ-Studio/AMOS-Professional-Official/tree/533b4b1f5acd604814513f78e02c7b4796cb0531).

For a planar bitmap with row size B and source offset O, the fields fetch:

| Field | First row address | Distance to next row |
| --- | --- | --- |
| Even | plane base + O × B | 2 × B |
| Odd | plane base + (O + 1) × B | 2 × B |

Each copper list therefore uses modulo `2 × B - fetchedBytes`. The hardware
window height is `floor(logicalWindowHeight / 2)`. An odd source offset remains
odd; an odd requested height displays its even-length prefix. The full bitmap is
unchanged. Progressive screens in the same physical stack fetch their ordinary
rows in both fields.

The bridge packs each exposed physical bitmap once per synchronous snapshot,
then builds/interprets both field copper lists against that chip data. It weaves
the resulting **row tables**, including bitplane pointers, palettes, sprites,
fast events and overflow offsets. It does not compose CPU RGBA or upload an
alternate texture containing software-rendered pixels. Both Canvas and WebGL
consume the same owned snapshot; the GPU still decodes chip-memory bitplanes.

This composed snapshot uses ABI v1 with `interlaceField: null`, doubled `lines`
and `outputHeight`, a doubled Y origin on the composed row grid, and an adjusted,
reduced pixel aspect. LACE remains in the relevant rows' BPLCON0 words. It is a
static presentation of both fields sampled at the same VM state, not a model of
field alternation or interrupt timing. The existing low-level single-field IFF
snapshots and explicit `composeField` history API are unchanged.

## Windows, priorities and input

Windows retain their logical height and source offsets. Geometry, clipping and
priority ownership use field heights. Existing PAL/NTSC bounds remain 310/260,
with top clipping at hardware row 26. Setup rows still disable real DMA and
retain their existing copper write budgets. Progressive slices repeat in the
composed output; their setup blanks repeat too. Fully covered or off-field laced
windows do not force weaving. Hiding the last exposed laced screen returns to
ordinary progressive presentation.

The synthetic atlas uses the private milestone's *geometry only*: 368×900 with
window `(113,42,368,900)`. X is word-aligned to 112. The existing horizontal fetch
bound limits the fetched span to 352 pixels, and the physical crop ending at 454
shows 342 of them. The PAL composed output is 684×536 samples; NTSC is 684×436.
No extra fetch words are added to fill the crop. All 368×900 bitmap pixels remain
available, including the unfetched right edge and bottom storage rows.

HiRes detection tests its bit independently of LACE. Scin, Mouse Zone and browser
logical input use the same field heights and logical Y scale. Hardware mouse
coordinates remain field coordinates. Y Hard divides logical Y by two; Y Screen
doubles the hardware displacement before adding the source offset. Changing the
presentation size never changes the bitmap or its virtual addresses.

## Validation and current milestone

`test/interlaced-packed.test.js` covers complete synthetic atlas pixels, both
field pointers and stride, PAL/NTSC and top clipping, odd offsets/heights, input
and zones, progressive slices, hiding/occlusion, hires masks, immutable snapshots
and failed replacement. The [repository demo](../demos/interlaced-unpack.html)
exposes four Canvas/GPU pairs and checks 396,064 independently expected pixels.
It uses synthetic packed data and throws if the GPU host calls CPU presentation.

The external unchanged Ghostlight source now gets past its original Unpack at
line 273 and renders level 1 in WebGL. A bounded input check reaches gameplay and
uses second fire to reduce the match count from 2 to 1 without an error. Game
source, assets, modules, pages, reports and captures stay in its private project.
This is not a completed game, full gameplay replay or native Amiga capture.

Remaining gates include laced Load Iff/Save Iff and animation format integration,
Laced keyword coverage, nonlaced-only Dual Playfield pairing, partial HAM/hires
overlaps, wider narrow-screen priority stacks, wrapped DMA, dynamic per-field
state and exact native timing. Existing guards for those forms remain intact.
