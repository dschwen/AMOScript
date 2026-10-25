# Checked bank memory addresses

The original `Start` (`$0140`), `Peek` (`$21e6`) and `Poke` (`$21ca`) forms now
work on generic data/work bank payloads. This lets Wonderland's startup read its
five rainbow seeds from `Start(4)+7201` through `+7205`, and provides the same
byte storage for later level editing and sample playback.

## Portable address contract

`Start(bank)` returns a stable positive integer address within the current
program factory. `Peek(address)` returns an unsigned byte 0–255;
`Poke address,value` stores the low eight bits of the converted integer.
Typed expressions and Val tags use the existing integer conversion helpers.

`lib/amos/bankMemory.js` maps virtual intervals to the existing owned bank byte
arrays. It does not allocate a second copy of the bank. Consequently `Poke`
changes are visible to direct bank reads, Save and subsequent sample plays.
Each program factory owns its intervals and bank bytes independently. Numeric
addresses may coincide between factories; they always address that instance's
storage. Addresses are not transferable host pointers.

Intervals are assigned lazily when Start is used, aligned to 16 bytes beginning
at 65536, with guard gaps and a signed-positive 32-bit address-space limit.
Retired addresses are never reused during a factory's lifetime. Address-space
exhaustion throws rather than wrapping or aliasing another allocation.

- Bank Swap retains bank identity and its address, even when the number changes.
- Shrink retains the address of the surviving prefix; removed tail bytes become
  inaccessible. The original `Bnk.Schrink` frees and reclaims the same base.
- Erase, reserve replacement and reload retire the old interval. A later bank
  receives a new address, so stale pointers cannot silently address its bytes.
- Grouped loads retire replaced banks; Erase Temp/All invalidate affected
  intervals. Retired mappings release references to removed bank objects.
- Every byte access checks the current live bank and current payload length.
  Missing banks, foreign/unmapped addresses and retired/out-of-bounds bytes fail
  with the executing instruction's source location.

Generic bank payloads and bounded icon-bank table/record views are addressable.
[Raw icon memory](icon-memory.md) now supports original ICCOPY, preserving indexed
pixels and separate masks. Sprite banks, metadata writes, raw Amiga RAM, ROM and
hardware registers remain outside this subset.
The allocator is separate from display chip memory and does not turn these
addresses into bitplane/DMA pointers. Zero-length generic payloads may have a
Start address but no byte can be accessed. Arbitrary memory allocation, physical
allocation timing and Amiga bus-fault behavior remain outside this subset.

Raw [Bload/Bsave](raw-files.md) also use this allocation map. Complete ranges
must fit one live payload, with Bsave excluding its end address. Bload retains
bank and byte-array identity; empty loads may use an owned one-past-end boundary.
Peek/Poke still require an actual byte.

## Evidence and verification

The [independent-byte fixture](../test/fixtures/conformance/bank-byte-access.json)
pins original token offsets and source links. Original `InPoke` uses `move.b`;
`FnPeek` clears the result before reading a byte; `FnStart` returns a reserved
bank's payload address. The portable allocator adds the checked ownership/lifetime
contract above; it does not claim to reproduce numeric Amiga addresses.

Tests cover typed scalars, arrays, DATA and procedure results, signed-byte storage,
swapping, shrinking, replacement, group reloads, erasure, saving and audio reads.
Generated modules run without `require` in a sandbox. The shared
[Wonderland demo](../demos/wonderland.html) executes the original first 64 lines
with its original embedded image and level banks, checking seeds
`55,7,45,10,49`, image masks, sample setup and both startup timing branches.
These expectations remain source/asset analysis, not Amiga execution captures.

## Word and long access

`Doke` (`$015a`), `Loke` (`$21d8`), `Deek` (`$21f2`) and `Leek` (`$21fe`) now use
the same checked generic-bank intervals. Reads and writes are big endian, at
both even and odd addresses. Deek zero-extends two bytes to 0–65535; Leek returns
the signed 32-bit AMOS integer bit pattern. Doke stores the low sixteen bits and
Loke all thirty-two bits after shared integer conversion. Addresses are virtual
addresses, not implicit bank numbers. Static/boxed numeric values, arrays, DATA
and procedure results keep the existing conversion rules.

Each operation checks its entire two/four-byte range in one live payload.
Cross-boundary, shrunken-tail and retired addresses reject. Writes validate the
whole range and invoke the shared mutation guard once before changing any byte;
failed writes cannot leave a partial update. Active Tracker banks remain readable
but reject word/long writes just as they reject Poke/Bload. Save and future sample
reads see the same owned bytes; no shadow representation is introduced.

The final byte values follow pinned `src/lib/memory.cpp` at
`7f32e0abe1b6b415c9502b598cd3e4cb131018f8`. Its odd-address path explicitly works
byte by byte. This portable subset does not reproduce bus-access order, hardware
register side effects, interrupts, alignment faults or arbitrary machine RAM.
The independent [token-byte fixture](../test/fixtures/conformance/bank-word-long-access.json)
uses explicit opcodes and line/literal bytes, without the production encoder.

## Roller II level metadata

The [level demo](../demos/roller2-levels.html) executes original game line 608 to
read BX, BY, BC and `Deek(Start(10)+486)`, then original editor line 474 to write
`Doke Start(10)+486,TM` and wait for VBL. Synthetic Load/Input# and Wait Key guards
prepare one level and the replacement time. No game/editor loop, icon addressing,
rendering or persistent write is claimed; the original game guard remains.

All fifteen supplied level files have a 20-byte AmBk header and 490-byte Work
payload. They are not fifteen consecutive playable levels: names are 1–11, 16,
17, 20 and 100. Independent Python extraction in `tools/reference/roller2_levels.py`
pins their hashes and literal ball/time metadata in
`test/fixtures/roller2/level-metadata.json`. It imports no AMOScript reader.

Browser and headless checks load every original file, compare its metadata,
write time 43981, and verify that only bytes 486/487 become AB/CD. Bank identity
and address remain unchanged. The runnable browser preview can select a level,
change its in-memory time, and reload the original bytes. Persistence and the
original editor's complete Save path remain open. These are source/asset-derived
and browser checks, not native execution captures.

Game entry now runs original ICCOPY through bounded Start(2)/Leek icon views;
see [its contract](icon-memory.md). Generic-bank word/long commands also prepare
later level work. Screen/level setup, Copy/Fill and other gameplay gates remain open.
