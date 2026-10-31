# ASM — Das Spiel showcase milestone

[Play the original intro](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/asm-intro.html)
· [Debug preview](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/asm-intro-debug.html)
· [Browser checks and captured frames](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/asm-intro-checks.html)

The new target is **ASM — Das Spiel**, the adventure by Michael Kafke with
Daniel Schwen's graphics. The complete, unchanged 104-line `ASM_Intro.AMOS` now
runs its sound and difficulty menus, animated TRONIC logo, both MOD tunes, four
title pages, custom high-score font and loading screen. It writes the selected
level to `Ram:Level` and ends with the original `Run "ASM:ASM.Main"` request.
The preview stops there with an explanatory status; the **main adventure is not
yet compiled or playable**. This is the first showcase milestone.

The page uses the common game harness: Play Game activates sound/fullscreen;
Stop, Resume and Restart retain the usual lifecycle behavior. No startup input is
injected. Use the mouse to choose music and difficulty. Click the animated logo,
then left click the title pages or right click to skip to loading. The source
checks held buttons, so holding left click can advance multiple title pages.

## Supplied programs

All eight source files from `asm_neu` are pinned unchanged under
[`examples/ASM`](../examples/ASM/manifest.json). They match the corresponding
files in `joy/asm_neu`; the nonempty versions are not replacements for the empty
`joy/Joy Src1` uploads. The [token inventory](asm-inventory.json) records precise
first locations and counts for the remaining unsupported encodings.

| Source | Lines | Result |
| --- | ---: | --- |
| ASM.AMOS | 1,868 | Main adventure: remaining compiler/runtime features below |
| ASM_Intro.AMOS | 104 | Compiles; intro checked through terminal Run |
| Krypto.amos | 23 | Compiles |
| LabEdit.AMOS | 61 | Compiles; same source as the existing Joy editor demo |
| LabEdit.Bak | 61 | Compiles; same source as the existing Joy editor demo |
| Labyrinth.AMOS | 103 | Compiles; complete gameplay not yet checked |
| Labyrinth.Bak | 103 | Compiles; known source-level neighbour-read issue remains |
| ZoneDefiner.AMOS | 172 | Missing cursor/paper control-string functions |

Build standalone JavaScript modules, normal/debug intro pages and a compilation
report into a **new output directory**:

```sh
node tools/build_asm.js /tmp/asm-browser
# Open /tmp/asm-browser/index.html
```

The report preserves compile failures for the adventure and ZoneDefiner; the
builder still emits the six compilable programs. `npm run build:demo` rebuilds
the repository's two intro pages and the shared browser-check page.

## Asset preparation

Original picture/music/font bytes and SHA-256 hashes remain pinned. The source
expects packed pictures that were not supplied in that format. The build-time
[`asmIntroAssets.js`](../tools/asmIntroAssets.js) explicitly prepares:

- The top-left **320×256** indexed region of the supplied larger authoring IFFs,
  matching the intro's screen dimensions. Originals are retained, not overwritten.
- Literal-only AMOS packed-picture banks for SoundAuswahl, Level and Loading,
  which the unmodified source loads into bank 8 and Unpacks. Other title images
  remain ILBM, including the third image's actual HAM6 codes.
- The supplied FontEd `ASM/6` and `ASM2/9` bodies as preloaded bitmap catalogues.
  ASM/6 retains its proportional character advances; unsupported native font
  loading/relocation is not implied. These two pinned hunk layouts are decoded
  at build time, not executed as machine code.
- An explicitly **empty** ten-entry initial score table because `ASM.Scores`
  was not supplied. No historical names or scores are invented.

This is a declared asset-preparation profile, not proof of the original disk
installation's exact geometry, fonts on other machines, or Amiga capture parity.
`Tronic.Anim` is an icon bank used by the source's forty-frame logo loop; it is
not an IFF ANIM file. `Zoom.Mus` uses tracker pitch slides (`2xx`); the title tune
uses the existing note/volume playback.

The third title image requires HAM. The showcase deliberately selects **Canvas**;
the WebGL renderer still rejects HAM. Seven non-HAM frames also execute through
actual WebGL in the shared browser test. A fully covered lower screen no longer
gates the visible owner's mode; partially exposed HAM overlap remains bounded.

## Compiler and harness additions

- Numbered `Amal Freeze` freezes one channel without deleting it; `Amal On`
  resumes its retained program. AMAL `XM`/`YM` read current hardware mouse words.
- `Font$(index)` returns the owned enumerated font's 38-character description:
  name in columns 1–30, decimal height at 31, and `Disc` at 35–38. Unavailable
  indices return an empty string; negative indices and missing enumeration fail.
- `Set Input first,second` selects a byte terminator for both file input forms.
  A nonnegative low-byte sign consumes one following byte; a negative low-byte
  sign leaves it for the next input. `Input#` also recognizes comma separators;
  `Line Input#` preserves commas (its NUL delimiter also takes precedence). A
  required missing skip byte fails at EOF. The existing CRLF default is retained until
  Set Input is used. Settings are per program, not per channel.
- Tracker `1xx`/`2xx` change the current period only between note rows, with the
  original `$71`/`$358` clamps and no remembered parameter for `100`/`200`.
- The page-builder JavaScript API accepts `renderer: 'canvas'`, `diskFonts` and
  an explicit `stopOnUnlinkedRun: true` development-preview policy. Normal pages
  keep WebGL and reject uncompiled Run targets. The compiler still emits Run
  normally; the host retains its final frame and reports the missing next stage.

Native evidence: original
[`+Lib.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/%2BLib.s)
(`InSetInput`, `FnFont`, `InAmalFreeze1`),
[`+ILib.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/%2BILib.s)
(`ReDInp`),
[`+W.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/%2BW.s)
(`AmXMou`, `AmYMou`), and
[`extensions/+Music.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/extensions/%2BMusic.s)
(`mt_portup`, `mt_portdown`).

## Next: connect the adventure

1. **Compile the complete main source.** Add the named Resume encoding, compressed
   screen blocks, Text Length, Bset/Bclr/Btst and Sort with checked lvalue/array
   semantics. Implement the explicit Screen Copy minterm `$e0` and Clip rather
   than ignoring their operands. Preserve source locations and atomic validation.
2. **Complete host commands and file operations.** System/Request Wb need explicit
   host boundaries. Add Kill, Dfree and Dir First$/Dir Next$ through synchronous
   adapter capabilities; Set Input is now available. Keep browser session writes
   honest and expose downloads through Debug. IndexedDB persistence is separate.
3. **Load the supplied adventure data.** `joy/joysrc.adf` contains the room graphics,
   sprites, zones and text; `joy/asm_neu.adf` also contains dialogue, event/object
   text and labyrinth maps. Extract and pin these with the original ASM/ASM_1
   path aliases, hashes and provenance; audit missing references before building.
4. **Exercise startup and the first room.** Chain the compiled main factory with
   the existing `programs` option, preserving the intro's Ram:Level session file.
   The main source calls Font$ without its own Get Disc Fonts: establish the
   native font-enumeration lifetime across Run and carry that session catalogue
   deliberately, rather than substituting the system font. Check both difficulties,
   parser text, object selection, inventory/Bank Swap, room transitions and dialogue
   using real mouse/keyboard input.
5. **Cover progression and saves.** Add the source's Tempo form, driving and other
   minigames, score/save menus and clean menu/end transitions. Retain originals
   when fixing source bugs. Add input-only browser replays and independent image
   checks before promoting it beside the complete-game showcases.
6. **Bring HAM to WebGL.** Until then keep this preview's Canvas renderer explicit.
   Add the remaining Cdown$/Cup$/Cright$/Cleft$/Paper$ functions for ZoneDefiner
   as a separate authoring-tool task.

Validation covers both music choices, both difficulties, the full title route,
right-click Pop/skip, Ram:Level bytes, terminal Run cleanup and the actual packaged
page's Play/Stop/Resume/Restart. Eight Canvas frames, seven GPU comparisons and
327,680 pixel round-trip checks are portable browser evidence, not native captures.
An independent Python oracle also checks the complete Zoom MOD pass: all 1,020
fields and four sample triggers, under both PAL and NTSC clocks.
