# Get Icon and Roller II requester backups

`Get Icon n,x1,y1 To x2,y2` (`$1cc6`) captures the current screen;
`Get Icon screen,n,x1,y1 To x2,y2` (`$1cde`) captures an explicit screen without
selecting it. Numeric arguments use the ordinary integer conversion, evaluated
once in source order. Both forms populate icon bank 2.

The supported rectangle is nonempty, nonnegative and entirely inside the source
bitmap, with exclusive right/bottom edges. Coordinates are bitmap coordinates;
window geometry, screen offsets, palette effects and hardware sprites do not
enter the capture. The stored width rounds upward to a multiple of 16 and each
row's extra pixels are zero. Height is y2-y1; depth captures every source plane,
including the sixth plane on EHB screens. New image hotspots/orientation are zero
and the image is unmasked. A later Make Icon Mask derives transparency from its
pixels, including zero padding.

Capture reads logical indexed pixels exactly as stored, without drawing hooks,
Autoback replay or Bob background restoration. A Bob held only in the physical
buffer is absent; after that buffer becomes logical its stored pixels participate.
The image owns a copy, so later drawing, Bob cleanup and buffer swaps cannot alter
it. No source pixels, palette, graphics/text cursor, selection or display revision
change. Capture does not obtain RGBA from a renderer or include CSS pointers.

A missing bank is created, intervening slots are null and existing images survive
growth/replacement. A new bank copies all 32 registers from the selected screen,
even when an explicit different source screen supplies the pixels. Existing bank
palettes remain unchanged. Replacement resets that image's mask/hotspots/orientation;
other image records and their masks retain their identities. Captures use the
existing bank writer/reader and raw planar bridge, so Paste Icon, Make Icon Mask,
Save and reload consume the same indexed data.

The bounded subset accepts image numbers 1–16383, ordinary open screen IDs,
rectangles within existing bitmap bounds and planar payloads below 65,536 bytes.
Wrapped selector/coordinate forms, replacing non-icon bank 2 and native allocation
failure side effects remain gated. Sprite/Bob capture commands are separate and
remain unsupported. All geometry, number, payload and bank-type checks precede
mutation. As with existing raw-icon shape changes, any successful replacement or
growth retires every virtual address for that bank. Other banks remain owned and
unchanged. Native address reuse or unaffected-image pointer retention is not
claimed by this portable address model.

Source evidence is pinned to AMOS-Professional-Official revision
`efddf2c9a09bf61a45b7b096a9be84630853c2b1`: `src/lib/sprites.cpp`
`grab_zone`, `grab` and `lib_in_get_icon5/6`; `src/w/bobs.cpp` `get_image`;
and `src/lib/banks.cpp` `bank_resize_images`. The source subtracts rectangle
endpoints, rounds width to words, clears right padding, captures EcCurrent planes,
resets hotspots and marks captured icons unmasked. New/grown table allocation
preserves existing records/palette or copies the selected screen palette for a
new bank. This is source analysis and a bounded indexed implementation; exact
blitter/DMA timing and external Amiga captures remain open.

The [browser demo](../demos/roller2-get-icon.html) runs original missing-level
line 480 or overwrite lines 490–491 on a declared six-plane striped screen with
the original icon bank/masks. Missing-level Exist returns false; WTIN and WTREL
are explicit Wait Key procedure guards. Its capture and restore statements are
unchanged. The overwrite preview captures/clears/displays through original lines,
then uses a declared synthetic Paste Icon restore. The initial 117-image bank
grows to include temporary image 118, width 112 and height 40 or 70 from original
106-pixel-wide rectangles. Neither fixture runs the editor loop, board setup,
requester input behavior, overwrite confirmation or persistence.

`tools/reference/roller2_get_icon.py` independently decodes raw icon planes,
builds the prepared stripe pattern and applies the original masked dialog/restore
operations. Six PNGs and full indexed/RGBA/captured-image hashes distinguish source
pixels, padding, opaque clears and masks. Seven headless groups cover both token
signatures, typed arguments/evaluation order, exclusive geometry, padding, palette
origin/retention, sparse growth, address retirement, atomic rejection, logical/
physical/Bob ownership, independent expected Save bytes, reload isolation and all
six original-fixture frames. The missing-level path also returns normally through
WTREL to an EDAB guard with empty procedure frames.

The shared browser scenario checks six independent Canvas images and six actual
GPU frames with CPU presentation disabled during GPU rendering. It validates the
captured image metadata and every source/padding pixel. Offline controls cover
both requester previews, fullscreen, restoration and Restart. The gallery has an
HTML Preview link. These are source/fixture and CPU/GPU comparisons, not native
requester or full-game reference execution.

Whole-source compilation now stops at slot-1 Music `$0058`, original line 992,
byte 54202. Three of 194 token encodings remain unrecognized; whole-game/editor
integration and end-state AMOS Music remain acceptance work.
