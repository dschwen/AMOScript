# Executable title setup and rainbow rows

Wonderland's exact first 64 physical source lines now execute with the original
embedded banks and volume paths. They pass through the original Wait Vbl, reserve
and hide a rainbow, load `Title_Screen.Iff`, turn off the cursor, and draw Bob 74
as the menu marker at `(84,92)`. Both startup benchmark branches produce the same
title. The original menu loop now also runs in a declared
[keyboard/gamepad fixture](joysticks.md); the complete unmodified source now compiles and runs/renders its first level for
two controlled seconds. Full interactive gameplay remains unverified.

## Load Iff

Original `$17d4` loads into the current logical screen; `$17e4` loads into a newly
created screen selected by the second argument. The synchronous files adapter
returns a byte string, just as for bank loading. Browser assets must be preloaded.
Generated modules embed the bounded ILBM decoder with no runtime imports.

The new-screen form rounds width to a multiple of 16, installs decoded pixel
codes and CMAP entries, selects the new screen and leaves it unbuffered. With no
CAMG, the original page-width/page-height mode inference applies. Existing screen
and ILBM size/depth limits still apply. The current-screen form checks width and
depth, clips excess height, and copies only source planes into the logical buffer,
preserving higher destination planes and pixels outside the image. It bypasses
Autoback mirroring; a separate physical buffer changes only when swapped. Only
CMAP entries actually present are replaced. Missing CMAP leaves the palette intact.

Opaque normal/hires/EHB/HAM images use the existing indexed display model.
Masks and interlace reject explicitly in the language
loader, even though the lower-level ILBM utility supports some brush/field forms.
Explicit destinations now support bounded lowres full-bitmap AMSC placement;
implicit loads retain current geometry. See [Roller II's first image](roller2-title.md).
Active colour cycles still reject. Image loading invalidates saved logical Bob
backgrounds before writing and lets the existing automatic Bob flush redraw them.
Bank `Load` remains a separate command with its existing formats and semantics.

## Table-based rainbows

Implemented original tokens are Set Rainbow `$0d90`/`$0dae`, Rainbow `$0ddc`, and
assignable/readable Rain `$0df0`. [Rainbow Del](rainbow-del.md) now removes
specific/all tables through that same live palette-row selection, without changing
bitmap pixels or committing staged geometry. Set Rainbow supports empty component strings,
the form Wonderland uses before filling the table with Rain. Nonempty pattern
strings reject; their generation grammar remains a reference-verification gate.

There are four independently owned tables, numbered 0–3, with 16–32699 entries.
The selected colour is masked to 0–31 and must lie in 0–15. Six-argument creation
fills black; the seven-argument form fills its initial 12-bit colour. Rain reads
integer colour words and masks assignments to `$fff`. Bounds and types are checked.

`Rainbow n,base,y,height` selects table position and physical row range. Omitted
base/y/height keep their values; an out-of-table positive base keeps the old base,
as in the source. Row y is clamped to at least 28. Height zero disables the range;
positive ranges wrap table indices. The current subset bounds y to 0–311 and
height to 0–312, and rejects active NTSC placement pending EcYBase verification.
At an overlapping row, the lowest-numbered active rainbow wins, matching the
source's slot scan. The normal screen colour is restored when its range ends.

Canvas uses the same row/table selection for indexed, EHB and HAM colours.
Physical snapshots compile these values as copper palette MOVEs before pixel
fetch, including restoration and the PAL line-255 fence. The builder accepts
bounded `paletteRows` descriptors, merges them with screen setup and checks the
combined pre-fetch budget. Unsupported scheduling fails explicitly.
The resulting immutable line palettes are shared by CPU and GPU; there is no
post-render RGBA effect or GPU-only approximation. `snapshotPlayfield` remains
the static full-bitmap migration API; rainbows belong to `snapshotDisplay`.

## View staging and cursor

Auto View Off/On (`$0b20`/`$0b34`) stage and commit screen open/close/selection for
presentation. The previous presented screen object and physical bytes remain
owned while a replacement is pending. View (`$0b16`) commits explicitly without
reenabling automatic view. Canvas and the default physical snapshot follow the
presented screen; explicit screen-number exports remain available for inspection.
The selected logical screen can therefore differ from the presented screen.

This is a static presentation contract, not exact VBL display-list timing or a
complete implementation of AMOS screen-window commands. Pixel writes to a live
physical buffer remain visible; Auto View Off does not freeze all rendering.
Rainbow/palette timing is not deferred as a cycle-accurate display list update.

Curs Off (`$1446`) records text-cursor visibility as false; Load Iff does likewise.
Blinking text-cursor rendering is still absent. Mouse-pointer visibility remains
the separate existing Hide On/Show On contract.

## Evidence and checks

Semantics follow the pinned original project sources:
[`src/lib/iff.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/lib/iff.cpp),
[`src/w/rainbow.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/w/rainbow.cpp),
[`src/w/copperlist.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/w/copperlist.cpp),
and the original token tables. They are source evidence, not execution captures.

`tools/wonderland_goldens.py` independently decodes the original title ILBM and
the original AmSp bank, then composes the opaque menu Bob from source coordinates.
`title-setup.png` is hash-pinned separately from the four raw image goldens.
Node and Chromium compare every pixel after executing the real 64-line prefix
through a scheduled VBL continuation. The
[Wonderland demo](../demos/wonderland.html) opens on the executed Canvas title.
The GPU gallery also compares that exact frame with the independent image and
checks an active rainbow crossing PAL line 256. Including eight
[screen-window patterns](screen-windows.md), coverage is now 179 native GPU/CPU frames. All browser cases remain in the shared demo catalogue.

Remaining gates include whole-program menu/game integration, nonempty rainbow pattern
strings, NTSC rainbow timing, remaining AMSC placement, runtime laced loads, full screen
window/scroll integration and external Amiga captures. See [the milestone](wonderland.md).
