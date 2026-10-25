# Roller II intro and main-title image

The [intro demo](../demos/roller2-intro.html) now runs unchanged original lines
1–20, including the first FLOAD, WTIN and FDZ, with their original definitions
(FDZ/FLOAD 57–68, WTIN 163–165). WTIN polls Mouse Click, Fire(1) and Inkey$ through
the ordinary cooperative VM budget. A key, mouse-button edge or gamepad fire
leaves that loop; FDZ then fades the logo out and Show On restores the pointer.
Keyboard input is consumed by the original Inkey$, not a harness variable/IP edit.

A declared fixture then executes the unchanged main-title FLOAD call from line
287, skipping initialization 21–286, and stops at a synthetic Wait Key/End guard.
This handoff is not the complete source control flow. The original zones/menu,
highscore initialization and gameplay are not executed; clicking Start on the
displayed main title does not start a game. The live preview is silent while
logical tracker commands continue. It defaults to WebGL, labels Canvas if WebGL
is unavailable, and supports fullscreen, Stop/Resume and Restart.

## Explicit Fade palette lists

`Fade speed,colour,...` now accepts one through 32 integer colour expressions.
Nonnegative values use their low twelve bits; negative values and omitted tail
entries leave those registers out of the captured job. Every supplied expression
evaluates once, left to right, before dispatch; no values are replayed on later
fields. DATA/scalar/array/procedure integers and dynamic Val integer results use
the same rules. Static floats/strings reject at compilation; dynamic float Val
results reject before replacing a current fade. Native float colour bit-pattern
quirks and lists longer than 32 remain unsupported.

Both original FDZ branches supply **32** colour values (the speed is a separate
argument). The positive branch targets black; the negative branch uses Abs(sp)
as its packed colour and speed four. This does not require emulating an overflow
write. A shared fade initializer preserves the existing next-VBL phase, component
steps, Flash ordering, captured goals, bounded catch-up and lifecycle cleanup.
Fade To bank/mask forms and wrapped speeds remain open.

## Tall Load Iff presentation

The main `roller titel` ILBM has a 320×512 six-plane EHB bitmap and no AMSC chunk.
Explicit new-screen Load Iff now gives a tall, 320-pixel nonlaced lowres bitmap a
bounded managed window. It retains every bitmap row and its original plane stride.
Using the established portable default y=50, the native tall-screen correction
DefWY2=DefWY−8 places it at y=42; x=129 rounds to 128. Native exclusive end rows
310 (PAL) and 260 (NTSC) produce window heights 268 and 218 respectively. The
unchanged original 256-row loader behavior and implicit destination geometry
remain as before. Other tall widths/hires retain their existing load behavior
and require explicit supported window geometry before physical presentation;
the new automatic window policy is limited to 320-pixel lowres images.

The CPU/copper and WebGL paths consume that same window snapshot. EHB colours
halve each four-bit base component after palette fading. Tests cover main-title
fade-in, its complete independent indexed bitmap, and a declared offset-240
viewport over rows 240–507. That scroll probe exercises storage/presentation; it
does not claim the original highscore drawing/scroll routine ran. The complete
intro demo is PAL; the bare tall-title loader also has NTSC window tests. Native
configuration discovery, wider placement/priority, wrapped DMA and hardware
display captures remain open.

## Evidence and clocks

The independent Python oracle in `tools/reference/roller2_ilbm.py` now decodes
both pinned images. The main-title PNG, indices and hashes live in
`test/fixtures/roller2`; the first-image fixture remains byte-identical.
The browser uses native PNG decoding and independent indices to distinguish EHB
pixels during fades. Thirteen Canvas/copper states cover three input modes;
eleven matching snapshots run on actual WebGL, including hidden-screen clearing
and the lower-bitmap viewport. No CPU presentation fallback counts as GPU work.

Controlled tests inject a four-millisecond minimum host timer delay so WTIN's
zero-delay cooperative continuations cannot starve the fake field clock. They use
finite time/budgets. Input arrives at 1000 ms, FDZ starts at 1004, reaches black at
1860, and returns at 1904. The declared main-title load fades from 1940 to 2780;
its separate completion check finishes by 2840. These timestamps belong to that
injected clock, not an Amiga execution capture or exact native busy-loop timing.
The live VM uses normal host timers; AMOS palette/music time remains independent
of requestAnimationFrame.

Native rules were checked at pinned revision
`7f32e0abe1b6b415c9502b598cd3e4cb131018f8`, using `src/interp/graphics.cpp`
(integer/negative palette entries), `src/w/screens.cpp` and `src/w/startup.cpp`
(default placement), and `src/w/copperlist.cpp` (field clipping). The current
external reference checkout has advanced; these claims use the pinned contents.
