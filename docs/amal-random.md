# AMAL Z random words

`Z(mask)` now executes inside the manual AMAL controller. It is independent of
BASIC Rnd/Randomize, shares one stream across the factory's AMAL channels and
returns a signed word. The mask is a bit mask, not a maximum or a rejection
bound. For example, Z(10) can return only 0, 2, 8 or 10. Z(0) still performs a
draw and advances the seed; it does not repeat a cached value.

The source-derived recurrence is:

1. Evaluate the mask expression, including any nested Z calls.
2. Multiply the current unsigned seed word by $3171, retaining the full long.
3. Add the beam word and then 1 to its low word only, discarding both carries.
4. Save that low word as the next seed.
5. Logically shift the mixed long right by eight, AND its low word with the mask,
   and return a signed word.

Adding to the full long would change results when the low word carries. Normal
signed-word expression rules apply to masks and results; negative masks do not
disable hardware mixing. The seed update is independent of the selected mask.

## Host and lifecycle contract

A new factory starts with $1234, matching the native cold AMAL initializer. Its
normal portable beam word is zero. This models a fresh cold AMAL system, not an
assertion about an existing Amiga interpreter's seed at every RUN. Default,
AMAL Off, program replacement and Stop/Resume retain the stream position. Restart
creates a fresh factory. Basic Randomize/Rnd do not alter the AMAL seed.

The optional synchronous `readAmalBeam()` factory option supplies a 0–65535 word
for every Z call, including zero/negative masks. It is separate from the existing
BASIC `readRandomBeam` option. Invalid values, thenables and exceptions reject
before committing that draw or its containing assignment. Earlier completed
nested draws remain consumed. Returned diagnostic snapshots from
`program.amalRandomState()` are frozen independent `{seed}` records.

Recursive Synchro from a beam callback rejects. Retiring/replacing the executing
channel, closing its target or stopping/defaulting its VM during the callback
invalidates the pending draw and prevents old instructions from continuing.
Ordinary VM failures retain executing AMAL character/installation context and
clear owned programs and wakes. The controller creates no timer or RAF work.

The primary source is
[`+W.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BW.s),
`AmHaz`, `AMALInit` and `ClrAMAL`. The
[AMAL manual](https://amospromanual.dev/07-06-amal.html) describes Z's mask behavior.
The implementation requires an explicit parenthesized mask, as the native parser
path used by Zybex does. Beam zero and the controlled words below are replay
choices, not Amiga beam/timing captures or claims of uniform random output.

## Original hunter preview

Choose either **AMAL random hunters** option in the
[Zybex demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex.html).
The first uses the portable zero beam; the second supplies the constant 65535.
Both play the three unchanged channel-23/24/25 strings and setup from original
291–308. Original Load/Unpack and manual housekeeping remain intact. A hidden,
blank screen 2 provides coordinate geometry; the Bobs draw on the level-1 world
bitmap with its viewport at x=320. Declared RN=250, RX=288 and RW=130 replace the
omitted scrolling/player inputs. A synthetic eighty-pass loop/key guards replace
the game loop; waits are slowed by 3×. No running-game variables, IPs or banks are
patched, and there are no prepared bullet hits in these views.

The three programs consume Z in channel order to decide launch, movement speed
and delay. Independent reference output ends at score 30/seed 12997 after 81
draws for beam zero, versus score 60/seed 35380 after 160 draws for beam 65535.
These exact outcomes belong to the declared fixture, not full native gameplay.

`tools/reference/planet-zybex-amal.py` now also produces three 52-draw word/mask/
beam vectors and a separate generator-based reference for the original hunters.
It decodes raw image 34 and the packed world independently. Both beam choices
have 81 complete state/bitmap/viewport records and five PNGs. Unit and real
browser tests cover **324 PAL/NTSC frames and 20 additional GPU comparisons**,
bringing Zybex to **108 GPU comparisons**. Tests cover shared ordering, nested
masks, carries, signed values, failure/cancellation, stream isolation and lifecycle.

At this slice the full game reached computed Sprite 15 creation. That allocator
is now implemented; ship input/animation also pass isolated and bounded connected
replays. See [computed Sprites](computed-sprites.md) and
[AMAL input/animation](amal-input-animation.md). These hunter fixtures
do not establish connected gameplay or native interrupt/beam capture parity.

The [coordinate correction](planet-zybex-progression.md) changes the prepared
hunter target from Y=130 to the native YS(2,130)=80 on its origin-50 screen.
The independent reference uses Move delta -36 and regenerates its pixels/locals;
random draws, seeds, delays, scores and original source strings remain unchanged.
