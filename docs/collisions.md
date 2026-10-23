# Bob collision detection

`Bob Col(number)` tests one Bob against other Bobs on its owning screen.
`Bob Col(number,first To last)` restricts the targets to an inclusive range.
The source is excluded from its own targets. The result is -1 if any masks
overlap and zero otherwise. Every valid call replaces the previous hit table,
including calls with missing/hidden objects, no masks or an empty target range.

`Col(number)` returns -1 if that target was hit in the last test, or zero if not.
It reads historical results; moving/removing a Bob does not recompute them.
Negative arguments search for a hit at or above the argument's magnitude.
For example, Col(-1) finds the first hit numbered 1 or higher, while Col(-3)
starts at 3. Searches do not consume results. This means Col(-1) skips Bob zero;
use Col(0) to test it. No hit returns zero.

## What is compared

Collision tests compare the image masks at the current stored Bob coordinates,
offset by the image hotspots. Bounding boxes only bound the pixel search;
overlapping transparent margins do not count as contact. An image with no
existing mask, including an image whose mask was disabled with No Mask, does
not participate. Make Mask creates one explicitly. The drawing/update path also
creates the default Bob mask when it processes the image. A queued Bob command
alone does not create a mask in this implementation.

Tests use current coordinates, including movements queued with Bob Update Off.
They ignore the presented/logical screen pixels, selected drawing planes,
minterms, visibility limits and screen edges. Thus an off-screen or completely
clipped Bob can still collide. Different owning screens never collide, and
image zero hides the Bob from collision tests.

The original routines use the image's existing mask orientation and hotspot;
querying a pending Hrev/Vrev image number does not itself flip it. Drawing or
an off-screen Paste Bob can change that stored orientation. Bobs sharing one
image therefore share its current mask, even when their requested image flags
differ. This source-derived behavior matters when using asymmetric hotspots or
different orientations of the same image.

## Word handling and errors

Bob Col arguments are nonnegative integers. Negative source/range arguments
raise an error before changing the hit table. Source and target-range comparisons
use the low sixteen bits, matching the original entry points. Col's nonnegative
argument selects its low eight bits. Negative Col searches at magnitude 255 or
above return zero. Coordinates, hotspot subtraction and bounding edges follow
signed-word handling. Very large or wrapped image regions still need broader
hardware reference coverage.

Each generated program has its own result table. Calls have no timer or drawing
side effects. Unsupported sprite, cross-type and hardware collision commands
remain explicit compilation errors; they are separate work from Bob Col.

## Evidence and checks

The [collision manual](https://amospromanual.dev/07-04-detecting-collisions.html)
describes mask-based overlap, ranges and Col. Original
[+W.s](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BW.s)
`BbColl`, `ColRout` and `GetCol`, with the
[+Lib.s handlers](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BLib.s),
inform the cached-mask, coordinate, result-table and word-handling contracts.
These are source/manual-derived expectations, pending AMOS execution comparison.

Tests cover transparent overlap, one-pixel contact, range endpoints, missing
masks, stored flip orientation, hotspots, queued/off-screen coordinates,
per-screen ownership, status retention/searches, instance isolation and errors.
An independent raw-byte conformance fixture records one-pixel collision followed
by transparent overlap. The synthetic Bobs.AMOS demo stores HITSTART/OTHERSTART
and HITEND/OTHEREND; Chromium verifies -1/1 before movement and 0/0 afterwards.
