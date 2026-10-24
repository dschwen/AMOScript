# Raw Bload and Bsave in checked bank memory

`Bload filename$,destination` (`$180C`) reads a complete raw file into an existing
generic-bank payload. `Bsave filename$,start To end` (`$181A`) writes raw bytes
from start up to, but excluding, end. These forms use the existing parser,
lowering, integer conversions and synchronous files adapter. They do not add or
consume AMOS bank headers; structured Load/Save remain separate commands.

## Address and transfer contract

The original `bank_or_address` treats operands below 1024 as bank numbers and
larger values as addresses. The portable subset follows this split for Bload's
destination and Bsave's start. Bank numbers must refer to existing generic data/
work banks. A bank numbered 1024 or higher requires its explicit `Start(bank)`
address. Bsave's end is always an absolute address, not a bank number or length.
End must be greater than the resolved start. Its integer bit pattern is interpreted
as unsigned, following the source argument type; the resulting range must still
fit the checked allocation.

All byte ranges belong to one live [bank-memory allocation](bank-memory.md).
Transfers cannot cross its payload end, a guard gap, another bank or a retired
allocation. Shrink restricts the accessible prefix immediately. Empty Bload files
are permitted at an owned payload boundary, including one-past-end and a decoded
zero-length payload. Nonempty transfers and Peek/Poke cannot use that boundary.
Bsave rejects empty/reversed intervals. Image banks, arbitrary RAM, bank headers,
ROM/registers and display chip addresses remain unsupported.

Bload validates the entire returned byte string and destination range before
writing. A shorter file overwrites only its prefix and retains the remaining
bytes. It does not replace, resize or reclassify the bank: payload identity,
permanence, address and bank ordering remain stable. Peek, later structured Save
and subsequent sample reads see the updated payload. Existing playing Web Audio
voices retain their previously captured samples. A files adapter that replaces a
bank during read cannot write through the retired address afterward.

Bsave validates and snapshots its complete range before invoking the write
adapter. Invalid ranges leave the file unchanged. A valid transfer first writes
an empty string to model opening/truncating the destination, then writes the
snapshot. A failed final write can therefore leave a truncated file; external
adapter side effects are not rolled back. Snapshotting also keeps the output
coherent if a host callback mutates live bank bytes.

The files adapter must return an 8-bit byte string synchronously from read and
complete write synchronously. Thenables, non-string reads and characters above
255 reject with source context. Missing files, host errors and unsupported ranges
halt the executing instruction. Browser hosts preload bytes before executing
Bload; Node and memory adapters preserve every byte without text conversion.
Raw operations do not require or alter a numbered file channel.

## Wonderland's exact save range

The original level bank is 7,206 bytes: five 1,440-byte maps followed by six
trailing bytes. Seeds 1–5 are at offsets 7201–7205. The unchanged statement on
line 437 is `Bsave f$,Start(4) To Start(4)+7205`. Because end is exclusive, it
writes **7,205 bytes and omits seed 5**. Loading this file leaves the bank's byte
at offset 7205 unchanged. The implementation preserves this source behavior;
it does not extend the range to repair the program.

The declared fixture joins unchanged startup (1–48), map read (309–315), map
writeback (441–450), save (437) and load/seed refresh (428–431) slices, then reads
the map again. Synthetic filename/level inputs and Wait Key guards separate
edit/save/reload. It excludes file selection, enclosing Gosub/Return, editor
dispatch and gameplay. For each level, a declared cell edit is written back,
saved, and restored after deliberate live-bank damage. The omitted seed retains
a sentinel while the other four seeds reload from the file.

Expected file bytes come directly from the pinned original binary's bank-4 payload
at fixed offsets 44218–51423, independently of the production bank decoder, with
one declared edit. The [self-contained demo](../demos/raw-files.html) checks five
round trips and 72,050 byte comparisons. Its controls edit a map cell, execute the
original save/load statements, damage the bank, download raw bytes, or preload a
chosen local file before reload. This is a file/data inspector, not a game display
or implementation of `Fsel$`. Each browser scenario is linked through HTML
Preview in the [gallery](../demos/index.html).

IndexedDB-backed persistence is [planned](../PLAN.md#browser-persistent-files-planned).
The current demo Map is volatile; its download control is the current explicit
way to retain a file outside the page. Future persistence must distinguish cached
writes from committed durable transactions.

## Source and validation

Pinned [`src/lib/files.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/lib/files.cpp)
provides the complete-file read and `end - start` write;
[`src/lib/banks.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/lib/banks.cpp)
provides bank/address disambiguation. Checked ownership, whole-range validation
and coherent snapshots are the portable subset's safeguards, not a reproduction
of native out-of-range memory access or disk timing.

Eight execution groups cover original tokens, exact bytes, exclusive endpoints,
empty transfers, lifetime/shrink/swap, adapter failures and truncation, types/DATA/
arrays/procedure results, chunked real Node output, factory isolation, audio reads
and all five original level-file slices. An independent-byte conformance fixture
specifies input/output bytes without production encoders or writers. Browser
controls, local preload and offline pages are checked in Chromium. This evidence
is source/asset analysis and injected execution, not an Amiga capture.

The unmodified Wonderland source now compiles completely. Controlled game entry
now runs and renders a bounded first-level loop for two nominal seconds; see
[the milestone](wonderland.md) and [selector/whole-program evidence](file-selector.md).
