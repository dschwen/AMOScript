# Moving Bobs

Moving Bobs use the Object bank (bank 1). They are drawn into the actual indexed
screen pixels, so Point observes the drawn image. This is separate from static
Paste Bob and from hardware sprites, which are not yet implemented.

## Commands and state

- `Bob number,x,y,image` creates or moves Bobs numbered 0–63. Coordinates identify
  the image hotspot. Omitted x, y or image arguments retain their previous values;
  a newly created Bob starts with zero values. Commas are still required. Image
  zero hides the image while retaining the Bob's coordinates and identity.
- `X Bob(number)`, `Y Bob(number)`, and `I Bob(number)` return the current fields.
  Coordinates and image queries follow the original signed sixteen-bit storage;
  an Hrev image number can therefore produce a negative I Bob result.
- `Bob Off number` removes one Bob; `Bob Off` removes every Bob.
- `Bob Col(number)` and `Bob Col(number,first To last)` compare existing masks;
  `Col` queries the last hit table. See [collision semantics](collisions.md) for
  mask timing, stored orientations and result searches.
- `Hot Spot image,x,y` sets an image's hotspot. The preset form
  `Hot Spot image,$xy` selects left/centre/right and top/centre/bottom using
  nibble values 0/1/2. For example, $11 selects the centre. Signed fourteen-bit
  X and sixteen-bit Y values are retained. Hrev/Vrev/Rev and masks use the same
  [image-bank state](banks.md) as static pasting.
- `Priority On` sorts Bobs on the current screen by Y, then X. `Priority Off`
  restores default Bob-number ordering. `Priority Reverse On/Off` reverses or
  restores drawing order. Higher numbers normally draw last and appear in front.

Creation binds a Bob to its screen. Selecting another screen before moving an
existing Bob does not transfer it. Close/reopen of the owning screen removes
the Bob and its saved background immediately. Each program has its own Bob Map
and background snapshots, exposed for inspection as `program.bobs`.

Invalid Bob numbers, missing images, wrong argument types and queries for missing
Bobs produce diagnostics. Missing-image rejection is deliberate; behavior for
invalid image requests still needs comparison against the AMOS interpreter.

## Updates and saved backgrounds

An update restores backgrounds in Bob-number order, saves all new screen areas
before any object draws, then renders the Bobs in priority order. Each snapshot
therefore contains the background rather than another Bob. Transparent and
mixed-depth drawing use the same rules as Paste Bob. Restored regions cover the
word-aligned horizontal footprint, clipped to the screen and Bob limits. No
storage is allocated for entirely off-screen images or no-erase modes.

`Bob Update Off` queues movements without drawing them. `Bob Update` performs
all pending movements on every owning screen immediately and swaps double-buffered
screens. `Bob Update On`
re-enables automatic drawing.

Automatic updates run at the end of an executing tick: when a wait yields,
the step budget is reached, or execution finishes. They do not create another
timer. This is a cooperative runtime approximation, not Amiga VBL interrupt
timing. Use explicit Bob Update plus Wait Vbl for deterministic animation.
Stopping the program freezes its execution and current picture; resuming retains
the scheduler's remaining wait. Program switching stops the old scheduler and
detaches its Canvas host.

For changing backgrounds, turn automatic updates off, use `Bob Clear`, draw
the new background, then use `Bob Draw`. These manual operations affect Bobs on
the currently selected screen. Drawing over a visible Bob without clearing it
can be overwritten by the old saved background on the next update. Double
buffering and Autoback are implemented as described in [the buffering contract](buffering.md).

## Set Bob drawing modes

`Set Bob number,background,planes,minterm` configures a new Bob. Omitted values
default to 0, all planes, and the default masked-copy operation. Commas remain
required. The original BobSet/ResBOB implementation installs these options on
creation; Set Bob on an existing object retains its options. Configure before
the first Bob command, or remove the object before recreating it with new modes.
This source behavior differs from some prose descriptions and still needs
comparison against the intended AMOS version.

Background zero saves and restores the selected planes. A positive background
clears the old rectangle to colour background-minus-one, affecting only selected
planes. A negative background leaves the drawn pixels behind. Solid clearing
includes the word-aligned rectangle and transparent areas, so it can cover
pixels outside the visible image. Each screen buffer keeps its own history.

Planes is a bit mask. Only selected planes within both the image and screen
depths are drawn or restored. Changes to other planes survive restoration.
The minterm is an eight-bit Amiga blitter truth table: A is the image mask, B
the source image bit, and C the destination bit. Bit `(A*4+B*2+C)` gives the
result. With No Mask, A is one throughout the image. Zero selects the default
$CA masked-copy mode; examples include $CC for B, $66 for B XOR C, $EE for
B OR C and $33 for NOT B. The truth table can affect zero-valued source pixels;
transparency is not forced for arbitrary minterms.

Hardware register residue and writes outside the image at blitter word edges
are not reproduced by the indexed renderer. These cases need targeted hardware
reference coverage before claiming bit-exact advanced blitter compatibility.

## Limit Bob

`Limit Bob x1,y1 To x2,y2` limits existing Bobs on the current screen.
`Limit Bob number,x1,y1 To x2,y2` selects one of them. `Limit Bob` resets their
limits to the screen bounds. The bounds clip visibility; they do not change
coordinates. Right and bottom bounds are exclusive. New Bobs do not inherit
limits applied before their creation, and Bobs on other screens are unaffected.

The implementation follows the original BobLim word handling: both X bounds
align downward to multiples of 16. Omitted bounds use screen edges. The original
validation compares bottom with the aligned left coordinate, rather than top;
for example, a rectangle from 32,0 to 64,16 is rejected. A rectangle with top
below bottom can pass that guard but has no visible drawing area. With no Bobs,
the routine returns without validating the rectangle. These unusual behaviors
are preserved as source-derived expectations pending emulator confirmation.

## Evidence and checks

The [Bob manual](https://amospromanual.dev/07-02-blitter-objects.html) and
[updating manual](https://amospromanual.dev/07-03-updating-objects.html) describe
identity, hotspots, priorities and saved backgrounds. The original
[+Lib.s](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BLib.s)
command handlers and [+W.s](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BW.s)
BobSet/ResBOB/BobAct/SpotH/BobLim routines inform storage, creation options,
priority ties, clipping and screen binding. BobAff saves backgrounds before
drawing; BobEff restores selected planes or clears them with colour bits.
The [Amiga hardware manual's blitter function generator](https://www.theflatnet.de/pub/cbm/amiga/AmigaDevDocs/hard_6.html)
defines the minterm truth table.
These are source/manual interpretations; emulator comparison remains outstanding.

Tests cover movement, overlap restoration, manual drawing, clipped images,
hotspots/flips, hiding, omitted values, screen ownership, priorities, input waits,
stop/resume, background modes, minterms, selected planes and independent command
bytes. `Bobs.AMOS` is a synthetic fixture
with an original embedded robot image. The browser's Moving Bobs button runs it;
press a key to present the hidden frame, again to animate, and again to remove
the objects. Chromium verifies
exact pixels at old and new positions, selected-plane XOR and the clipped right
border, and captures `test/artifacts/bobs.png`.

Remaining work includes hardware/computed sprites, sprite/cross-type collisions, AMAL, update
frequency controls, exact
hardware scheduling and further reference execution coverage. Unsupported
commands continue to fail explicitly.
