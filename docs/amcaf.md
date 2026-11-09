# AMCAF V1.50beta4 reverse-engineering reference

The supplied `AMOSPro_AMCAF.Lib` is **V1.50beta4, 11-Jan-98**, default slot **8**.
The manual identifies its main reference as V1.40; its history supplements newer
features and explicitly calls this the final freeware release. Use the actual
binary token table when manual/history disagree about available commands.

This package recovers **347 command entries representing 280 distinct names**,
**399 routine records** (398 nonempty), and **716 AMOS relocation markers**. It is a
static implementation reference, not compiler/runtime support. Selected behavior
below is recovered in detail; the remaining commands are mapped/disassembled,
not claimed to have complete semantic contracts. No example or command has been
executed under native AMOS during this analysis.

## Artifacts

- [All commands](../tools/reference/amcaf-v1.50beta4/commands.md), including each
  overload's original token offset, signature, entry routine and file address.
- [Catalog](../tools/reference/amcaf-v1.50beta4/catalog.json): 206 statement entries,
  115 integer-function entries and 26 string-function entries. Includes raw
  signature terminators, types/separators, relocation edges, manual node IDs,
  manual line references and exact example locations. There are no float argument
  types in this table.
- [IRA assembly](../tools/reference/amcaf-v1.50beta4/ira.s) and
  [configuration](../tools/reference/amcaf-v1.50beta4/ira.cnf), produced with the
  user's IRA V2.11 and AMOS-aware temporary relocation.
- [Annotated disassembly](../tools/reference/amcaf-v1.50beta4/disassembly.txt):
  routine boundaries and original relocation-marker bytes alongside linked calls.
- [Examples/assets](../tools/reference/amcaf-v1.50beta4/examples.json) and restored
  [Fire](../tools/reference/amcaf-v1.50beta4/examples/Fire.amos.txt) /
  [ScreenTrans](../tools/reference/amcaf-v1.50beta4/examples/ScreenTrans.amos.txt)
  source listings. Both original programs are unchanged.
- [Manual nodes and history](../tools/reference/amcaf-v1.50beta4/manual.md):
  searchable Markdown transcription of the supplied command/function reference,
  history and buglist, with node anchors. Exact-title matching associates 300
  command entries with manual nodes; missing matches do not necessarily mean a
  command is undocumented, since some nodes describe whole command families.
- [Exact lookup tables](../tools/reference/amcaf-v1.50beta4/tables.json): raw sine
  quarter-wave words, reconstructed 1024-entry sine table, 513 arctangent ratio
  bytes and the initialized C2p Fire average table.
- [Extractor](../tools/reference/amcaf.py), using the shared
  [AMOS extension decoder](../tools/reference/turbo_plus.py).
- [Independent metadata comparison](../tools/reference/amcaf-v1.50beta4/validation.json)
  against the preexisting amostools V1.50beta4 token-table image.

Original library: 45,568 bytes, SHA-256
`9894a7e216ff501244bbcdc47d3830abdbcf4382d4f4a6daa43551faa87917e4`.
The supplied `AMOSPro_AMCAFUpdate.Lib` is **not a loadable HUNK extension**:
it is 25,430 bytes of unrecognized data. It is fingerprinted in the inventory;
its encoding/purpose has not been established and it is not treated as another
command library. The installer is also a different executable, not extension code.

## Reproduction

From the AMOScript root:

```sh
python3 tools/reference/amcaf.py /home/daniel/Downloads/amcaf   --output tools/reference/amcaf-v1.50beta4   --ira /home/daniel/Downloads/ira/ira   --token-reference /home/daniel/Programs/amostools/extensions/AMOSPro_AMCAF.Lib-V1.50beta4
```

Add `--check` to compare all regenerated artifacts without changing reference
files. Temporary analysis files still need writable temporary storage. The same
IRA version is needed for exact text reproduction. `--objdump` selects cross
binutils; `--listamos` selects the local amostools printer. These two optional
path overrides and `--token-reference` make external tool/data dependencies
explicit. The original distribution is read only throughout.

## Container, relocation and ABI

This is an **old-format AMOS extension without AP20**, despite its AMOSPro name.
The shared decoder handles its 18-byte header, six-byte token prefix and
high-bit-terminated names/signatures. `$ffff` denotes an absent instruction or
function entry. `!name` and later `$80` records implement overloaded names.
A signature terminator `$fe` preserves continuation/overload metadata; it must
not be discarded when reconstructing the verifier table.

| File range, end exclusive | Contents |
|---|---|
| `$0000..$0020` | Amiga HUNK header and CODE record |
| `$0020..$0032` | Four section lengths and a word |
| `$0032..$0350` | 399 unsigned-word routine lengths, measured in words |
| `$0350..$1c48` | 6,392-byte command table |
| `$1c48..$b1b2` | 38,250-byte routine region, including inline data |
| `$b1b2..$b1fc` | 74-byte title/version area |

All addresses here and in generated listings are **original file offsets**.
Subtract `$20` for offsets into the CODE hunk. Routine n starts at
`$1c48 + 2*sum(length[0:n])`. Zero-sized R001 is absent, not a usable alias.

Arguments arrive through A3 with last source argument first. Integer functions
return D3 with D2=0; string functions return AMOS string pointers with D2=2.
Signatures distinguish integer `0` and string `2` arguments, with `t` for `To`.
The token `$004e` in an AMOS program is followed by slot, cached reference byte,
and table-offset word. Slot 8 is the default identity for these files, not a
universal meaning for slot 8 in arbitrary user configurations.

Startup R000 tests D1=`APex`, allocates **9,142 bytes** of extension state and
stores its pointer at `360(A5)`. It installs reset/end/bank hooks, a VBL server,
initializes lookup tables and returns D0=7, meaning slot 8. AMCAF Base returns
that state pointer; AMCAF Length returns 9,142, not the disk-file size.
Reset/end/audio callbacks therefore belong to the extension's observable state.

Local AMOS FE markers are temporarily converted into same-width 68000 branch
instructions. Core-call markers use old AMOS routine numbers, e.g. 1100
Bnk_GetAdr, 1103 Bnk_Reserve, 1121 Bnk_OrAdr and 1025 ErrorExt. External addresses
`$f000xxxx` in assembly are sentinels, not executable host pointers. Original
marker bytes/targets survive in JSON. Rdata markers stop code scanning; inline
error strings at `$afb4..$b1a6` are separately excluded. Other inline data can
still resemble instructions. IRA output is diagnostic, not verified reassembly.

## Supplied examples and implementation targets

Only **two** tokenized examples are supplied in this directory. Their **20 AMCAF
occurrences cover 12 distinct entries**, all slot 8; there are no foreign-slot
calls. The manual mentions many other examples that are absent from this copy.

| Example | Commands exercised |
|---|---|
| Fire.AMOS | Pal Spread, Vclip, C2p Fire, C2p Shift, C2p Convert |
| ScreenTrans.AMOS | Imploder Unpack, Alloc Code Bank, Alloc Trans Map, Set Trans Source, Trans Screen Runtime, Qsin, Qcos |

Fire opens a six-plane screen and uses padded chunky work banks. ScreenTrans
uses an embedded bank 8 (`Datas   `, 2,014 payload bytes, `IMP!` header
claiming 131,072 unpacked bytes), a generated word map and one-bit output
from Trans Screen Runtime. Commented-out Dynamic/Static/Turbo Point commands
are not execution or token coverage. Supporting the full examples requires the
existing core AMOS operations as well as these extension calls.

## Semantics established from code

### Integer and byte-string helpers

| Commands and routines | Recovered behavior |
|---|---|
| Vclip, R0b7 `$49d6` | Signed-long clamp: apply upper bound first, then lower. Reversed bounds therefore produce lower, not automatically reordered bounds. |
| Vin, R0b8 `$49ec` | -1 for **inclusive** lower <= value <= upper, otherwise 0. This differs from Turbo Plus Between's exclusive endpoints. |
| Vmod, R0b9/R0ba | Wrap with inclusive upper bound using a period upper-lower+1. Native negative branches return lower+period when the negative magnitude is an exact multiple: e.g. Vmod(-10,9) yields 10, outside the documented range. DIVU.W/DIVS.W limits are observable; do not replace every input with a JS modulo formula. |
| Odd/Even, R0c0/R0c1 | Signed AMOS booleans -1/0 from bit zero, including negative integers. |
| Lsl/Lsr, R0c4/R0c5 | Actual instructions are **ASL.L/ASR.L**. In particular AMCAF Lsr preserves the sign bit. Register count uses low six bits, not JS modulo 32. |
| Wordswap, R0c6 | Exchange high and low words of the 32-bit value. |
| Speek/Sdeek, R0c8/R0c7 | Signed byte/word reads with sign extension. They differ from AMOS Peek/Deek's unsigned results. |
| Binexp, R0c2 | 1 shifted left by count 0..31; reject negative or >=32. Bit 31 returns signed integer bits. |
| Binlog, R0c3 | Accept a nonzero **single-bit** 32-bit value and return its bit index. It is not floor(log2) for arbitrary values. |
| Chr.w$/Chr.l$, R0b3/R0b4 | Return exactly 2/4 big-endian raw bytes, including NUL, from low-word/full-long bits. |
| Asc.w/Asc.l, R0b5/R0b6 | Require at least 2/4 string bytes. Read big-endian data; Asc.w zero-extends, Asc.l returns signed long bits. |

Nop (R015) is a deliberate RTS. Nfn (R016) sets D2=0 but does not initialize
D3; a deterministic zero result cannot be inferred. Removed Rnc Unpack consumes
arguments and returns without unpacking; Rnp is just RTS. Their tokens remain
in the binary although history says they were removed. Token presence is not
a usable decompression implementation.

### Fast maths: preserve tables and integer widths

Qsin (R112 `$6346`) masks the angle to 0..1023, loads a signed word from the
initialized table, multiplies by the signed low word of radius, arithmetic
right-shifts by 8, adds the last shifted-out bit and sign-extends the low word.
Radius zero short-circuits to zero. Qcos (R111 `$633c`) adds 256 to the angle's
stack word then branches to Qsin. Neither follows Degree/Radian mode.
The binary's quarter-wave data ends at 255; initialization inserts explicit
+256/-256 peaks and mirrors the stored words. Use `tables.json`, rather than
regenerating the table with host Math.sin, for bit-level expectations. For
example, with radius=256, Qsin(255,256)=256 but Qsin(256,256)=255; the
constructed peak is deliberately not at the mathematical axis index. These
are static table/instruction deductions, not native captures.

Qarc (R113) uses a 513-byte ratio table and quadrant corrections, returning
0..1023; zero vector returns 0. It mixes long arithmetic and low-word division/
sign tests, so wide inputs need an explicit tested range. The table is preserved.

Qrnd (R110) rotates the hardware beam word by a count derived from itself, adds
it into a word seed, multiplies seed>>1 by the low-word bound, shifts by 15 and
adds carry. Bound zero returns the previous result **after** updating the seed.
It is not an alias for AMOScript's existing source-derived Rnd implementation.
A portable beam/initial seed policy must be explicit.

Qsqr (R10f) rejects negative values and has a distinct zero path. For values
below 65,536 it iterates `ceil((s + floor(n/s))/2)` from s=n using DIVU.W until
unchanged. Larger values are repeatedly shifted right by two, then the result
is shifted left by the number of reductions. This quantization is documented
in history. Do not substitute floating Sqr or promise correctly rounded square
roots on every integer.

### C2p commands used by Fire

C2p Shift (R04d `$3012`) processes `floor(u16(width)*u16(height)/4)` longwords.
With normal count 0..7 it shifts each **unsigned byte** right independently;
mask replication removes cross-byte contamination from the long shift. Shift
zero copies longwords. A trailing one-to-three bytes are ignored. Zero block
count enters the loop and underflows in the original, so a portable checked
subset should require positive dimensions and a positive complete block count.
Bounds and overlap must be validated before bank mutation.

C2p Fire (R04c `$2fc2`) reads the five byte neighbours at current, left, right,
previous row and next row for each linear input position, then indexes its
initialized average table and subtracts the supplied cooling value. There is no
edge clipping: row ends use adjacent linear bytes and top/bottom need real
padding. This explains the sample's extra rows and Start(bank)+WX offsets.

The table is `min(255,floor((sum+2)/5))`, not floor(sum/5). There is an additional
machine-width detail: MOVE.B of the average leaves the sum's high byte in D0.
The signed-word cooling test therefore uses
`((sum & 0xff00) | average) - lowWord(cooling)`, and stores its low byte when
nonnegative, zero otherwise. A simplified saturated-average formula is only
valid for an explicitly bounded cooling range. Original sub=0/1 paths avoid
most extreme-value cases; source/destination aliasing is still sequential.

C2p Convert (R04e `$3056`, implementation R17e `$9d2c`) first requires a 68020+
CPU flag, then at least four screen planes. The deeper routine dispatches the
four-/five-/six-plane variants; history explicitly records 4..6-plane support.
It converts indexed chunky bytes into destination bitplanes, not RGBA pixels.
The helper checks width multiple of 32 and x-offset multiple of 8, and has
separate full-/partial-stride paths. Heights, clipping, buffer selection, aligned
memory and upper-plane behavior need additional bounded vectors before runtime
support. Do not infer that all invalid geometry raises a useful native error.

Pal Spread (R14e `$738a`) accepts register endpoints 0..31, swaps endpoints
and their RGB values when reversed, writes all endpoints inclusive, and handles
identical registers as one store. It interpolates 4-bit channels using separate
integer contributions and carry rounding, clamps to 15, then calls the AMOS
palette update vector. This may differ from rounding one combined float lerp.

### Screen transitions: direct interpretation and generated code

State offsets, relative to `360(A5)`:

| Offset | Meaning |
|---|---|
| `$0496` | Source buffer pointer |
| `$049a` | Word-map pointer |
| `$049e` | Rounded map width, word |
| `$04a0` | Map height, word |
| `$04a2` | Generated-code bank pointer |
| `$04a6` | Generated-code bank size |

Alloc Trans Source allocates 65,536 bytes named `TransSrc`; Set Trans Source
accepts a bank number/address via core Bnk_OrAdr. Alloc/Set Trans Map round the
width up to a multiple of **32**, retaining word-sized width/height; allocation
is width*height*2 bytes named `TransMap`. Alloc Code Bank reserves the requested
size named `CodeBank`. Allocators set extension state before all later operations
have succeeded; portable preflight/commit policy should be deliberate.

Common target setup R097 `$4200` aligns ox down to 16 pixels, converts to byte
position and uses a selected **logical** bitplane pointer. The bitplane argument
is checked 0..6, but not against actual screen depth. It computes row stride from
screen width and map width. It does not provide general clipping.

Trans Screen Runtime (R098 `$4240`) reads each big-endian map word as a **signed
16-bit displacement from source+32768**. In unsigned terms, map value u selects
source offset `u XOR $8000`. It reads the source byte's **low bit** and packs
32 mapped bits into each output longword, MSB first. It updates just the selected
plane, preserving other planes. It has no fractional interpolation or colour
sampling; a word map can wrap within the 64KiB source window.

The supplied ScreenTrans source uses PX+PY*256 without subtracting `$8000`; a
comment shows the biased alternative. Preserve the actual source expression.
This bias must not be silently corrected in a transpiler fixture.

Trans Screen Dynamic (R099 `$4292`) does **not** draw immediately. It samples
source/map bits to generate 68000 stores in the code bank, omitting zero result
longwords, terminates with RTS and flushes caches. It embeds a destination
pointer and offsets, so executing that generated program later is a different
action. A portable implementation needs a defined instruction/operation model
and memory ownership contract, not a blanket alias to Runtime. The commented
`Call Start(11)` in ScreenTrans is relevant to this separate workflow.

Trans Screen Static (R09a `$431c`) is **only RTS**, agreeing with the history's
NOT YET IMPLEMENTED note. There is no Trans C2p token in this table. Do not invent
working versions from the family names. Native dynamic code-bank capacity is
not checked; AMOScript should retain its checked-memory guarantees.

### Other families and required host contracts

Bank Permanent/Temporary toggle bit zero of the bank flags. Bank To Chip/Fast
reallocate memory, so bank identity/address lifetime must be audited. Address-
range bank coding overloads use explicit end-exclusive byte/word loops, while
bank-number overloads obtain start/end through helper R172. The original delta
and unrolled DBF loops have small/odd/large-range hazards; full safe contracts
are not derived merely from their descriptive names.

Turbo Plot/Point operate directly on logical screen planes, bypassing ordinary
AMOS drawing/Autoback replay. Turbo Plot uses low colour bits; invalid coordinates
are no-op. Turbo Point returns -1 outside bounds. Retain buffer/cursor/hook
semantics rather than aliasing to existing normal graphics calls.

Protracker/sample commands use the extension's own player at R17d, hardware DMA,
voice masks and CIA/VBL timing, including a separate negative-mask free-voice
selection policy documented in history. The binary tests module signatures M.K.
or M!K!. Existing AMOScript tracker support is useful infrastructure, but does
not establish all AMCAF effects/queries/stealing semantics.

AMCAF owns a VBL mouse accumulator, raw joystick/extra-fire inputs, palettes,
particle/star data and OS/audio resources. Stop/Resume, reset, screen/bank
retirement and factory isolation must be specified for each implementation.
DOS directory/date/pattern commands require adapter semantics; native structure
pointer queries need opaque identities or explicit unsupported errors. Reset
Computer, Launch and extension-management commands must have explicit host
contracts. These are mapped, not enabled by this reference work.

## Integration order for AMOScript

1. Keep the full catalog diagnostic; register in ExtensionTable/FunctionTable only
   commands whose parser, lowering and runtime semantics are implemented. Preserve
   overload offsets and To separators inside functions. Enable explicit extension
   library/slot configuration before assigning third-party slots globally.
2. Implement the bounded integer/byte-string helpers with independent vectors,
   including Lsr's arithmetic sign, Vin's inclusive endpoints and Vmod's actual
   negative exact-multiple behavior or a declared restriction.
3. Add exact lookup-table maths and bounded Pal Spread through existing palette
   state, then C2p Shift/Fire/Convert using checked raw memory and canonical indexed
   screens. Verify Fire's two phases against original input/padding rather than an
   approximate shader effect.
4. Add Imploder decoding, transition source/map banks and Runtime. ScreenTrans is
   a distinct one-plane map fixture, not proof of the unimplemented Static path or
   generated Dynamic execution.
5. Treat tracker/particles/blitter/native/DOS families separately, retaining the
   repository's VBL, memory-retirement, rendering and host-adapter invariants.

## Validation limits

The extractor pins the original library hash and checks section lengths, complete
routine coverage, token records, physical source-line boundaries, known extension
offsets and restored listing line counts. An independent preexisting amostools
token image agrees byte-for-byte on all 347 entries' name/signature/terminator/
padding bytes at the same offsets, excluding rewritten routine-pointer fields.
Reproduction is checked with `--check`.

These are metadata/static checks. Lookup tables are source-derived byte data;
the semantic findings are instruction analysis, not Amiga captures or native
execution. Remaining exact rendering, audio, timing, exception and unsupported
input behavior still needs dedicated native tests and independent fixture
expectations before support claims.
