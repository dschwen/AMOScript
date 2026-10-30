# Gru1, Gru2 and progs1 compatibility work

The 39 supplied source files/backups are pinned byte-for-byte under
`examples/GruPrograms`, with lengths and SHA-256 hashes. They remain separate
from the user's editable directories. **32 of 39 compile**, including all nine
`.AMOS` files in progs1. Compilation is not a claim that their external files,
native-code dependencies or complete interactive paths run in a browser.

Rebuild JavaScript factories and the complete failure report into a new directory:

```sh
node tools/build_gru_programs.js /tmp/gru-build
```

Output paths preserve the original directories and add `.module.js`. Existing
outputs are not overwritten. The command exits 1 while any compilation blockers
remain. The [browser regression demo](../demos/gru-support.html) covers six actual
GPU frames, 122,880 independently checked pixels and linked browser Run behavior.

## 1. Def Scroll / Scroll

`Def Scroll n,x1,y1 To x2,y2,dx,dy` stores one of ten factory-owned definitions.
Coordinates/displacements are signed words; the native undefined sentinel and
wrapped destination sums are explicitly gated. `Scroll n` applies the definition
to the selected logical bitmap with exclusive ends, paired clipping and overlap
protection. Exposed pixels stay unchanged: this is a translated copy, not a
fill operation. Definitions survive screen selection/replacement and Default
clears them. Ordinary Autoback/Bob synchronization is retained, with independent
copies for logical/physical buffers. Cursor/line phase and bank addresses stay
unchanged. Snapshots continue through planar chip memory and the copper/WebGL
pipeline; no presentation overlay is used.

This compiles the scrolling forms in progs1's 0/1/2 programs, `3D Effekt`, and
Gru1's Scroll backup. It does not automatically supply their missing MSX assets
or remove existing mouse/display bounds. Native references: Lib.s InDefScroll,
InScroll/DoScroll/Sco0 and Equ.s NDScrolls=10.

## 2. Older parser forms

- The uncached base Fsel$ word accepts 1–4 string expressions and normalizes to
  the existing typed overload. Cached overloads keep exact arities. No expression
  replay or asynchronous picker was introduced.
- Uncached Load/Save words accept their bank-number continuation. Existing bank
  decoding, append semantics and file adapter rules remain intact.
- Bare calls resolve only to declared procedures, including forward declarations.
  Unknown bare names remain errors. Assignments retain their normal meaning.
- Top-level Shared exposes its listed variables across procedures; procedure-local
  Shared retains its scoped behavior. Parameter shadowing remains unchanged.

These changes compile both map-editor backups, both Hypervox variants and the
LabSyst backup. Grid.Bak's `bxx` is never declared, so it remains an error.
Animplay.Bak contains the expression `cli-befehl=...` in assignment position;
it remains a source error rather than being silently renamed by the compiler.

## 3. Text Base and Bgrab

Text Base returns the current graphics font baseline: 7 for the portable default
font, or the selected preloaded bitmap font's baseline. It changes no drawing
state. Native reference: Lib.s FnTextBase, RastPort TxBaseline.

Bgrab is an accessory operation, not a file load. Pass a stopped parent VM as
`parentProgram` when creating a child factory. `Bgrab n` removes the destination
bank, takes ownership of bank n from that parent, and retires the old addresses.
It uses the normal bank retirement/publication machinery. Missing parent context
or parent bank is an explicit error; there is no fabricated bank. Parent resumption
and returning accessory banks are host policy, not an implicit implementation of
PRUN or a native editor. Native reference: Lib.s InBGrab.

SpriteXpro now passes Bgrab decoding but next requires Clip at line 145. Its
later sample/wave controls also need separate work. A standalone launch will
require real accessory context and supplied resources.

## 4. Run and Pload

Run terminates the old VM and records a frozen `state.runRequest`. A synchronous
`system.command('Run', request)` notification occurs once, after audio, AMAL,
palette, file-channel and input cleanup. Filename expressions evaluate once and
use the current Dir$ prefix. Missing loader adapters fail explicitly. A bare Run
is the portable current-program restart request used by these AMOS 1.3 programs;
it does not expose an interactive native editor/direct mode. Resume cannot
continue the terminated VM.

The page builder supports a compile-time linked-program manifest:

```json
{
  "game:next.amos": "sources/next.AMOS"
}
```

```sh
node tools/build_game_page.js main.AMOS /tmp/game.html \
  --assets assets.json --programs programs.json --debug
```

Program paths are relative to that manifest; names must match Run's resolved
requests. The builder compiles all linked factories up front and embeds them.
Run File starts the matching factory; bare Run restarts the current factory.
Transitions yield to a host timer after cleanup, preventing recursive startup.
Session files, speed, input configuration, fullscreen and sound session survive
transitions. Revision guards cancel stale transitions on replacement/disposal.
Missing or modified/uncompiled targets are not compiled dynamically in the browser.
The standalone JS factory needs its own loader host.

Pload is a machine-code loader, separate from Run. It supports a checked single,
unnamed, unrelocated HUNK_CODE executable, creating an owned `Asm     ` bank.
Negative bank numbers select chip memory. Malformed/truncated bytes and additional
hunks/relocations reject before bank replacement. This profile does not execute
the code. Native reference: Lib.s InPLoad/GetH.

## 5. Native interfaces and extension investigation

AREG(0–6) has independent signed registers alongside DREG(0–7). VARPTR supports
integer/string scalars and elements, resolving array subscripts once and capturing
the owner. Checked virtual bytes are big-endian and share Peek/Poke, word/long,
raw transfers and Copy with bank memory. Variables use unsigned addresses
`$90000000..$9fffffff`, returned as signed AMOS integers; existing bank and display
address ranges are unchanged. Local targets retire on procedure return. Changed
string contents retire old external pointers; equal-byte reassignment is not a
native heap-allocation model. Each array element has its own checked allocation;
pointer arithmetic cannot traverse adjacent cells. Float/whole-array layouts
remain unsupported.

Screen Base supplies an opaque, identity-checked host handle, not a fake native
Screen structure. Call and Doscall require `native.call(request)`. The frozen
request exposes register snapshots, checked memory operations and a Screen Base
handle resolver. Call validates its entry address; Doscall supplies the signed
library vector. Return `{dataRegisters:[...8 signed ints], addressRegisters:[...7]}`
(either field may be omitted). All register results validate before publication;
Promises and malformed results fail. No 68000 CPU or AmigaDOS process launcher
is built in. Native adapter memory side effects are synchronous and are not
rolled back if the adapter later throws. This makes Animplay, Zoomdemo and
clibefrunner compile, while native execution remains an explicit host dependency.

The previously unknown slot-4 calls match the official AMOS 3D source table:

| Offset | Command |
| --- | --- |
| `$0016` | Td Load |
| `$0036` | Td Object |
| `$0090` | Td Kill |
| `$00ec` | Td Move |
| `$01a6` | Td Angle |
| `$0318` | Td Redraw |
| `$04d6` | Td Dir |
| `$053c` | Td Cls |

The full catalogue is in `tools/reference/amos-3d-tokens.json`, with official
source and assembled-table verification. Twelve slot-4 commands now have a bounded
implementation, including loading the supplied object/template/vector surfaces
and rendering into indexed bitmaps. The [AMOS 3D contract](amos-3d.md) describes
the portable profile, 104-frame original excerpt, live demo and native parity
gates. The preceding STOS sprite sequence remains a separate compiler blocker;
the full intro is not yet accepted.

## Remaining first blockers

- Gru1/Amos/Map-Editor.AMOS has two complete embedded icon banks numbered 2.
  Choosing which bank to retain requires a source/asset correction, not relaxed
  bank validation.
- Gru1/Intr/Anim.AMOS and Anim.Bak next need STOS-compatible Move X/Y, Move On,
  Anim and Anim On. Their 3D commands now compile; a declared 3D-only excerpt runs.
- Gru1/Intr/Animplay.Bak contains the invalid hyphenated assignment noted above.
- Gru1/Intr/Scroll_C.AMOS contains a native compiled wrapper rather than supported
  tokenized source; Scroll.Bak is its editable counterpart.
- Gru2/SpriteXpro.AMOS next needs Clip and later audio commands.
- progs1/Amos progs/Grid.Bak calls undeclared `bxx`.

The main map editor, unknown extension and malformed backups were not rewritten.
Newly compiling applications can still encounter missing assets, requesters,
native adapter requirements or later runtime limitations. No native timing or
Amiga captures are claimed by the compilation or GPU tests.
