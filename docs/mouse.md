# Mouse limits, polling clicks and Canvas hardware coordinates

Implemented forms are `Limit Mouse`, `Limit Mouse screen`, `Limit Mouse x1,y1 To
x2,y2`, and the integer query `Mouse Click`. They share the headless runtime and
existing argument conversion. No browser is needed for injected mouse input.

## Limits and query semantics

The rectangle form requires an open current screen. Its coordinates follow the
original word operations, in order: take unsigned low words; cap upper x/y at
458/312; replace negative signed lower words with zero; then swap reversed
endpoints. The resulting limits are inclusive. For example, `(900,900) To
(999,999)` becomes `(458,312) To (900,900)` because normalization follows upper
capping. Equal endpoints are valid. Defining limits does not immediately move the
mouse; the next `setMouse`/host pointer update clamps its position.

Bare Limit Mouse captures the current screen; the numbered form supports 0–7.
It uses the full bitmap extent and hardware origin, halves hires width through
the shared coordinate helper, then applies the rectangle rules above. Window
cropping and source offsets do not shrink or shift this captured extent. Bounds
are per program, not per screen, and survive selection, closure, replacement and
Stop. They do not update automatically with later screen geometry. Bare Limit
Mouse is a screen limit, not an unlimited-mode command. No operating-system cursor
warping or physical pointer confinement is attempted.

Mouse Key and Mouse Click use AMOS/DOM button bits 1 left, 2 right, 4 middle.
Mouse Click computes `now AND NOT previousQuery`, then saves `now` for its next
query. Repeated reads while held return zero; reading Mouse Key does not consume
or update this history. A complete press/release between queries is missed, and a
release/repress can be missed when no query observed the release. This is a
polling comparison, not an accumulated event queue or destructive click latch.
Clear Key and Key Speed leave mouse state/history alone.

Stop, End, failure and host `clearMouseButtons()` clear held buttons and click
history, preserving position and limits. Canvas blur/window blur, hidden-document
notification and detach clear owned mouse state too. Hardware-mode pointer input
while the host is unfocused, stopped or halted is ignored. The default local host
retains its earlier pointer forwarding behavior, including after completion. Resume/focus do not invent a physical
button state: a subsequent pointer event supplies it. Direct headless injection
remains an explicit host operation.

## Explicit coordinate migration

The existing default `createCanvasHost(canvas)` and `mouseCoordinates: 'screen'`
retain the prior selected-screen/local pointer mapping. Programs using Amiga
hardware-coordinate mouse expressions opt in:

```js
const host = AMOS_BROWSER.createCanvasHost(canvas, {
  mouseCoordinates: 'hardware'
});
host.attach(program);
```

Hardware mapping uses the committed physical raster's origin and extent, before
selected-screen offsets. Split-screen gaps count as raster rows; mixed normal and
hires screens share low-resolution hardware x units. Selection, source scrolling
and staged geometry do not retarget input; View commits new geometry. A snapshot
of default-screen geometry also prevents Auto View Off changes from moving the
input origin before View. CSS content size, borders and transforms are handled
through the existing Canvas content-box path. Invalid modes or a program without
the hardware mapping helper fail explicitly.

`program.setMouse(x,y,buttons)` still injects coordinates directly, without an
implicit local/hardware conversion. With limits active, injection clamps in the
same units as the mouse queries. Use the hardware Canvas mode for programs whose
Limit Mouse and X/Y Mouse expressions use hardware coordinates. These changes do
not implement pointer locking, browser letterboxing, relative movement, X/Y Mouse
assignment, Hzone/Mouse Zone, or GPU host switching. Legacy unbounded headless
injection and all existing local-coordinate demos retain their previous units.

## Wonderland and evidence

The declared fixture joins unchanged Wonderland screen setup (351–362), editor
zone/limit setup (371–379), and Mouse Click/Zone/action-selection statements
(387–392). Synthetic game/background inputs and a Repeat/Wait Key guard reset the
action outputs between probes. The original Limit Mouse clamps hardware input;
the original expressions select `l`, `s`, `c` or Escape. No file loading/saving,
clearing, exiting, sprite loop or full editor action executes.

The [self-contained browser demo](../demos/mouse.html) uses the hardware Canvas
adapter with real browser pointer events. Deterministic probes cover five button
regions, query-history behavior, right/middle bits, inclusive limits, CSS scaling
and borders, selection/scroll independence, unchanged physical output, default
local coordinates, and five lifecycle paths. Live controls use a declared
synthetic 50 Hz polling harness to step the original selection slice, with
Stop/Resume/Restart. Gallery tests hold a real Chromium pointer button across polls
and check its selected action and cleanup. The page has an HTML Preview link in
the [demo index](../demos/index.html).

Pinned primary sources are
[`src/lib/sprites.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/lib/sprites.cpp)
for language dispatch and
[`src/w/mouse.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/w/mouse.cpp)
for `w_sy_mouse_limit`, screen extents, button bits and query history. Eight
execution groups cover bounds/words, all overloads, types/DATA/arrays/procedure
results, polling, factory independence, presentation staging and cleanup. An
independent-byte conformance fixture injects five mouse states at explicit Wait
Key guards and checks literal query results. These are source-derived and
injected/browser checks, not Amiga or physical-device captures.

Full Wonderland decoding now first stops at Rnd `$0686`, line 560, byte 21156.
Two encodings remain unrecognized, appearing 14 times. Complete gameplay/editor
compatibility remains open; see [the milestone](wonderland.md).
