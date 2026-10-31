# Joy Src1 compilation milestone

All three nonempty programs in the supplied `joy/Joy Src1` directory now compile
without changing their source bytes. Four other AMOS files in that directory are
empty and cannot be compiled.

[Open the live editor demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/joy-source1.html)
([local page](../demos/joy-source1.html)). It offers both original LabEdit versions,
keyboard/mouse input, pause/resume and fullscreen. The browser checks are collapsed
below the editor.

| Supplied source | Bytes | Compilation | Execution checked |
| --- | ---: | --- | --- |
| `ASM.AMOS` | 0 | Empty input | No source available in this directory |
| `ASM_Intro.AMOS` | 0 | Empty input | No source available in this directory |
| `LabEdit.AMOS` | 7,056 | 178 instructions | Startup, painting, fill/clear, marker protection and Edit |
| `LabEdit.Bak` | 4,158 | 177 instructions | Same paths, including loading its external icons |
| `Labyrinth.AMOS` | 0 | Empty input | No source available in this directory |
| `Labyrinth.Bak` | 14,088 | 253 instructions | Startup through the source bounds issue described below |
| `ZoneDefiner.AMOS` | 0 | Empty input | No source available in this directory |

Original bytes and SHA-256 hashes are pinned in
[examples/Joy/Source1/manifest.json](../examples/Joy/Source1/manifest.json), including
the empty files. The supplied `asm_neu` directory has nonempty versions of the
missing programs, but these are separate versions and have not been substituted
for the Joy Src1 inputs. The supplied ADFs were inspected read-only with amitools;
no disk-image repair or source replacement was performed.

## Rebuild modules and standalone browser pages

From the repository root:

```sh
node tools/build_joy_source1.js joy/build-src1
```

Choose a new output directory. The tool validates pinned source/asset hashes,
writes a standalone `.module.js` and a debug `.html` page for every successful
source, and creates `index.html` and `report.json`. It exits with status 1 while
empty/failed inputs remain, after writing the complete report and successful
builds. Output files are exclusive; originals are never overwritten.

The four small runtime assets are declared explicitly in the manifest. The LAB
icons, second icon set and packed command picture come from the accompanying
`joy/joy3/grafiken` directory; the level-5 map comes from Joy Src1. LAB and Icons2
also match the two corresponding embedded icon chunks in `Labyrinth.Bak`.
These prepared path mappings do not establish that every original game asset or
language variant has been recovered.

The editor wrappers seed hardware mouse input to `(133,50)` before execution.
This is declared host input, not an AMOS or VM-variable patch. The source queries
the mouse immediately and otherwise a browser's initial `(0,0)` can address a
negative map cell before the user moves the pointer. The shared page builder has
an optional JavaScript API setting `initialMouse: [x,y,buttons]` for this purpose;
default pages retain their existing initialization. Limit Mouse itself still
captures bounds without repositioning the current mouse.

Editor keys: **1–6** choose tile types, **F** fills, **C** clears, left click paints,
right click clears a tile, and **Escape** terminates through Edit. Fsel$ Load/Save
still requires a prepared file selection from the host; no modal filesystem
requester is implied. Browser writes are session files.

## Compiler/runtime changes

`Pop` (`$036c`) now emits a driver control that discards exactly one pending Gosub
return address and falls through to the next instruction. It neither returns nor
exits a procedure. Procedure stack-depth checks prevent it from consuming a
caller's Gosub or a procedure frame; missing targets fail with their source
locations through the ordinary error/cleanup path. LabEdit uses it when refusing
to fill a map with a start/finish marker, then jumps back to its input loop.
Native loop-stack edge cases are not claimed verified by these tests.
The source is [InPop in the official interpreter](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BILib.s).

AMOS 1.3's uncached base `Limit Mouse` and `Ink` words can carry operands for their
existing overloads. The parser now normalizes the screen/rectangle mouse forms
and the one/two/three Ink forms into the existing typed operations. Cached overload
arities remain strict. No display/mouse bounds were relaxed.

## Repeated icon banks and Bank Swap

The grouped-bank decoder incorrectly rejected repeated `AmIc`/`AmSp` chunks.
Those are valid input for the original loader. It now validates every chunk and
applies them in file order: the last entry for a bank number replaces earlier
ones. This also applies to repeated explicit generic bank numbers.

This follows the official [Bnk.Load/LB_Multiples and Bnk.SaveA0](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BLib.s):
the grouped loader passes EntNul, whose low word is zero, selecting replacement
rather than image append. `AmIc`/`AmSp` chunks themselves do not store a relocated
slot number. A file with two `AmIc` chunks is accepted; the decoder does not invent
banks 9 or 10 for them. As in native loading, only the final active image bank is
retained after those chunks load.

At runtime, **Bank Swap preserves distinct icon-bank objects in slots 2, 9 and
10**. The unchanged `ICONBANKING[BANKMODUS]` procedure from `Labyrinth.Bak` is
executed in a declared three-bank fixture. All six mode transitions and repeated
selections preserve bank identity and select the correct active images. This
fix also allows Gru1's map editor to compile: its repeated icon chunks no longer
need a source/asset workaround. The Gru inventory is now 33/39 compilable.

Malformed/truncated entries still fail before changing the live bank set,
including malformed entries that would later have been overwritten. Bank memory
ranges, retirement checks and swap behavior remain checked.

## Execution evidence and remaining gaps

Both complete LabEdit programs run from their original entry point and terminate
through their original Escape/Edit path, using only mouse/key input. The protected
start and finish marker fills exercise real Pop/Goto behavior. Painting and fill/
clear update the original 384-byte map bank. Twelve 320×120 grid regions match a
separate planar-row decoder/compositor, including the current editor's embedded
initial map; twelve actual WebGL outputs match the physical copper/CPU output.
The live host and a standalone builder page are also exercised. These are portable
browser/source-derived checks, not an Amiga capture or full persistence test.

`Labyrinth.Bak` loads its banks, exchanges the icon sets and completes its sliding
panel setup. It then reports `Bank memory address out of bounds or retired at
line 70, byte 5450`. Original line 70 reads the neighbouring map cell; line 71
checks whether that cell is outside the map only after the read. This needs a
source-level ordering correction before full playback can be accepted. The
original remains pinned unchanged, and bank checks are preserved.

Next steps are that source correction and an input-only labyrinth replay, then
separately inventory the nonempty `asm_neu` programs (or obtain the intended full
Joy Src1 sources). Empty files are missing input, not unsupported tokens.
