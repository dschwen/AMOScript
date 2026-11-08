# WebGL2 HAM6

The WebGL renderer now resolves the same bounded HAM6 contract as the CPU
reference, including five-plane HAM, directly from planar chip textures. No
CPU-generated colour buffer or CPU fallback participates in a HAM GPU frame.
The snapshot ABI and raw AMOS bitmap commands are unchanged.

See the [implementation plan](webgl-ham-plan.md) and the runnable
[GPU HAM demo](../demos/webgl-ham.html).

## Colour history on the GPU

Every source command becomes a packed RGB12 value plus a 12-bit write mask in
an R32UI texture. Palette commands write all three channels. Blue, red and green
commands write just their component. Consecutive updates compose as:

```
mask = earlier.mask | later.mask
value = (earlier.value & ~later.mask) | later.value
```

This operation is associative. An inclusive scan doubles the preceding span
on each pass, ping-ponging between two owned R32UI targets. Each row is separate.
Resolution applies the accumulated update to that row's COLOR00, then overlays
sprites using the original raw command's playfield priority. Lowres samples
are duplicated only after their source command has been resolved.

The scan starts at the display-window origin, including a clipped prefix left
of the viewport. Scroll nibbles and signed fetch offsets use the same source-bit
fetch function as ordinary GPU planar decoding. Border/disabled rows retain
COLOR00; a sprite cannot affect the colour carried into later playfield pixels.

For a maximum active HAM source span of N, render uses
`3 + ceil(log2(N))` passes: ordinary raw-index decode, HAM update decode, scan
passes and colour/sprite resolve. N=1 uses three passes; N=4096 uses fifteen.
A frame without active visible HAM uses the existing two passes. Presentation
is its existing separate pass. These are pass counts, not device benchmarks.

## Bounds and lifetime

Lowres five/six-plane HAM is supported alongside normal/EHB/dual-playfield rows.
HAM with hires, dual playfields, other plane counts, AGA or mid-line events
rejects before GPU draws. Source history is capped at 4096 commands per row and
must also fit the device texture/viewport width. Fetches, palettes and sprites
are validated before replacing the retained frame.

Scratch textures follow source-span/field dimensions, are released on a normal
or empty transition, and share context loss/restoration/disposal ownership with
the other GPU textures. Restoration decodes the latest retained chip snapshot;
it does not reuse a stale CPU colour frame.

## Verification and limits

The demo runs 58 GPU frame comparisons, including independent Python ILBM/PNG goldens (raw, ByteRun1, five-plane
and both laced fields), long modify-only runs, palette resets, one-pixel and
4096-command limits, odd clipped prefixes, scroll/fetch offsets, mixed rows,
row palettes, sprite attachments/priorities, invalid inputs and context loss.
Golden bytes are comparison data only. GPU input is chip bytes and register,
palette and sprite tables. The non-HAM corpus remains a separate regression.
The original limited ASM intro now compares its HAM title on the GPU and its
packaged pages use WebGL through the intro-to-main transition.

HAM8, arbitrary mid-line events, hardware fetch history outside this bounded
window contract, exact Amiga beam timing and native captures remain open.
The existing explicit field composer remains responsible for weaving fields;
this change does not add live interlace timing.
