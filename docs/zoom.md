# Zoom

`$10d6` implements the ten-numeric-operand statement:

```basic
Zoom source,x1,y1,xEnd,yEnd To destination,x2,y2,x2End,y2End
```

The signature-driven parser builds a display AST with To before the sixth
operand. Ordinary lowering evaluates operands left-to-right, once each, with
shared integer conversions. Strings and omitted operands reject. Runtime
failures halt with the original instruction's line/byte location.

## Geometry and sampling

Rectangles have exclusive right/bottom ends and strictly positive extents.
Both must fit wholly within their bitmap dimensions. Unlike Screen Copy, the
original InZoom rejects out-of-bitmap rectangles instead of clipping them.
Negative, reversed, empty and wrapped forms reject before mutation. The subset
accepts nonnegative coordinates within signed-word bounds and requires the native
two-byte tables, including terminators, to fit 4 KiB:
`2*(destinationWidth+destinationHeight+2)<=4096`.

For source length S, destination length D and destination-relative coordinate i:

- Shrinking, S>D: source coordinate is `ceil((i+1)*S/D)-1`.
- Enlarging or equal size, S<=D: source coordinate is `floor(i*S/D)`.

Reducing three cells to two picks `[1,2]`; enlarging two to three picks `[0,0,1]`.
Each axis samples independently. This follows ZooTab's carry recurrence, not a
browser canvas interpolation mode.

## Ownership and aliasing

Plain screen numbers choose logical buffers; Logic/Physic integer selectors use
the checked Screen Copy resolver. Source lookup precedes destination lookup as
in InZoom's GetEc calls. Neither lookup changes selection. Common low planes are
copied; extra destination planes retain their bits. Raw indexed EHB/HAM codes
undergo no palette or resolution conversion.

Zoom preserves screen geometry, palettes, cursors, buffer identities, saved Bob
backgrounds and Autoback settings. The original implementation writes raw planes
without the GfxFunc wrapper, so it bypasses Bob restore/redraw and Autoback replay.
Even Autoback 2 does not implicitly update a second buffer. Screen Swap controls
publication separately.

Unlike the overlap-safe Screen Copy profile, Zoom retains live source feedback
when buffers alias. Traversal is destination columns, then planes, then rows;
duplicated rows reuse the fetched source bit. Overlapping writes can affect later
reads: shifting a row right can propagate its first pixel across the destination.
Static clone aliases behave the same way. No snapshot/memmove behavior is
substituted. Zoom completes synchronously at its ordinary instruction boundary;
requestAnimationFrame does not define its semantics or advance AMOS time.

## Evidence and limits

The assembled-library catalogue identifies `$10d6` and its exact signature.
Original [InZoom and ZooTab](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/%2BLib.s)
establish bounds, source-first lookup, common planes, tables and traversal. The
[screen manual](https://amospromanual.dev/06-02-using-screens.html) documents
resizing and Logic/Physic selectors. These are source-derived semantics, not a
native Amiga rendering/timing capture.

`python3 tools/reference/zoom.py` regenerates the
[independent fixture](../test/fixtures/zoom.json). It transcribes ZooTab's carry
decisions rather than the production closed-form expressions. Tests compare all
289 combinations of source/destination lengths 1–17 on both axes, plus exclusive
bounds, extra planes, explicit physical destinations, all Autoback modes, live
overlap/clone aliases, atomic failures, typed/DATA/procedure operands and ten
ordered host callbacks.

The unchanged 49-line RollerIIIntroIdee program runs with its supplied R.abk.
The oracle extracts raw AmIc planes, constructs 16 generated icons and simulates
the original loops on independent logical/physical buffers. All 17 bank images,
including the original, and all 29 frame hashes match. A real Canvas key event
completes the original final Wait Key; no VM variables/IP/banks are edited.

The [browser demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/zoom.html)
checks 4,352 icon pixels, 256,000 independently resolved Canvas pixels across
four frames and four actual GPU/CPU comparisons. CPU presentation is blocked
during GPU rendering. Select captured frames to inspect the animation. See the
[pinned example](../examples/Introideen/README.md) for source/asset provenance.

Out-of-bitmap/wrapped geometry, larger table profiles, arbitrary bitplane-address
operands and exact native interrupt/DMA timing remain outside this subset.
Supported selectors identify screen buffers, not raw memory addresses.
