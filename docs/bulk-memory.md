# Checked Fill and Copy

`Fill start To end,pattern` (`$219a`) and `Copy start,end To destination`
(`$21aa`) now use the existing command-signature parser, numeric lowering and
ordinary standalone instruction functions. They share the bank-memory resolver;
there is no second memory store or host-specific transfer implementation.

Fill repeats the big-endian bytes of a signed 32-bit pattern and excludes the end
address. A zero-byte range is valid at a live owned address or its one-past end.
Only Fill's start accepts the existing bank-or-address convention: values below
1024 select a bank, otherwise they are virtual addresses. Its end remains an
absolute address. Copy accepts absolute virtual addresses for all operands,
excludes its end and rejects empty/reversed ranges. Both overlap directions and
self-copy preserve the original source bytes, matching memmove.

The source-derived behavior follows AMOS-Professional-Official revision
`efddf2c9a09bf61a45b7b096a9be84630853c2b1`, `src/lib/memory.cpp` lib_in_fill,
lib_in_copy and transfer, plus `src/lib/banks.cpp` bank_or_address. The original
Fill writes four long patterns per sixteen-byte block and rotates the pattern
left eight bits before each remaining byte, giving the same big-endian byte
sequence across complete blocks and tails. Copy chooses its direction when
ranges overlap. `+Lib.s` records the exact token signatures. This is source
analysis, not native reference execution.

The supported Fill length is at most 1 MiB. The native sixteen-byte-block loop
has a word-sized DBRA counter; larger/wrapped-count forms are explicitly gated.
A Fill containing a sixteen-byte block requires an even start. Odd starts are
supported only for its byte-tail form (0–15 bytes). Native aligned-long fault
behavior and wider machine/address-space variants are not emulated or silently
aligned. Copy uses byte semantics and accepts odd addresses within owned ranges.
Hardware RAM, registers and display DMA addresses remain outside this virtual
bank-memory contract.

Complete source/destination ranges and raw-icon read/write permissions are
validated before any byte changes. Failure never partially modifies a bank.
Fill/Copy preserve bank, byte-array and virtual-address identity. Swap keeps
addresses attached to their bank objects; shrink, erase and replacement retain
the existing retirement checks. Active Tracker payloads may be read but cannot
be modified until Track Stop. Empty Fill has no write and leaves those jobs alone.

Generic-bank Copy uses TypedArray#set, which handles overlapping buffers. Raw-icon
paths snapshot source bytes before writing canonical indexed pixels. Table/header
writes and mask-pointer reads keep their existing gates; old masks remain owned
and unchanged. Transfers do not redraw already presented objects or regenerate
masks. See [raw icon memory](icon-memory.md) and [bank addresses](bank-memory.md).
All arguments evaluate once, left to right, through the shared integer conversion
helpers. Later synchronous expression callbacks that replace an already captured
bank address cause the complete stale-range check to fail before mutation.

## Original Roller II statements and demo

The [transfer demo](../demos/roller2-transfers.html) uses a declared prepared-level
fixture. It loads one original level into bank 10, runs original editor backup
line 415 (Reserve As Work 23/Copy), waits, runs original clear lines 325–326, waits,
then runs original restore line 561. That line's EDDISP call reaches a declared
procedure/Wait Key guard before redraw. Its ordinary procedure frame returns
normally when the finite test finishes. The original editor setup, EDDISP body,
requesters, game/editor loops and file writes are not included.

All fifteen source payloads are checked. Clear changes the first 240 bytes to
floor tile 1 and the next 240 bytes to colour 0. The ten metadata bytes at 480–489
remain byte-exact. Bank 23 keeps an independent original 490-byte backup, and
restore copies that entire original payload back without replacing bank 10.
The UI can select a level, clear it in memory and restore its backup. It does not
persist edits or emulate a save requester.

`tools/reference/roller2_transfers.py` independently reads raw original AmBk
files and writes source/cleared payload hashes and metadata hex. Eight headless
groups cover exact token/endian/tail bytes, the Fill bound, overlap, DATA/arrays/
procedure results, evaluation order, stale-address failure, protected icon paths,
active Tracker ownership and all fifteen original statement replays. The shared
browser scenario checks thirty Fill runs, fifteen backups/restores and normal
redraw-guard return, with an offline runnable demo and HTML Preview index link.
Existing GPU/image tests remain separate; no new rendered editor or native
capture is claimed.

The separate [selection preview](set-line.md) now implements Set Line.
Whole-source compilation reaches Writing `$1418` at original line 334, byte
17094. Ten of the 194 encodings remain unrecognized. That count does not
measure complete game/editor compatibility.
