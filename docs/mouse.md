# Mouse limits, polling clicks and Canvas hardware coordinates

Implemented forms are `Limit Mouse`, `Limit Mouse screen`, `Limit Mouse x1,y1 To
x2,y2`, and the integer query `Mouse Click`. They share the headless runtime and
existing argument conversion. `X Mouse=expression` and `Y Mouse=expression` now
set one axis after an explicit Limit Mouse establishes bounds. No browser is
needed for injected mouse input.

## Limits and query semantics

The rectangle form requires an open current screen. Its coordinates follow the
original word operations, in order: take unsigned low words; cap upper x/y at
458/312; replace negative signed lower words with zero; then swap reversed
endpoints. The resulting limits are inclusive. For example, `(900,900) To
(999,999)` becomes `(458,312) To (900,900)` because normalization follows upper
capping. Equal endpoints are valid. Defining limits does not immediately move the
mouse. The next coordinate poll (`X Mouse`, `Y Mouse`, or `Mouse Zone`) or
`setMouse`/host pointer update clamps both axes to the current limits. Coordinate
polling preserves held buttons, click-query history and text/raw keyboard state;
it never invents a click. Without limits, coordinates remain unrestricted.

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

## X/Y Mouse assignment

Statement context accepts `X Mouse=expression` and `Y Mouse=expression` while
expression context keeps the existing integer queries. The expression evaluates
once and uses the shared numeric-to-integer conversion, including truncation of
float and boxed Val results. Static strings reject at compilation. The native
`EntNul` value −2147483648 leaves the axis unchanged.

The assignment doubles the value into an unsigned sixteen-bit word, clamps it
first to the doubled lower bound and then to the doubled upper bound, and halves
it again. With x bounds 128–447, −1 assigns 447, 32768 assigns 128, and 65536
assigns 128. This is deliberately different from unrestricted host injection.
Only the selected axis changes: held buttons, Mouse Click query history, the
other axis, limits, bitmap pixels and presentation remain untouched.

Assignments require an explicit Limit Mouse command; native startup/configuration
bound discovery is not emulated. A missing bound fails with source context,
except the no-op EntNul case. The runtime does not warp the browser cursor or
manufacture a pointer event. A later real pointer event supplies a new position
through the existing adapter, subject to its limits. Stop/blur cleanup preserves
the assigned position while clearing held input as before.

The shared [mouse demo](../demos/mouse.html) also runs original Roller II LIMM
(call 288 and definition 69–71) and movement statements 299–303. A synthetic title
load and Repeat/Wait Key gate permit bounded individual steps, without zones,
selection branches, other menu setup or gameplay. Four directions, opposing
inputs and both limit corners give fourteen keyboard/injected-Gamepad steps in
Chromium. Each original direction changes the matching axis by two; active Joy
waits for VBL. The title bitmap is preserved. The captured title frame is a Canvas
input check, not additional GPU execution or an Amiga capture. The demo still
provides the existing live Wonderland button-selection harness.

These assignment rules were checked in `src/lib/sprites.cpp` and
`src/w/mouse.cpp` at pinned revision
`7f32e0abe1b6b415c9502b598cd3e4cb131018f8`. Four new headless groups cover independent
word vectors, numeric types/DATA/arrays/procedure results, single expression
evaluation, errors, factory/lifecycle isolation and the original Roller II slice.

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
not implement pointer locking, browser letterboxing, relative movement,
Hzone or Mouse Screen. [Scin](scin.md) now scans live priority windows; bounded
GPU host switching is implemented. Mouse Zone now follows the
current screen’s live hardware window and offsets; see [zones](zones.md). Legacy unbounded headless
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

The unmodified Wonderland source now compiles completely. Controlled game entry
now runs and renders a bounded first-level loop for two nominal seconds; see
[the milestone](wonderland.md) and [selector/whole-program evidence](file-selector.md).

[Change Mouse](change-mouse.md) now maps built-in shapes 1–3 to owned browser
arrow/crosshair/wait cursors independently of Hide/Show nesting. Configured native
artwork and sprite-bank pointer forms remain gated.


## Idle coordinate polling and Bump

The native `MLimA` routine only installs bounds, while `MousInt` clamps the stored
position on every mouse interrupt, including fields without motion. The portable
runtime reconciles limits at synchronous coordinate polls as well as host pointer
updates. This avoids leaving the factory's initial `(0,0)` outside positive
limits indefinitely while waiting for a browser event. Native interrupt phase and
OS cursor warping remain outside this model. Mouse Zone checks that its screen
exists before reconciling coordinates; a failed screen lookup does not move them.

Original `Bump.AMOS` sets bounds 1–160 and immediately uses X Mouse as its Circle
radius. Previously this read a stale zero and failed at line 51, byte 1502. It now
starts at radius one without injected pointer motion. The source and Circle's
positive-radius check remain unchanged. The [browser regression](../demos/bump-runtime.html)
uses hardware-coordinate pointer events to select radius 80, completes the
64,000-pixel deformation pass and exits with a real Canvas key event. Four actual
GPU comparisons and 61,344 independent image-region/axis/startup pixel checks
cover the route; full native raster, float and timing equivalence remain open.
