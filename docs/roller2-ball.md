# Original Roller II initial ball and board

The [ready and initial-ball demo](../demos/roller2-ready.html) now executes the
connected original startup/menu, GAMEDISP and ready-input loop, then unchanged
609–617. Original BALLFARBEN 197–204 sets the ball colours on hidden screen 1;
610 creates sprite 1 at hardware (208,194) using image 2, fades screen 0 to screen
1's captured palette and waits 30 fields. Original BDRAW 87–102 draws the three
status-border colours on rows 192–196 with VBL waits. Original 617 resets Timer
and direction multipliers. A synthetic Wait Key/End guard follows 617 before
JOAB at 619. The original mouse/Fire exit chooses the ball; no variable or IP
changes advance it past the ready loop. The harness only selects Game and releases
the menu input. The earlier menu and ready-only unit fixtures keep their declared
post-600 and post-608 guards.

This is visible first-level initialization, not movement or collision gameplay.
Whole-source compilation still stops at Boom; Key State and the larger movement,
pause, tile and game-over dependencies remain open. Original source and assets
are unchanged, and only reached procedures are included in this bounded fixture.

## Direct sprite planes

The source image is 16×16 with six planes. Native `src/w/sprites.cpp` at pinned
revision `7f32e0abe1b6b415c9502b598cd3e4cb131018f8`, HsAd3/HsAd4 and
HsAdP2/HsAdP3, branches on `planes >= 4` and makes two two-plane column copies.
Thus five/six-plane images still publish only their first four planes. The bridge
now accepts supported image depths 1–6 and retains the original bank's complete
indexed pixels; Bobs and serialization are unaffected. Hardware transparency is
determined after selecting those four bits. Bits above bit 3 cannot make a zero
hardware code opaque or select another palette group. Logical sprite 1 still
consumes a blank physical channel 1 before the attached pair 2/3. The low four
planes select palette 17–31; BALLFARBEN updates 17–19 for this ball.

One/two-plane and three-plane behavior, odd-channel allocation, cursor reservation,
manual update freezing and per-factory state retain their existing contracts.
Widths above 16, depths outside the decoded 1–6 range, computed allocation and
exact sprite DMA/bus timing remain unsupported. No new hardware colours or wide
sprites are inferred from the additional stored planes. The foreground prompt is
hidden before the ball is created; sprites across priority setup rows remain
explicitly gated. See [sprite display](sprite-display.md) and
[screen priority](screen-priority.md).

## Independent evidence

`tools/reference/roller2_ball.py` imports only the independent Python asset/panel
oracles, reads raw AmIc/AmSp/AmBk bytes, and composes the first map, retained masks,
source ball palette, low-four-plane sprite, EHB colours, rainbow status text and
BDRAW border. It writes `ball.json`, three ball/fade PNGs, a separate idle-loop PNG and image hashes. The first two
images clamp each captured palette component to fade steps 2 and 7 before the
border; the final image has the complete palette and border. The controlled input
is injected at 4700 ms, with snapshots at 4800, 5000 and 5400 ms on the existing
portable 50 Hz clock. These timings and the portable font/origin are declared
runtime choices, not native busy-loop timing or Amiga captures.

Headless tests compare every output pixel and independent physical sprite words,
all original BALLFARBEN branches (including -2 and an unrecognized colour),
unrelated palette registers, bank ownership and Stop/Resume during the fade.
Stop freezes the VM wait and tracker; resumed Fade reconciles elapsed fields
under its existing contract. Independent literal five/six-plane banks exercise
high-bit-only pixels that must remain transparent, without a production encoder.

The shared Chromium scenario now checks eighteen Canvas frames across mouse,
keyboard and injected browser Gamepad exits. Six actual WebGL frames cover prompt,
hiding/blinking, two fade stages and the completed board/ball, with CPU
presentation disabled during GPU execution. The demo retains WebGL by default,
a labelled Canvas fallback, stable fullscreen, Stop/Resume and Restart. MOD timing
continues silently in this preview; optional live sound remains in the menu demo.
All browser checks remain available offline in the repository and through HTML
Preview links from the gallery.

Next: original JOAB input and the first movement/tile-handler path, starting with
Key State and its exact usage, Copy/Fill and the actual reached label dependencies.
Do not infer gameplay from the initialized Timer or visible stationary ball.

The separate [input fixture](roller2-input.md) now continues through JOAB 639,
with countdown/toggles and guarded movement dispatch; this ball fixture retains
its post-617 guard.

The separate [movement fixture](roller2-movement.md) now continues through the
original floor/stop/Lasttest path to a colour-handler guard. This initializer
retains its post-617 guard.
