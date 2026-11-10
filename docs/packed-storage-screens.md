# Native screen widths and packed bitmap storage

AMOS `Screen Open` truncates the requested width to a multiple of sixteen before
validating or allocating the bitmap. `InScreenOpen` forwards the dimensions to
`EcCree`, whose first width operation is `and.l #$fffffff0,d2`. The supported
native range is therefore 16..1008 pixels after truncation, with height 1..1023.
The existing colour/mode gates still apply. Invalid dimensions reject before
retiring the old screen, buffers, clones or palette jobs.

Ghostlight's requested widths **302 and 86 mean 288 and 80**, respectively. This
is a language correction, not a game-specific workaround or a reason to change
its source. Screen Width, row strides, copying, clipping and input conversion use
the resulting bitmap dimensions. Resource Screen Open already has its separate
source-derived dimension normalization.

The host-facing `program.display.open()` API keeps its existing exact logical
dimensions for fixtures and adapters. The language statement now calls
`program.amosScreenOpen()`. Arbitrary host bitmap padding remains separately
owned and is not exposed as additional logical pixels.

## Presenting a narrow lowres bitmap

The bounded copper builder previously required a DIW endpoint of at least 256,
which prevented presenting an 80-pixel bitmap starting at hardware x=128. The
builder now extends that lowres DIW endpoint to the minimum representable value,
while retaining the actual bitmap's **DDF fetch count, row stride, modulo and
cropped output width**. Extending the display window must not extend memory reads.
An 80-pixel, six-plane screen still fetches five words (ten bytes) per plane/row,
and publishes 160 native horizontal samples. No extra bitmap rows or RGBA overlay
are introduced. Hires small-window gates remain unchanged.

This support is bounded to a cropped narrow view. A narrow foreground slice in
a wider priority snapshot still rejects with `visible window exceeds fetched
data`: the extra DIW span cannot currently be represented as an unfetched tail
inside that wider output. This remains an explicit integration boundary for
transient/overlapping views; do not increase DDF reads or silently skip a screen
to make it pass.

The [native widths/storage demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/narrow-packed.html)
uses a 288×180 main screen, hidden packed bitmap storage and a visible 80×20
scratch screen, then hides the scratch screen and restores the main view. Three
Canvas/GPU frames compare 105,280 independently expected indexed pixels. The GPU
host cannot invoke CPU presentation during comparisons. Tests also assert exact
ten-byte row-pointer increments for all six scratch planes.

## Interlaced packed data is not interlaced presentation

The pure packed-picture reader now accepts and preserves BPLCON0's LACE bit:
`image.control` retains the original control word and `image.mode` includes
`$0004` (bit 2).
It also retains wider raw packed-window metadata, including the supplied atlas's
368-pixel window. Unsupported HAM/dual-playfield/control bits still reject.
The compressed traversal always reconstructs every logical bitmap row; LACE
does not discard alternate rows or change the packed byte-stream layout.

Existing-screen `Unpack bank` is the bitmap operation: native UnPack_Bitmap skips
the packed screen definition and copies pixel data. It can therefore unpack a
laced source into an ordinary existing bitmap while retaining destination mode,
palette, geometry and existing Autoback semantics. Hidden storage can hold all
rows, including those below the visible field, and ordinary checked Screen Copy
can read them.

`Unpack bank To screen` now supports bounded interlaced creation and overscan
windows up to 384 hardware pixels wide. It retains all bitmap rows and source
mode, constructs both fields with doubled planar stride, and weaves row tables
for Canvas/WebGL. No source flag is dropped and no game-specific hidden-screen
case is used. See [interlaced unpack](interlaced-unpack.md) for exact geometry,
input mapping, independent browser checks and remaining timing/mode gates.

## Supplied atlas evidence

Ghostlight's `walls2.abk` is 41,774 bytes and decodes as 368×900, three planes,
control `$3204`, with raw window `(113,42,368,900)` and zero source offsets.
Its 331,200 reconstructed indices have SHA-256:

`8d68a66a94df4cd9016952a0dfba19e90224489e66dbc279776033823fafa58a`.

The independent Python [checker](../tools/reference/check_packed_picture.py)
expands pointer bits, flags and byte runs before remapping square-column traversal
into planar rows. It imports no production decoder and emits metadata/hashes,
never the asset or decoded pixels. Reproduce its
[checked-in report](../tools/reference/ghostlight-walls.json) with:

```sh
python3 tools/reference/check_packed_picture.py \
  /home/daniel/Programs/ghostlight/data/walls2.abk
```

The JavaScript decoder matches the independent complete-pixel hash and row hashes
for rows 0, 450 and 899. A declared local storage fixture then unpacks the entire
atlas into an ordinary hidden bitmap and copies its bottom-right 80×20 region
into a six-plane scratch bitmap, preserving the scratch's upper planes. All
1,600 copied indices match the decoded source. This is a data-transfer fixture,
not execution of the original new-screen Unpack or a native Amiga capture.

Public tests/demos use a small synthetic packed bank with the same LACE/overscan
metadata distinction; Ghostlight assets remain external. Core evidence for
widths is `InScreenOpen` / `UnPack_Screen` / `UnPack_Bitmap` in `+Lib.s`, and
`EcCree` in `+W.s` from the
[official AMOS source](https://github.com/AOZ-Studio/AMOS-Professional-Official/tree/533b4b1f5acd604814513f78e02c7b4796cb0531).

Full Ghostlight compilation now passes all 18 used extension encodings. Its
original new-screen atlas unpack now runs, and the private WebGL page reaches
level 1. Sustained gameplay/completion and native captures remain open. See the
[milestone plan](ghostlight-extension-plan.md).
