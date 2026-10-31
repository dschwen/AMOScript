# ASM — Das Spiel showcase milestone

[Play the original intro](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/asm-intro.html)
· [Debug preview](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/asm-intro-debug.html)
· [Browser checks and captured frames](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/asm-intro-checks.html)

The new target is **ASM — Das Spiel**, the adventure by Michael Kafke with
Daniel Schwen's graphics. The complete, unchanged 104-line `ASM_Intro.AMOS` now
runs its sound and edition menus, animated TRONIC logo, both MOD tunes, four
title pages, custom high-score font and loading screen. It writes the selected
edition to `Ram:Level` and ends with the original `Run "ASM:ASM.Main"` request.
The standalone intro preview stops there. The new
[first-room build](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/asm-game.html)
([debug build](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/asm-game-debug.html))
now follows that Run request into the complete compiled main source. Its opening
briefings, copy-protection prompt, poster inspection and handle pickup run with
real input. **Later room assets and complete adventure progression remain open.**

The page uses the common game harness: Play Game activates sound/fullscreen;
Stop, Resume and Restart retain the usual lifecycle behavior. No startup input is
injected. Use the mouse to choose music and edition. Click the animated logo,
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
| ASM.AMOS | 1,868 | Compiles to 5,903 instructions; first-room interactions checked |
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

The report preserves ZoneDefiner's compile failure; seven supplied programs
compile, including the unchanged complete adventure. `npm run build:demo` rebuilds
the repository's normal/debug intro and first-room pages and browser checks.

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

## Main-game implementation and asset profile

The eighteen formerly missing encodings are implemented: Resume, System,
Get/Put/Del Cblock, Text Length, Screen Copy minterm, Bset/Bclr/Btst, Sort, Kill,
Dfree, Dir First$/Dir Next$, Request Wb, Tempo and Clip. Colon-form block Else
also accepts its immediately following statement, as the original source uses.

- Bit operations distinguish integer-variable longs from address-expression bytes,
  including a parenthesized address variable. Negative bit selectors reject;
  register/byte selectors wrap modulo 32/8. Checked bank-memory writes retain
  ordinary stale-address, range and active-player guards.
- Sort evaluates the selected array reference and sorts its complete owned
  storage ascending, preserving identity and typed values. The bounded profile
  limits it to 1,048,576 elements. Text Length uses the selected font's actual
  character advances and does not draw or move text cursors.
- Cblocks have separate numbering from ordinary blocks. Get truncates X/width to
  byte boundaries; Put restores raw common planes into the logical bitmap without
  Bob or Autoback replay. Native compressed bytes are not exposed by this API, so
  the runtime keeps owned canonical pixels. Invalid rectangles validate before
  replacement/writes. A negative Put axis restores that saved axis.
- Clip is an exclusive per-screen graphics region. Plot/lines/boxes/bars, graphics
  Text, fills, polygons and image drawing respect it; window Print and raw bitmap
  transfers keep their existing paths. Blank Clip resets it. Native wrapped/clipped
  coordinates and general drawing-mode/capture parity remain outside this profile.
- Explicit Screen Copy uses the Boolean minterm inside the checked common-plane
  rectangle. `$e0` is the source/destination OR used for the half-bright text panels;
  `$c0` remains ordinary copying. Existing overlap-safe snapshot semantics remain.
- Resume restores the captured error context and retries or branches to its checked
  label. System is terminal, retaining frozen source metadata and notifying the
  optional synchronous host after cleanup. Request Wb records requester destination
  and optionally notifies the host; it does not invent an OS requester.
- Tempo accepts 0–100 and updates the active Music controller. Inactive calls
  do nothing; each Music command starts at the native tempo 17. Tracker tempo and sample playback are separate.
- Kill/Dfree/directory enumeration use synchronous adapter capabilities. The memory
  adapter exposes an explicit **16 MiB virtual session capacity**, not the browser's
  disk quota. Writes enforce it and deletion frees bytes. The Node adapter queries
  the host filesystem. Directory results snapshot owned metadata, sort directories
  first with ASCII case folding, and return the portable 30-character name field
  (leading space/file or star/directory) plus eight size characters. Directory paths
  ending in `:` or `/` are supported; wildcard/filter and Set Dir forms remain open.

The pinned `game/` assets come from `joy/Joy Src2`, the supplied Gesichter bank,
and the text files on `joy/asm_neu.adf`. Room1 is prepared as its top 320×128 region;
control panels use their top 320×90 regions and are packed for the original Load /
Unpack commands. Original files and hashes remain unchanged. `Befehle.Pic` counts
one final zero alignment byte in BODY; only the prepared copy corrects its size.
`Befehle2.Pic` is an empty upload, and its disk-image block 1422 is overwritten.
The first-room build **explicitly substitutes supplied Befehle4 artwork** for that
conversation panel. Its reconstruction/recovery remains an asset task, not a
compiler relaxation. The page shows this limitation before Play.

The linked page carries the intro's font-enumeration state into the new main
factory and preserves session files across Run. The main reads and deletes the
original `Ram:Level`. Restart returns to the entry intro, avoiding a restart of
the main without its consumed startup file. The ⌨ [device keyboard](mobile-keyboard.md)
can answer the original letter-of-ASM prompt without joystick mapping conflicts.
The intro's second selector is an edition selector: **IO Light** intentionally
shows half the screen; **JOY** selects the complete view.

Adjacent lowres windows now use the existing native setup-row slicing path even
without an overlap/explicit priority command. This fixes the real-time main
startup's copper pre-fetch budget failure; no CPU overlay or budget relaxation
is used. The normal application retains Canvas for the intro's HAM image, while
all eight main-game checkpoints also execute with actual WebGL.

## Next milestones

1. Pin and validate the remaining room, dialogue and minigame assets. Some supplied
   room pictures are empty and several disk-image blocks are damaged; inventory
   and recovery must stay explicit. Replace the provisional conversation panel.
2. Exercise actual room transitions, inventory use and dialogue. Then cover save /
   load menus, minigames, scores and clean game-over/completion paths. The source
   compiles as a whole, but those paths are not established by first-room coverage.
3. Keep IndexedDB persistence separate from the current session filesystem.
4. Bring HAM to WebGL; the current intro retains an explicitly selected Canvas host.
5. Add ZoneDefiner's remaining Cdown$/Cup$/Cright$/Cleft$/Paper$ authoring functions.

Validation covers both music choices, both editions, the full title route,
right-click Pop/skip, Ram:Level bytes, terminal Run cleanup and the actual packaged
page's Play/Stop/Resume/Restart. Eight Canvas frames, seven GPU comparisons and
327,680 pixel round-trip checks are portable browser evidence, not native captures.
An independent Python oracle also checks the complete Zoom MOD pass: all 1,020
fields and four sample triggers, under both PAL and NTSC clocks.

The main replay adds eight Canvas/eight GPU frames and **81,920 independent
room pixels**, decoded from the original ILBM and sprite bank by Python. It never
edits VM variables, IP, banks or pixels. The actual linked page also verifies the
intro handoff, font lifetime, RAM-file consumption, device-keyboard answer and
Restart back to the intro. These are portable browser checks, not Amiga captures.
