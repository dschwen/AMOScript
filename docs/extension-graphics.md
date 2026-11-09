# Turbo Plus pixels, graphics planes and masked blocks

The Ghostlight graphics milestone adds three explicitly configured Turbo Plus
V2.15 entries and two ordinary AMOS block overloads:

| Encoding | Command | Supported behavior |
|---|---|---|
| Turbo `$036e` | F Plot x,y,colour | Direct current-buffer pixel, low colour bits, ordinary Autoback/Bob hooks |
| Turbo `$044c` | F Point(x,y) | Logical pixel read, -1 outside the bitmap |
| Turbo `$04fe` | Set Planes mask | Low-byte mask for implemented RastPort-style drawing |
| Core `$1160` | Get Block number,x,y,width,height,mask | Owned word-rounded capture with optional zero transparency |
| Core `$1190` | Put Block number,x,y,planes | Direct current-buffer masked copy, independently selected planes |

Turbo entries require `--extension SLOT=turbo-plus-2.15`; slot 12 is not assumed.
Existing Get Block/Put Block arities continue to work. The five-argument Put
Block/minterm token remains unsupported.

## Pixel access and drawing masks

F Plot follows recovered R031/R032: a negative colour rejects; other colours use
their low screen-depth bits. In-bitmap writes ignore the graphics clip and Set
Planes. Outside coordinates are no-ops before drawing hooks. The portable subset
requires signed-word coordinates and word-aligned bitmap widths, because it does
not expose padded pixels beyond non-word-sized logical bitmap rows. It does not
change the graphics cursor, Ink, line phase or palette. Autoback 0 writes only the
logical/current buffer; existing Autoback 1/2 replay and Bob hooks remain shared
with the normal drawing path.

F Point follows R033, reading all logical planes without changing cursor, Ink,
clip, plane mask or either buffer. It has the same portable coordinate/width
gate and returns -1 outside bounds. It is not an alias for a colour-masked read.

Set Planes writes the low eight bits, including zero; -1 restores all planes.
Each screen retains its graphics mask across selection and buffer swaps. Screen
Open starts at 255. Graphics pixels, lines, boxes, filled rectangles, circles,
ellipses, graphics Text, portable Paint and Polygon preserve unselected bits:
`new = (old & ~mask) | (drawn & mask)`. Solid filled rectangles keep the existing
fast path when all screen planes are enabled. Partial-mask flood fills terminate
even when the merged colour equals the seed.

This mask models the implemented RastPort-style writers, not every future Turbo
command. F Draw's private state/rasterizer remains unsupported. Default-window
Print/Writing, Cls (including its rectangular raw clear), captured blocks,
ordinary Paste Bob/Icon, Bob-specific planes, Screen Copy/Zoom, animation and raw
plane memory retain their separate writer contracts. In particular, the
Ghostlight credit's Bar may select plane 32 while Paste Bob still copies its
ordinary common planes. Do not apply a universal mask to every bitmap transfer.

## Capture and block drawing

Get Block validates the requested rectangle before replacing a record. It takes
current logical pixels without drawing hooks or Autoback replay. Width rounds up
to a multiple of 16, copying only the requested columns and setting the added
columns to zero on every row. Pixels are independently owned and survive source
mutation, closing, replacement and buffer swaps. Coordinates, depth and the
original placement are retained; no palette mutation occurs.

The sixth argument's low word selects transparency: zero is opaque; any nonzero
word generates a frozen mask by ORing all captured planes. Index zero is
transparent. Padding is therefore transparent for masked blocks, and opaque zero
for unmasked blocks. A failed capture preserves the old record.

Put Block selects its own low-word plane mask, defaulting (including EntNul) to all common source/
destination planes. It preserves other destination bits. Its transparency mask
uses all captured source planes, independently of the chosen output planes.
The original stored coordinates are used for omitted values or EntNul. The
portable subset requires signed-word placement and uses the existing exact-pixel
graphics clipping contract; original word-rounded blitter clipping is not a
native parity claim.

Native DrawBloc writes EcCurrent directly. Put Block therefore bypasses ordinary
Bob cleanup and Autoback replay: even with Autoback 2, physical pixels stay
unchanged until the caller explicitly publishes the logical buffer. This also
corrects the previous opaque subset's use of the normal replaying paste wrapper.
Block masks remain distinct from Set Planes and from live Bob masks.

## Evidence and checks

Turbo's recovered R031/R032/R033 and R04c are in the checked-in
[disassembly](../tools/reference/turbo-plus-v2.15/disassembly.txt).
Core evidence is InGetBlock5/6 and InPutBlock1/3/4/5 in `+Lib.s`, and
MakeBloc/GetBob/Masque/DrawBloc/TPatch in `+W.s` from the
[official AMOS source](https://github.com/AOZ-Studio/AMOS-Professional-Official/tree/533b4b1f5acd604814513f78e02c7b4796cb0531).
Native mask generation includes every source plane, and GetBob explicitly rounds
the image width and clears its right padding. These are source deductions, not
Amiga captures.

The [extension lighting demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/extension-graphics.html)
shares its evaluator and source fixture with browser checks. Six independently
constructed logical/physical matrices compare 184,320 indices. Six Canvas frames
and six actual GPU frames cover bit preservation, zero masks, masked padding,
capture independence and publication. CPU presentation is disabled on the GPU
host during those checks. Unit tests also cover hook ordering, cursor/Ink
preservation, clipping, out-of-bounds/negative-colour errors, screen mask lifetime,
failed capture replacement, typed F Point expressions and masked flood/polygon
interiors.

A local fixture loads Ghostlight's supplied sprite bank and retains original
INIT lines 1791–1815, with other source omitted and a declared Wait Key guard at
1816 before Screen Close. It completes and captures blocks 1–10; replaying those
captures against background 32 changes 182, 182, 91, 793, 793, 791, 791, 1681,
1409 and 1289 pixels.
This is a headless excerpt check, not full INIT, independent asset decoding,
native image evidence or a complete game run. No game assets/source are bundled
in this public demo.

The full game still rejects at Pt Play. The laced `$3204` packed walls atlas,
302-/86-pixel bitmap presentation and AMCAF playback/timing remain separate
milestones. See the [Ghostlight plan](ghostlight-extension-plan.md).
