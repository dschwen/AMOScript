# Raw icon-bank addresses and Roller II ICCOPY

`Start` now exposes a bounded virtual layout for icon banks. Generic data-bank
behavior is retained; sprite-bank addressing still rejects. The connected Roller II
menu now executes original game-entry lines 565–570, including both original
ICCOPY calls, before its game guard. Screen/level initialization after line 570
and gameplay remain open. No host variable/IP changes are used in that replay.

## Layout and ownership

The icon table has a two-byte image count, eight-byte entries, then 32 big-endian
palette words. Each entry's first long is a virtual image-record pointer (zero for
empty images). The second long is a mask pointer; accessing it currently rejects.
Count, pointer, palette and ten-byte image-header views are read-only. Raw table,
header and palette writes reject rather than changing allocation structure.

Records expose width in words, height, depth, hotspot/flip fields and contiguous
planes beginning at offset 10. Planes are packed from the existing canonical
indexed pixels on reads. Writes update those same pixels, not a shadow buffer.
Orientation and Save normalization therefore remain visible through stable pointers.
Paste Icon and Save consume the modified pixels; raw writes alone do not draw.
Masks remain separately owned and unchanged until explicit Make Icon Mask.

Virtual addresses use the same per-factory positive allocator as generic banks,
with disjoint checked regions and guard gaps. Swap preserves bank/table/record
identity. Reload, append, erasure and image/count/geometry replacement retire all
of that bank's regions; retired addresses are never reused. Append retirement is
an explicit portable bound, not a claim of native image-pointer retention on resize.
Only one live region may contain each complete access. Cross-record reads/writes
reject; headers cannot be partially overwritten through a multi-byte operation.
Raw Bsave validates its snapshot before truncation; Bload preflights before mutation.

The bounded layout supports word-aligned image widths, positive heights, depths
1–6, up to 32,768 slots and planar payloads below 65,536 bytes. Wider allocation
quirks, sprite addresses, pointer patching and mask memory remain open. These
addresses are not display DMA pointers or numeric Amiga addresses.

## Original inclusive copy and padding

Original ICCOPY (240–246) reads pointers at `Start(2)+2+(image-1)*8`, skips the
ten-byte header and loops **inclusively** through `source+32*6`. That copies 193
bytes: 192 bytes of a 16×16 six-plane icon plus one allocation-tail byte.
The native loader requests 202 bytes for each of these records. AMOS passes that
request to Exec AllocMem, whose chunk rounding is documented in the
[AllocMem autodoc](https://amigadev.elowar.com/read/ADCD_2.1/Includes_and_Autodocs_3._guide/node01E7.html);
the supplied `includes/exec/memory.i` defines MEM_BLOCKSIZE as eight. The matching
[C header](https://www.theflatnet.de/pub/cbm/amiga/amigadev.elowar.com/read/ADCD_2.1/Includes_and_Autodocs_2._guide/node0089.html)
records that chunk size too.

The bridge exposes exactly the rounded 208-byte region, including six opaque
padding bytes. Padding starts at deterministic zero per virtual allocation; native
MemChip does not clear it, so this is explicitly not a native heap-content claim.
The original 193rd byte is copied into owned padding, never pixel/mask data or a
neighbor's header. Unit probes plant a nonzero tail byte and verify its copy;
accesses at 208 or crossing that end reject. Serialization omits virtual padding.

Pinned native sources at `7f32e0abe1b6b415c9502b598cd3e4cb131018f8` are
`src/lib/banks.cpp` (table, Start, image sizes), `src/lib/bankfiles.cpp` (ten-byte
record loading), `src/w/memory.cpp` (AllocMem wrapper) and `src/w/bobs.cpp` (separate
masks and image orientation). Source analysis is distinct from Amiga captures.

## Evidence and demos

`tools/reference/roller2_icons.py` independently decodes pinned AmIc records and
planes without AMOScript imports. It writes the raw planar/pixel/header oracle
and before/after PNGs in `test/fixtures/roller2`. The synthetic preview pastes
icons 18, 29, 76 and 74 on a cleared EHB screen; after original calls `ICCOPY[76,18]`
and `ICCOPY[74,29]`, the oracle composes copied pixels with the original masks.

The [icon inspector](../demos/roller2-icons.html) runs the unchanged procedure and
original call line, with synthetic Load/screen/paste/Wait Key guards. Two Canvas
frames match independent PNGs; two actual GPU frames match the same CPU snapshots,
with CPU presentation disabled during GPU rendering. Its live Copy/Reset controls
use WebGL by default and a stable fullscreen container, with a labelled Canvas
fallback. Game screen/level setup is excluded. The browser test is the same
self-contained repository demo linked through HTML Preview from the gallery.

Five headless groups cover raw bytes, inclusive padding, unchanged masks, exact
saved bytes, orientation, canonical pixel edits, lifecycle retirement and checked
Bload/Bsave behavior. Connected menu replays additionally verify eight original
icon copies across its four game-selection cases; the game guard follows them.
