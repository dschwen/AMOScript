# Bank byte addresses

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

Only generic bank payloads are addressable. `Start` for sprite/icon banks rejects;
image headers, raw Amiga RAM, ROM and hardware registers are outside this subset.
The allocator is separate from display chip memory and does not turn these
addresses into bitplane/DMA pointers. Zero-length generic payloads may have a
Start address but no byte can be accessed. No Doke/Deek/Leek, arbitrary memory
allocation, physical allocation timing or Amiga bus-fault behavior is implied.

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
