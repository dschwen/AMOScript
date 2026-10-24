# Bank loading and static images

The compiler reads the `AmBs` trailer after the declared code section. Generated
JavaScript embeds the decoded banks; no image files or runtime imports are
needed. Each factory call creates its own mutable `program.banks` Map, including
independent image pixels and palettes. Code-only fixtures may omit the trailer;
any supplied trailing data must have a complete, recognized structure.

## Supported formats

- `AmSp`: bank 1, shared by Bobs and sprites.
- `AmIc`: bank 2, used by Icons.
- `AmBk`: generic bank metadata and uninterpreted bytes. The length includes
  the eight-byte name. Bank zero defaults to five, as in the original loader.
  Memory preference and permanent/data status are recorded separately.

Object banks contain a count, image definitions and 32 twelve-bit palette words.
Images have width in 16-pixel words, height, depth, and hotspot coordinates,
followed by complete consecutive bitplanes, least-significant plane first.
The decoder supports depths 1–6, signed fourteen-bit X and sixteen-bit Y hotspots,
and empty slots. Loading clears the X hotspot's upper flipping flags as AMOS does.
Saved masks are absent from this format.

Malformed lengths, invalid headers, truncated images/palettes, unknown bank
types, duplicate bank numbers and leftover bytes are explicit errors with byte
and bank context. Nested multi-bank groups remain unsupported. Standalone ABK
and grouped ABS loading use this same decoder at runtime. Generic banks are
preserved as data; decoding their audio, packed
picture, AMAL, or other contents is separate work. Their metadata does not imply
support for Amiga addresses, physical chip/fast memory capacity or every bank
manipulation command.

## External files

```basic
Load "objects.abk"
Load "objects.abk",1
Load "data.abk",12
Load "all-banks.abs"
```

Generated modules embed the bank decoder. Supply a synchronous `files.read(name)`
host returning a Latin-1 byte string, using the existing memory or Node file
adapter. Loading does not require a write method or use sequential file channels.
Browser hosts should preload bytes; Promise results and non-byte strings are
explicit errors. No network fetch or runtime import is added to generated code.

Standalone files start with AmSp, AmIc or AmBk. Image banks stay at numbers 1/2.
Omitting the optional argument or supplying a zero low word replaces the image
bank. A nonzero low word appends its images after existing slots, including empty
slots; the incoming palette replaces the bank palette. Existing images retain
their mutable masks/orientation, while incoming images start with decoded
hotspots, orientation zero, and default Object/Icon masking. Screens retain their
current palette until a Get Sprite/Bob/Icon Palette command is used.

Generic banks use their saved number when the argument is omitted or negative;
a saved zero defaults to five. A nonnegative explicit override chooses the target
number. The original InLoad2 rejects signed values >=65536; negative values pass
and use the file number for generic banks. Its image handlers test the low word
as the append flag.

There is a source/manual discrepancy for an explicit generic destination zero:
the manual describes it as default numbering, while Load0/Bnk.Load/Bnk.Reserve
use zero directly. The implementation follows that instruction path and creates
bank 0. This edge, like negative image flags, needs reference execution before
claiming target-version fidelity.

An AmBs file replaces the entire bank set, ignoring the optional destination.
An empty group clears all banks. Nested groups and duplicate numbers are rejected.
Replacing/removing Object images restores saved Bob backgrounds on both screen
buffers and marks composition dirty. Bob definitions retain their coordinates
and image numbers; unavailable image slots are skipped during composition and
can draw again after loading matching images. Explicit Bob commands still reject
missing images. Bnk.Change/HsBank retain Bob state in the original source, although
exact hardware update timing remains unverified.

The whole file is decoded and validated before changing runtime banks. AMOS
partial-file allocation/failure side effects and memory exhaustion are not
reproduced. Valid generic loads replace only the selected bank; valid groups
replace all. Every program instance owns its loaded pixels, masks and data.

The [memory-bank manual](https://amospromanual.dev/05-09-memory-banks.html) documents
LOAD and image appending. The original
[InLoad1/InLoad2, Bnk.Load, LB_Sprites/LB_Icons/LB_Multiples](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BLib.s)
and [HsBank](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BW.s)
establish the source model. [Standalone tests](../test/bank-loading.test.js), an
[independent file fixture](../test/fixtures/conformance/external-bank-load.json),
and exact Chromium pixels cover external loading and image appending. They are
source-analysis evidence, not captured AMOS execution.

## Reservation, erasure and Length

```basic
Reserve As Work 5,1024
Reserve As Chip Work 6,512
Reserve As Data 7,256
Reserve As Chip Data 8,128
Print Length(5)
Erase Temp
Erase 7
Erase All
```

Reserve accepts bank numbers 1..65535 and positive byte lengths, with the shared
numeric-to-integer conversion. It creates zeroed generic byte storage. Work
banks have `permanent: false` and the eight-byte name `Work    `; data banks
have `permanent: true` and `Data    `. Chip forms record `memory: 'chip'`, while
the other forms record the fast-memory preference. Actual Amiga memory pools,
fallback allocation and available memory are not modeled.

Reserving an existing number replaces it, including reserved image-bank numbers.
Invalid arguments fail before erasure. For a valid request, Bnk.Reserve erases
the previous bank before attempting allocation. A new allocation failure therefore
leaves the old bank erased and halts execution; host allocation errors are not
translated into a simulated Amiga memory budget.

Erase removes the matching bank and is harmless if the bank is absent. Erase All
removes every bank. Erase Temp removes generic banks lacking the permanent/data
flag, including loaded work banks, while preserving permanent data and image
banks. Bob background cleanup is shared with Load: deleting or reserving over
bank 1 restores both saved screen buffers, retaining Bob definitions for a later
compatible image load. Pasted screen pixels are independent of bank storage and
remain visible after erasure.

Length returns an integer: generic byte count, image slot count including empty
slots, or zero when the number is not loaded. It does not expose a host/Amiga
address. All bank storage remains isolated between program instances.

The original [RsBqX, Bnk.Reserve, Bnk.EffTemp and FnLength](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BLib.s)
establish these rules. [Lst.Cree](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BB.s)
retains requested length for the generic-bank query, independently of allocator
alignment. [Lifecycle tests](../test/bank-lifecycle.test.js) cover metadata,
initialization, replacement failure order, erasure, queries and buffered Bob
restoration. An [independent-byte fixture](../test/fixtures/conformance/bank-lifecycle.json)
and Chromium restoration checks add source-derived execution coverage. Actual
AMOS reference capture remains outstanding. Raw addresses and additional
bank formats remain separate work.

## Swap and shrink

```basic
Bank Swap 5,6
Bank Shrink 6 To 128
```

Bank Swap accepts numbers 1..65535 and exchanges only the numbers of the selected
banks. Contents, bank type, memory preference, permanence and mutable image state
stay with the same bank. If exactly one slot exists, the bank moves to the empty
slot. Swapping an existing number with itself changes nothing. Work/data flags
are preserved, so Erase Temp still selects the same bank after renumbering.

Object/Icon banks can move to another slot, where Length still returns their
image-slot count. Object rendering requires a sprites-type bank at number 1, and
Icon operations require icons at number 2; a swap does not convert image types.
Moving an Object bank away from slot 1 restores saved Bob backgrounds on both
buffers. Bob definitions remain and can draw again when the bank returns. Images,
masks, hotspots and orientation are retained rather than decoded again.

The original InBankSwap path writes through a null bank pointer when both numbers
are absent. The portable runtime rejects this unsupported raw-memory case with
`Cannot swap two missing banks`, without changing banks. It does not simulate
memory corruption or a hardware exception.

Bank Shrink applies to generic byte banks, retaining prefix bytes and metadata.
The new length must be positive and no greater than the old one; equal size is
allowed. Validation rejects nonpositive lengths first, then missing banks,
image-bank types, and growth. The bank object remains the same, while its byte
storage is reduced. [Portable Start/Peek/Poke addresses](bank-memory.md) now retain
the surviving prefix address and reject removed tail accesses. The runtime does
not model native machine pointers, FreeMem/AllocAbs or Amiga scheduler locking.

These rules follow [InBankSwap and Bnk.Schrink](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BLib.s)
and the [memory-bank manual](https://amospromanual.dev/05-09-memory-banks.html).
[Standalone tests](../test/bank-manipulation.test.js) cover identity, metadata,
byte retention, numeric conversion, errors and buffered composition. An
[independent-byte fixture](../test/fixtures/conformance/bank-manipulation.json)
covers renumbering and shrinking. Chromium checks pixels after swapping an active
Object bank away and back. These remain source-analysis expectations pending AMOS
reference execution.

## Saving banks

```basic
Save "all-banks.abs"
Save "objects.abk",1
Save "data.abk",7
```

Save uses a synchronous `files.write(name,byteString)` host, compatible with the
memory and Node file adapters. Generated modules embed BankWriter, so Save/reload
works without runtime imports in both Node and browsers. Existing files are
truncated, matching MODE_NEW. The adapter first receives an empty byte string to
open/truncate, then the completed output. A missing selected bank raises an error
after that initial truncation. Failed opening leaves image orientation unchanged;
Promise results are rejected by the synchronous host contract.

Single-bank Save writes AmBk, AmSp or AmIc according to bank type. Generic output
contains its current number, memory preference, permanent/data flag, eight-byte
name and bytes. Encoded length includes the name. An image bank's number is not
part of the image file: saving an Object bank currently at 10 still produces
AmSp, which reloads into bank 1. Image output stores consecutive complete
bitplanes, empty ten-byte slot records and 32 twelve-bit palette entries.

Before image output, Bnk.UnRev restores the live pixels, masks and hotspots to
unflipped orientation; Save is not just a snapshot of currently flipped pixels.
Signed X hotspots are stored as sign-extended words. Masks and No Mask settings
are not serialized, so reloading restores the normal Object/Icon defaults.

Save without a number writes an AmBs group containing all current banks, including
work banks. This is the explicit bank-save path; Editor program-save work-bank
filtering is separate. Output follows the original newest-first bank list.
Creation, replacement and external loading add new nodes at its head; Swap changes
numbers without reordering nodes, and Shrink retains its node. Reloading a group
prepends its entries, so saving it again can reverse their order. Empty output is
the six bytes `AmBs` followed by a zero count.

The image writer explicitly rejects more than 32768 slots or planar payloads of
65536 bytes or more per image. The preserved Save path uses signed word loop
guards and a word byte-count shift that produce truncated output beyond these
bounds. Emulating that corrupt output/raw-memory behavior is unfinished. Generic
output retains the decoder's 28-bit name-inclusive length limit. Physical memory
capacity and exact partial-write contents after disk failure are not modeled.
Grouped files containing duplicate implicit image-bank numbers remain outside
the decoder's supported subset.

The format and order follow [Bnk.SaveAll/SaveA0/UnRev](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BLib.s)
and [Lst.Cree](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BB.s).
[Exact-byte tests](../test/bank-saving.test.js) check independent generic/planar
encodings, empty slots, masks/hotspots, ordering, failure behavior and real Node
file round trips. The [Save fixture](../test/fixtures/conformance/bank-saving.json)
records explicit output bytes; Chromium checks flipped-image Save/reload and
rendered pixels. These are source-derived expectations pending AMOS captures.

## Supported instructions

`Paste Bob x,y,image` draws from bank 1, initially with index zero transparent.
`Paste Icon x,y,image` draws from bank 2, initially replacing all pixels including
index zero. Both clip to the current screen and use the image's top-left corner,
ignoring its hotspot. They modify screen pixels immediately, so Point observes
the result. Images are numbered from one; empty/missing slots produce errors.

`Get Sprite Palette`, its `Get Bob Palette` alias, and `Get Icon Palette` copy
the appropriate bank palette into the current screen. Their mask variants select
which of the 32 colour registers are copied; bits zero through 31 select the
corresponding entries. Unselected entries remain unchanged. Lower-depth screens
retain all 32 registers for later object support, although their pixels use only
the screen's configured colour range.

`Hrev(image)`, `Vrev(image)` and `Rev(image)` return an integer image number with
horizontal, vertical or both orientation bits set. Calling the function alone
does not flip the image. Pasting applies the requested absolute orientation,
even if the image is entirely off-screen. Repeated Hrev pastes keep that
orientation; a plain image number restores the original. The stored pixels,
mask and hotspot change together. Hotspots follow the original width-minus-x
and height-minus-y transforms. Previously pasted screen pixels do not change.

`Make Mask [image]` and `No Mask [image]` enable/recompute or disable colour-zero
masking in bank 1. `Make Icon Mask [image]` and `No Icon Mask [image]` do the same
for bank 2. Omitting the image affects every nonempty slot. Empty slots are
skipped; out-of-range indices are errors. Masks are generated lazily for default
Bob transparency, explicitly recomputed by Make Mask, and mirrored with flips.
They include every source bitplane, including planes above the screen depth.

Mixed depths copy only the lower min(image depth, screen depth) planes. Upper
destination planes remain unchanged; extra source planes are not drawn. Thus a
six-plane image can be pasted onto a lower-depth screen even though six-plane
screen modes remain unsupported. A source pixel containing only an extra plane
still counts as opaque under a generated mask and clears the copied low planes.
Moving Bobs use saved backgrounds as described in [the Bob contract](bobs.md).
Hardware sprites and their composition remain unfinished. Palette/display hardware
behavior remains subject to the limitations in [the display contract](display.md).

## Evidence and verification

The format follows the [manual's memory-bank appendix](https://amospromanual.dev/99-appendix-e-memory-bank-structures.html)
and original [AMOS +Lib.s](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BLib.s)
loader (`Bnk.Load`, `LB_FIcons`) and palette/paste routines. The
[Bob manual](https://amospromanual.dev/07-02-blitter-objects.html) specifies Paste
Bob's coordinates, and the [Icon manual](https://amospromanual.dev/07-07-icons-and-blocks.html)
describes opaque default drawing. These are source/manual interpretations,
pending comparison with an AMOS runtime.

The original [+W.s graphics routines](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BW.s)
provide the flip (`Retourne`, `RBobX`, `RBobY`), hotspot, mask (`Masque`) and
mixed-depth (`BobCalc`, `BbHt3`) contracts. Flip/mask command opcodes and bank
selection come from +Lib.s. These edge cases remain source-derived rather than
captured emulator results.

`test/fixtures/image-banks.hex` is independently specified planar data, with
provenance described beside it. Unit tests check exact indices, empty slots,
hotspots, every truncated prefix, malformed headers, generic data, clipping,
palette masks, image masks, flip persistence, mixed depths, errors, and instance
isolation. The synthetic Graphics.AMOS
fixture embeds an original robot tile as both an Object and Icon bank; it is
not an emulator export. Chromium checks the resulting colours and transparency
on the real Canvas, followed by keyboard resumption, changed orientations and
mask settings, and program switching.
