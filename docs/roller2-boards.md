# Original Roller II board rendering

The [board inspector](../demos/roller2-boards.html) executes unchanged GAMEDISP
72–86, FDZ 57–62, ICCOPY 240–246 and entry calls 570. A declared Load/screen/call
harness supplies one original level and captures the procedure result. The
earlier menu fixture still stops after 600; the separate connected ready fixture
now runs through 608 without this inspector’s palette restoration.

GAMEDISP first fills the 20×12 cells with `colourByte*3`, then pastes their icon
numbers in original x-major loop order. Original entry copies update icons 18/29
while retaining their masks. The source predicate counts tiles 3–14 or 51 and
returns that integer; no gameplay meaning is inferred from the count. Level bytes
remain unchanged. The board is 320×192 inside a cleared 320×200 preview.

The routine begins with original FDZ and leaves the palette black. After a guard,
the harness explicitly restores the icon palette for visual inspection. This is
not the original game's later Fade To/ball-colour sequence. Sprite/ball setup,
foreground prompt, game HUD, movement and gameplay are excluded. The files are
the fifteen supplied maps (1–11, 16, 17, 20 and 100), not fifteen consecutive
playable levels. The preview is silent and does not modify or persist files.

## Independent evidence

`tools/reference/roller2_boards.py` decodes raw AmIc planes and AmBk level bytes
without AMOScript imports. It applies the entry copies, original mask occupancy,
background fills, ordered pastes and EHB component rules. It writes fifteen PNGs,
indexed/RGBA hashes, source hashes and source-derived counts in
`test/fixtures/roller2/boards.json`. These are asset/source expectations, not
Amiga execution captures or full-game screenshots.

Four headless groups check every map's indexed hash, complete RGBA image and
procedure count, unchanged map bytes, factory ownership, Stop/Resume during FDZ,
and source-context failure for an invalid prepared tile. Original files stay intact.

The shared browser evaluator checks sixteen Canvas frames: a black palette after
level 1 drawing, then all fifteen coloured previews. Two actual WebGL frames
match CPU snapshots with CPU presentation disabled during rendering. Native PNG
decoding supplies independent pixel expectations. GPU evidence is local Chromium/
SwiftShader execution, not target-device performance or external captures.

The live inspector defaults to WebGL, labels Canvas fallback, and supports level
selection, reload and fullscreen in a stable container. Controls run a bounded
injected clock (700 ms through drawing, then four ms through palette restoration),
not wall-clock/native busy-loop timing. Every browser check is runnable from the
repository demo and linked through HTML Preview from the gallery.

## Connected foreground integration

The separate [connected ready fixture](screen-priority.md) now runs original
GAMEDISP and the foreground prompt through 608, keeping the original black
palette and guarding before ball/sprite/gameplay setup. It resolves bounded
priority slices through real DMA-disabled setup rows and the shared immutable
copper snapshot, with independent prompt pixels and three GPU comparisons.
This coloured inspector retains its declared palette restoration and all-map
scope. Wider overlays, active sprites and exact native timing remain open.
