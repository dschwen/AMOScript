# Flash colour cycles and Flash Off

`Flash colour,pattern$` (`$0D44`) registers a palette cycle on the selected screen.
`Flash Off` (`$0D34`) removes every cycle owned by the selected screen. It leaves
its last palette values in place, preserves other screens' cycles, and neither
cancels Fade nor changes the selected screen. Both commands require an open screen.

## Bounded subset

Patterns contain 1–16 adjacent `(rgb,speed)` entries, such as
`(f00,2)(0f0,3)(00f,1)`. Each RGB component is one hexadecimal digit; letter case
and spaces inside components/speeds follow the bounded source grammar. Leading,
trailing or inter-entry spaces and malformed delimiters reject. Speeds must be
positive integers 1–32767. Zero, negative and oversized word cases reject rather
than emulating the original wraparound. Colours are registers 0–31, including
registers beyond the bitmap depth. An empty string cancels that colour's entry.

There are at most sixteen entries across all screens. The original checks full
capacity before finding an existing entry; replacement and empty cancellation
therefore also reject at capacity. Flash Off remains available. Within this
subset a new pattern replaces an entry for the same actual screen and register.
The original free-slot/table-hole allocation quirks are not emulated.

The first colour appears on the next nominal VBL. Its speed is the number of
VBLs before the next colour, and the list repeats. A one-entry pattern still
writes on each of its scheduled fields, so later Colour writes can be overwritten.
Starting or cancelling a cycle does not immediately recolour pixels.

**Screen Open's implicit colour-3 flashing is not implemented.** Existing screen
creation retains static default palettes. This subset handles explicit Flash jobs
and safely executes Wonderland's Flash Off, without claiming complete original
screen-initialization behavior. Palette shifts remain unsupported.

## Clock, ownership and presentation

Flash and Fade share one driver-owned palette wake, separate from VM execution.
They use the injected `now`/`setTimeout`/`clearTimeout` and `vblHz` clock at 50/60 Hz,
independent of Timer assignments, sleepScale and requestAnimationFrame. Cycles
continue during Wait/Wait Key without advancing the instruction pointer.

Late callbacks skip complete cycles and visit at most sixteen steps per job.
Combined Flash/Fade reconciliation resolves the last write to each register by
field number; on the same field Flash precedes Fade, as in the original VBL code.
This also preserves later Flash writes after a Fade completes. Fade continues to
use its captured components. Exact interrupt/DMA/display-list timing remains open.

Jobs retain actual screen identity. Changing selection does not retarget them;
closing or replacing a screen cancels its jobs immediately, including under Auto
View Off. Stop cancels host wakes and preserves the displayed palette and jobs.
Resume reconciles elapsed fields and rearms one wake. End/failure cancel all
palette effects; stale callbacks cannot revive them. Asynchronous failures retain
the responsible command's source location. Canvas detach alone does not stop a
headless program; callers disposing it must also stop it.

The palette changes through the common display model. Indexed bitmap bytes,
logical/physical identities, Autoback and Bob backgrounds stay unchanged. CPU and
GPU snapshots share those palette values; EHB derives half-bright values and HAM6
uses the updated base palette. Rainbow row overrides remain separate. Old
snapshots remain immutable. `state.flashes` is a frozen diagnostic list, separate
from source-language variables.

## Evidence and Wonderland

Pinned source evidence:

- [`src/lib/screens.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/lib/screens.cpp): Flash/Flash Off handlers and implicit Screen Open flashing.
- [`src/w/colours.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/w/colours.cpp): pattern parsing, capacity and selected-screen cancellation.
- [`src/w/vbl.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/w/vbl.cpp): first-step counter, durations, cycling and Flash/Fade ordering.

Eight execution groups cover types/DATA/arrays/procedure results, independent
factories, phase, bounded catch-up, mixed effects, capacity, cancellation,
geometry/modes, screen lifecycle, failure context and full original game/editor
screen setup. An independent-byte conformance case checks colour transitions and
Flash Off. The [shared browser demo](../demos/flash.html) checks fifteen synthetic
Canvas/CPU frames against independent uniform RGB values (460,800 Canvas pixels),
physical-buffer preservation, snapshot immutability and cancellation without an
animation callback. Live controls exercise Stop/Resume/Flash Off/Restart. Two
native GPU frames use independent red/green expectations. All pages have HTML
Preview links in the [gallery](../demos/index.html).

The screen-window fixture now executes unchanged Wonderland lines 351–362,
including its own Flash Off and Auto View On, with synthetic game/background
inputs and a Wait Key guard. The map-copy fixture likewise uses the complete
setup before its original five map loops. Neither executes its enclosing
Gosub/Return or gameplay. These are source-derived fixtures and CPU/GPU checks,
not Amiga execution captures. The whole source now compiles; controlled game entry reaches the
bounded two-second first-level run with attached sprites. See [the milestone](wonderland.md).
