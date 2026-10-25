# Original Roller II board rendering

The [board inspector](../demos/roller2-boards.html) executes unchanged GAMEDISP
72–86, FDZ 57–62, ICCOPY 240–246 and entry calls 570. A declared Load/screen/call
harness supplies one original level and captures the procedure result. The
connected game path still stops after 600; it has not been joined to this fixture.

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

## Foreground integration remains gated

Original 601–602 uses Screen To Front and shows a 32-row window over the main
screen. Its palette differs from the underlying screen. The existing copper
builder rejects overlap and enforces pre-fetch setup budgets; this slice keeps
those gates. No CPU crop/compositor fallback is counted as GPU support.

The next integration must verify native priority/commit behavior, retain physical
bitmap ownership and offsets when resolving occluded rows, and prove palette/
pointer setup timing. CPU and GPU must continue to consume the same immutable
physical snapshot. Independent prompt pixels and a connected input-only replay
are required before moving the actual game guard beyond that display boundary.
