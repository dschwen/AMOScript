# Turbo Plus V2.15 reverse-engineering reference

This is a static reverse-engineering package for the supplied Motorola 68000
`AMOSPro_TURBO_Plus.Lib`, intended to support future AMOScript implementation.
It does not enable extension commands in the compiler. All 153 command entries,
340 routine records, and 497 AMOS relocation markers are recovered. Detailed
semantic findings below cover selected commands; the remaining routines are
mapped and disassembled, not claimed to have complete behavioral specifications.
No original example has been executed under AMOS as part of this investigation.

## Artifacts

- [Command inventory](../tools/reference/turbo-plus-v2.15/commands.md): every token,
  signature, routine number, file address and example occurrence count.
- [Machine-readable catalog](../tools/reference/turbo-plus-v2.15/catalog.json): raw
  instruction/function routine IDs, signatures, argument types/separators, local
  and external relocation edges, manual heading lines, example locations.
- [IRA assembly](../tools/reference/turbo-plus-v2.15/ira.s): Motorola syntax, using
  the user's IRA V2.11. [IRA configuration](../tools/reference/turbo-plus-v2.15/ira.cnf).
- [Annotated disassembly](../tools/reference/turbo-plus-v2.15/disassembly.txt): every
  nonempty routine, retaining original marker bytes beside the decoded calls.
- [Example inventory](../tools/reference/turbo-plus-v2.15/examples.json): all 33
  tokenized programs, 328 slot-12 occurrences, file hashes, banks/assets and exact
  physical-line/byte locations. It covers 69 of 153 command entries.
- [Example source listings](../tools/reference/turbo-plus-v2.15/examples): decoded
  source with Turbo Plus names restored. Original binary programs are unchanged.
- [Extractor](../tools/reference/turbo_plus.py): reproducible analysis, with a
  separate bounded token walker rather than enabling the production decoder.

The original library is 29,316 bytes, SHA-256
`ddc8abb16f35cd2fb4230e2c70dc85e6bcbbfe5f73ebcc6712135471faaafb07`.
The catalog also fingerprints the original manual and accompanying assets.

## Reproduction

From the AMOScript root:

```sh
python3 tools/reference/turbo_plus.py   /data/BigFiles/Downloads/TurboPlus2.15/TurboPlus   --output tools/reference/turbo-plus-v2.15   --ira /home/daniel/Downloads/ira/ira
```

Add `--check` to regenerate in temporary storage and compare without changing the
reference files. `--objdump` selects the cross-binutils disassembler and
`--listamos` selects the existing amostools source printer. Defaults use PATH for
IRA/binutils and the local `/home/daniel/Programs/amostools/listamos`.
`--check` needs the same IRA version because IRA prints its version header.
The optional `--token-reference` argument selects a preexisting amostools
token-table image. [Independent validation](../tools/reference/turbo-plus-v2.15/validation.json)
checks all 153 entries at their original offsets, excluding rewritten routine
pointer fields. Add the same argument for reproducing that validation artifact.
The source printer initially emits unknown extension placeholders; the extractor
resolves slot-12 placeholders against the binary's own table and checks physical
line counts. Unknown slot-5 placeholders remain explicit.

## Binary structure and AMOS ABI

Addresses in these artifacts are **original file offsets**, not loaded addresses.
Subtract `$20` for offsets into the CODE hunk. The file is a single CODE hunk with
an old-format AMOS extension header, despite its AMOSPro name: there is no `AP20`
marker. The header is **18 bytes**, not 16.

| File range, end exclusive | Purpose |
|---|---|
| `$0000..$0020` | Amiga HUNK header and CODE record |
| `$0020..$0032` | Four big-endian section lengths and one word |
| `$0032..$02da` | 340 routine lengths, unsigned words measured in words |
| `$02da..$0f6c` | Token table, including six-byte prefix |
| `$0f6c..$724e` | Routine code, inline state, tables and error strings |
| `$724e..$727e` | Title/version strings |

For routine `n`, file address = `$0f6c + 2*sum(length[0:n])`.
Zero-length records are absent routines, not executable aliases.
Token records begin at table+6 and contain instruction routine word, function
routine word, high-bit-terminated name, signature, terminator and even padding.
`$ffff` means the corresponding entry point is absent. Leading `!` declares a
name that later `$80` name records recall. Both F Draw encodings must survive.

Signature `I` is a statement; initial `0` means integer function. Argument `0`
is integer, `2` is string, comma is comma and `t` is `To`. Thus `00t0,0,0`
is an integer function with four arguments, the first two separated by `To`.
The entire command table has integer/string arguments, no floating arguments.
Do not infer a string result from the name `Parse$`: its signature is
`02,0,2,0` and its machine routine returns an integer in D3 with D2=0.

Parameters are stacked through A3 with the **last source argument first**.
Integer functions return D3 with D2=0. AMOS strings have a word length preceding
payload bytes. A5 is the AMOS global base; `424(A5)` holds this extension's state
pointer. Startup R000 calls R12e at file `$55f0`, which sets state to `$570c`,
installs reset/end hooks and returns D0=11, meaning configured slot 12.

A plain disassembler misreads AMOS link markers as invalid 68000 instructions:
`FE31 nnnn` is Rbsr to a local routine; `FE21` is Rbra; conditional markers use
the AMOS branch order recorded in the extractor. `FE01 F700 nnnn` and
`FE11 F700 nnnn` are old-numbered core jump/call markers. For example core
1100 is Bnk_GetAdr, 1103 is Bnk_Reserve, 1024 is Error and 1025 is ErrorExt.
The temporary image replaces these with valid same-width instructions, linking
local branches to file addresses. External `$f000xxxx` addresses are diagnostic
sentinels, never runnable pointers. The original file is never patched.
The call graph covers relocation markers; OS vectors, ordinary PC-relative calls
and dynamic AMOS vector dispatch need separate analysis.

Two large inline data areas are explicitly excluded from instruction decoding:
startup state/tables at `$570a..$5de4`, and error text at `$6e64..$7242`.
Other embedded constants/strings may still appear as instructions. IRA output is
a diagnostic reconstruction, not a verified byte-exact reassembly of the library.

## Semantics established from machine code

These findings distinguish the binary from the manual. Routines below use the
labels in the generated catalog and listings.

### Integer functions

| Command | Recovered behavior |
|---|---|
| Lsl.b/w/l, Lsr.b/w/l, R004..R009 | Native register-count logical shifts. Count uses low six bits; byte/word variants preserve the untouched upper 24/16 bits of the original value. A JS shift alone is wrong: JS reduces counts modulo 32. |
| L Swap, R00a | Swap high and low 16-bit halves of the 32-bit value. |
| Test.b/w, R00b..R00c | Compare low 8/16 bits; return -1 or 0. |
| Range, R08f | Signed-long clamp of first argument between low and high; tests high first. No automatic bound swap. |
| Texp, R090 | Return second argument for any nonzero first argument, third for zero. All arguments have already been evaluated; do not introduce lazy branch evaluation. |
| T Clip, R095 | Reject nonpositive full-long divisor, then DIVS.W followed by MULS.W. For representable quotients/divisors, truncate toward zero to a multiple. Negative input differs from floor. Divisor truncation and quotient overflow need explicit bounds in a portable implementation. |
| Between, R096 | Swap low/high if needed, then return -1 only for strict interior; endpoints return 0. |
| F Sqr, R041 | Integer restoring recurrence using signed comparisons, a final rounding adjustment and EXT.L of the low word. It is neither ordinary AMOS floating Sqr nor automatically Math.floor(Math.sqrt(x)). Preserve the actual recurrence before broadening input bounds. |

Bit Field Ext/Ins (R087/R086) first reject negative width, then mask width with
31. Width 0 after masking returns the original variable and skips validation of
start. Otherwise start must be nonnegative and is masked with 31. Ext masks and
logically right-shifts the requested low-bit-indexed field, with high bits lost
when the field extends past bit 31. Ins rejects start+width greater than 32.
The manual's modulo-31/clipping description is wrong: masking is modulo **32**,
and insertion can error. A width of 32 follows the zero-width path.

### Memory operations

Byte Hunt (R089) sorts addresses using signed comparisons, includes **both** end
points and reads at least one byte. Action 0 tests equality with val1; negative
action searches outside [val1,val2]; positive searches inside. Range comparisons
are **signed bytes**. Values are not reordered. Return matching address or zero.

Word Hunt (R09f) rounds both addresses down to even, sorts them, compares signed
16-bit words, and normally excludes the end address. Its loop nevertheless reads
one word when rounded start equals end. This differs from Byte Hunt.

Memory Fill (R08c) rejects empty strings, sorts the addresses and repeats the
string through the **inclusive** high address. Equal addresses write one byte.
The ASCII STRING_HUNT example's use of `Bank End` therefore needs special care:
the generic-bank result is the one-past-end address, so using it as the inclusive
fill endpoint can run outside the bank. Do not relax AMOScript's memory resolver
to hide a source overrun.

String Hunt (R0a9) requires start <= end, a nonempty string and nonzero step.
Negative step starts candidate matching at end and walks backwards; individual
string bytes are still compared forwards. Action zero searches for full equality;
any nonzero action follows a different comparison path. It is not a generic
substring API: candidate comparisons may read beyond the supplied endpoint,
and the nonzero-action byte loop needs dedicated native tests before support.

Move Mem (R0b5) has grammar **`Move Mem start,end To destination`**. A1 receives
last argument, D0 the second and A0 the first. It copies `end-start` bytes,
including zero-length support, chooses direction according to address order,
and uses longword or byte loops based on alignment. The end is exclusive and
overlap is protected. Do not infer the argument order from its name.

Bank End's wrapper R099 calls R138. Generic bank result is bank address plus
stored allocation size minus 16; Icon/Sprite banks return the **negative signed
word image count**. The wrapper calls core Bnk_GetAdr, so unresolved-bank behavior
also depends on the core AMOS version rather than only this extension.

### Checks and relative graphics

Check (R010), Hit Spr Check (R015) and Hit Bob Check (R088) return the **zone
number**, not the boolean 1 promised by the manual. They scan the requested
inclusive zone-number interval ascending and return the first hit, or zero.
Rectangles include their boundaries. These are extension-owned checks, separate
from ordinary AMOS zones. Records are five words: zone ID, x1, x2, y1, y2;
negative ID means disabled. Set Check writes its arguments in that exact order.
Reset Check writes -1 to the record's ID. Reserve Check uses ten bytes per entry;
its upper bound is 32,000. Native malformed/index edge cases should not become
unchecked browser memory access.

Hit Spr Zone and Hit Bob Zone have three-argument binary signatures, even though
the manual calls dx/dy optional. The examples supply all three. Optional syntax
needs separate verifier evidence; it must not be invented from prose alone.

R Move adds signed-word displacement to graphics cursor fields. R Home, present
in the table although missing from much of the manual, writes absolute cursor
coordinates. R Draw adds displacement then calls graphics.library Draw. R Box
walks all four sides back to the original cursor. R Bar rejects negative dx/dy
and calls RectFill using cursor plus displacement. These paths use the RastPort;
their line/pattern/mode behavior is not interchangeable with F Draw.

### Pixels, planes, icons and scenes

F Plot (R031/R032) rejects negative colour but otherwise uses its low plane bits.
Out-of-bitmap coordinates are silent no-ops. X bounds use bytes-per-row*8 rather
than an abstract visible window. The write loop uses screen+48 current planes;
when its screen flag is active the wrapper dispatches AMOS drawing hooks and may
replay through the other buffer. F Point (R033) reads screen+0 logical planes,
returns -1 outside bounds and returns only colour bits inside. Their differing
plane-array offsets matter for double-buffer/Autoback behavior. The local AMOS
screen structure confirms offsets 0=EcLogic, 24=EcPhysic, 48=EcCurrent.

F Draw's two token entries are `$04cc` (four arguments with To) and `$04e0`
(two arguments). Do not register either under the normal Draw implementation
without checking the custom line rasterizer: Set Line is documented as ignored.
F Circle has its own integer rasterizer and colour argument; native exact pixels
need independent vectors, particularly the documented radius/mode restrictions.

Plane Offset (R04d) maintains six long offsets per screen. Positive plane numbers
are 1-based; zero is an error; negative plane number clears all six offsets.
For a positive plane, delta is signed-word y times stride plus x **in bytes**.
Nonzero delta accumulates; zero resets that plane offset. Plane Update publishes
stored offsets to screen pointers. Do not implement these by copying whole indexed
images: pointer aliasing, buffer identity and display fetches are observable.
Set Planes also changes the graphics plane mask, separately from offsets.

X Icon returns width in **words**, Y Icon height in lines, Planes Icon depth.
Icon Check uses the selected Scene Icon Bank, returning 0 for absent/out-of-range
records, +1 for a positive mask pointer and -1 for a nonpositive mask pointer when
an image pointer exists. The current generic Icon bank interface is not enough
to infer all these results without retaining mask state.

Scene payload is big endian: u16 width, u16 height, then width*height u16 cells in
row-major order. A cell stores **AMOS image number minus 1**. Scene Check reads
the raw cell, Scene Change stores a word. Scene 16/32 Check/Change convert screen
coordinates with logical word shifts by 4/5. Some native bounds branches reject
only values greater than width/height, allowing equality to access beyond the
logical rectangle; portable code should explicitly gate this unsafe edge.

The supplied `Space2.Scene` is the older byte-cell format: 200*12 cells plus four
header bytes = 2,404 bytes. Scene Load reads it without automatic conversion;
SceneDemo1 explicitly calls Scene Convert before selecting the word-format bank.
Convert zero-extends bytes to words. Reserve Scene allocates width*height*2+4
bytes with a `Scenery ` bank name and writes dimensions. Tile zero is not empty:
it addresses AMOS image 1.

Scene bank selection and icon bank selection are distinct. Default icon bank is
2. Scene Mask Palette is a full 32-bit register mask, default -1; Scene Palette
accepts Sprite/Icon banks and copies only selected entries. View/Do/edge redraws
retain per-screen viewport state; drawing and definition paths have different
clipping, alignment and screen-selection behavior to audit before unifying them.

### Objects, stars, interrupts and host effects

Object Limit owns separate pointer/capacity tables for 1..32000 objects. Releasing
that limit requires erasing existing objects. Object records are six-byte
opcode/x/y elements. Draw/Move/Attr/Stop and relative/magnified renderers are
mapped in the catalog; their signed-word scaling/division should be retained.
Both supplied vector files begin `OBJE`. The manual's Reserve Object Chip/Fast
spellings do not occur as separate entries in this version: use the actual
`Reserve Object` token and audit its allocator before providing aliases.

Stars use extension-owned records and retain a particular screen. The manual
separates Draw and Compute; Display combines them. Interrupt variants also retain
their own clear/compute behavior; they are not safely replaceable with a random
star animation. The catalog connects setup wrappers to the actual helper bodies.

Multi Yes/No set the current Exec task priority to 0/20. Amos Pri silently ignores
values outside -128..20. Vbl Wait polls a beam-register byte, not a duration.
Left/Right Click directly read CIA/custom hardware; Raw Key/Is Raw Key access the
raw keyboard state. These require explicit portable host policies rather than
pretending to have physical Amiga hardware in JavaScript.

Reset/end routine R12e stops interrupts, releases blit/star/object/check storage,
clears plane offsets, restores icon bank 2 and sets palette/plane masks to -1.
Stars/blitter interrupts must integrate with the existing per-factory VBL
scheduler and retirement/Stop/Resume cleanup. The manual documents that mixing
blitter interrupts with scene drawing can lock the original; a portable scheduler
needs a defined ownership contract before enabling those combinations.

Multi Bload/Multi Bl Error/Multi Bl Ended and Parse$ have token/routine coverage,
but no tokenized example coverage or complete semantic contract here. Error text
also contains vestiges of FontInfo/frame-program features that have no public
command entries. Error strings are not proof that a command is available.

## AMOScript integration order

Keep the recovered table diagnostic. `lib/ExtensionTable.js` deliberately contains
only commands with actual parser/lowerer/runtime support; copying all recovered
entries there would turn recognition into a false support claim.

1. Add explicit extension-library/slot selection before making arbitrary third-party
   offsets globally meaningful. Slot 12 is the supplied/default layout, not a
   universal identity for every AMOS file.
2. Implement the small integer/relative-cursor subset with integer-width tests and
   real function registration. `DisplayTable.js` currently registers extension
   statements; Turbo's functions also need FunctionTable/Parser/Lowerer handling,
   including To separators inside function calls and retained source locations.
3. Add pixels and bounded memory through existing indexed buffers and checked bank
   memory. Preserve byte/word search endpoints and eager expression evaluation.
4. Add scene payload decoding and checked icon rendering, then vector object files,
   static blocks and stars. Keep original assets/programs immutable and declare any
   harness setup or unsupported calls explicitly.
5. Add plane views and interrupt lifecycle only with existing display/copper/VBL
   invariants intact. Use independent pixel/trace expectations and real Canvas/GPU
   comparisons for implemented rendering, following repository verification rules.

Good original fixtures are T_Clip, New_2Define, Newgraphicinstructions, FastPlot,
SceneDemo1, Plane_Offset_demo1/2 and the interrupt demos. F_Plot_Starfield also
contains three unresolved slot-5 commands at offsets `$003a`/`$004e`.
LightSpeed and TargetSystem use the standard slot-2 Unpack Screen `$0056`.
ASCII examples are separate evidence; INSCR_MOUSE references commands the manual
explicitly says moved to PowerBobs. Do not attribute those commands to V2.15.

## Validation and evidence sources

Structural checks verify section boundaries, routine-length coverage, token
record/signature decoding, bounded source lines, known Turbo offsets and restored
listing line counts. `--check` checks reproducibility. These are static checks,
not native conformance tests. Neither IRA assembly nor sample occurrence counts
prove the remaining graphics, timing, error, or OS semantics.

Local cross-reference sources used for the AMOS container/link ABI are
`/home/daniel/Programs/amostools/amoslib.c` (AMOS_parse_extension, AMOS_print_source),
`/home/daniel/Programs/AMOSystem/src/main/libraries.cpp` (old relocation markers),
and `src/core/layout.h` there (screen plane-array layout). Original Turbo binary
addresses above are the primary evidence for the command-specific findings.
