# Roller II first image and FLOAD

The original first image, `iffp/terminator el` (the “EL SOFTICUS presents” logo),
now loads and fades in through unchanged startup lines 1–18 and the original
FLOAD procedure, lines 63–68. A synthetic Wait Key before the copied definition
and End after it bound execution before WTIN. This is not the main Roller II
title/menu, the FDZ fade-out, or gameplay.

[Run the first-image demo](../demos/roller2-title.html). Seven controlled times
(20, 40, 100, 460, 880, 920, 940 ms) compare Canvas and physical copper output
against an independent image oracle. Seven actual WebGL host frames match the
same snapshots; a throwing CPU-presentation stub guards against GPU fallback.
The live preview defaults to WebGL, explicitly labels Canvas if unavailable,
and offers fullscreen, Stop/Resume and Restart. It runs silently while logical
tracker commands continue; audible MOD playback remains in the music demo.

## Original procedure behavior

FLOAD loads the requested screen, hides it and waits one VBL. It then clones the
screen, hides the clone, copies the palette, zeros all 32 original registers,
shows the original and fades to the clone's captured palette. After 45 fields
(speed three times fifteen), it closes the clone and returns. The original
bitmap bytes remain shared and unchanged throughout this palette-only fade.

The controlled fixture starts Fade at 20 ms, takes its first step at 40 ms, and
reaches full colours at 880 ms. FLOAD returns and closes the clone at 920 ms.
The fade's separate completion check at 940 ms still succeeds because its
destination palette was captured, rather than read from a live source screen.

Pop Proc (`$033c`) now exits the current procedure through the ordinary procedure
return control. It discards pending Gosubs belonging to that procedure, restores
the caller's locals/DATA and preserves caller Gosubs. Optional `[value]` uses the
same integer/float/string/dynamic Param boundaries as End Proc; no result leaves
Param unchanged. Outside-procedure and multiple-result forms reject. Ordinary
End Proc retains its unfinished-Gosub error. Source-derived tests include early
return from a local Gosub/For, caller DATA restoration and typed results.

## Screen storage and visibility

Screen Hide/Show, with or without a number (`$0aae/$0ac0/$0ac8/$0ada`), change
presentation membership without selecting, erasing or reallocating the bitmap.
Auto View Off stages those changes until View. Hidden screens remain usable as
palette sources and logical drawing targets. The existing managed-window stack
includes only visible windows. With no managed visible window, the selected
visible screen (or first remaining visible screen) is the portable fallback;
the full AMOS priority/overlap model remains open. An empty display clears the
browser host; a default physical snapshot still requires at least one screen.

Screen Clone (`$09d6`) supports static, single-buffer bitmap aliases with an
independent palette and display metadata, no zones, and unchanged selection.
Clones cannot be selected. Closing a clone preserves the owner and pixels.
Cloning a double-buffered owner, double buffering an owner with clones, and
closing/replacing an owner before its clones reject explicitly. These gates
avoid dangling or stale buffer aliases; general native clone/swap/lifetime
behavior remains open. No Bob ownership or buffer identity is swapped.

Get Palette (`$0b90/$0ba4`) copies all 32 registers or a supplied bit mask into
the selected screen. Source selectors use the existing ordinary/Logic/Physic
resolution and may name a clone, without changing selection. Palette arrays
remain independent even when their screens alias the same bitmap.

## AMSC and Fade To bounds

The pure ILBM reader now decodes an owned, frozen fourteen-byte AMSC record with
x/y, window width/height, source offsets and flags. Other AMSC lengths reject.
An explicit Load Iff destination applies validated placement; an implicit load
retains current geometry, following the original handler. The current placement
subset is lowres, full-bitmap windows 128–320 pixels wide (aligned to sixteen),
up to 256 lines, zero source offsets/flags and the existing x=128 coarse window.
Y and bottom bounds follow the existing PAL/NTSC screen-window contract. Unsupported
placement rejects before replacing a destination screen.

The first image stores `[129,42,320,256,0,0,0]`; native recomputation masks the
horizontal position to 128. The physical snapshot origin is therefore `(128,42)`.
Source-derived flags, offsets, cropped windows, hires and other AMSC forms remain
separate gates; bitmap decoding alone is not placement support.

`Fade speed To screen` now captures the source palette, including hidden clones,
and moves each differing RGB nibble one step toward its goal at the existing
field interval. Source closure or palette changes do not retarget that goal.
It shares fade-to-black lifecycle, Flash ordering, identity checks and bounded
catch-up. Sprite-bank destinations, masks, explicit colour lists, wrapped speeds
and native hardware timing remain open. FDZ's explicit colour lists still reject.

## Evidence

`tools/reference/roller2_ilbm.py` independently decodes the pinned ILBM with
Python ByteRun1/planar loops, imports no AMOScript code, and writes the checked
PNG/hash metadata in `test/fixtures/roller2`. The browser uses native PNG decoding.
Fade expectations clamp each original four-bit component to the current step.
These are source-derived image/timing expectations and CPU/GPU parity, not an
Amiga execution/display capture.

Native rules follow the pinned source revision documented by the milestone:
`src/interp/control.cpp` (Pop Proc), `src/lib/screens.cpp`, `src/w/screens.cpp`
(clone/visibility/palettes), `src/lib/iff.cpp` (AMSC), `src/w/copperlist.cpp`
(coarse x masking), `src/interp/graphics.cpp`, `src/w/colours.cpp` and
`src/w/vbl.cpp` (captured fade goals and per-nibble steps).
