# Roller II browser milestone

Roller II is the current end-to-end transpiler target. Wonderland remains a
working WebGL/Canvas/audio/fullscreen regression target. Keep the established
parser, lowerer, instruction-function dispatcher and headless runtime.

The [pinned source/data](../examples/Roller2/README.md) comes from the supplied
`RII/` directory. It is not a fresh emulator or Amiga execution capture.

```sh
node tools/audit_program.js 'examples/Roller2/Roller II.AMOS' > /tmp/roller2-audit.json
node tools/audit_mod.js examples/Roller2/music/mod.Roller_II_mus
```

| Evidence | Current result |
| --- | --- |
| Main source | 65,808 bytes; AMOS Basic v134 header; 65,782 code bytes; 1,199 physical lines |
| Token inventory | 194 distinct encodings; initially 43 unrecognized, now 41 after Track Load/Loop On |
| Whole-source compiler gate | Unsupported `$2b9e` Set Stack at line 2, byte 34; the full decoder checks all source, so later forms also need support |
| Embedded banks | None; original source loads external assets |
| Original asset-load slice | Full physical line 15 and leading Track Load statement of line 16 execute standalone, followed by a declared End guard |
| Sample bank | Loaded into bank 6; four Samples records decode (9,900 / 1,000 / 9,200 / 2,000 bytes at 15,000 Hz) |
| Main module | `mod.Roller_II_mus`: 84,006 bytes, M.K., four channels, 22 orders, twelve patterns, ten nonempty samples |
| Other music | Over.mus / Ywon.mus are separate AMOS Music banks in bank 3, not MODs |
| Sprites/icons | Four sprites; 117 icons; includes six-plane assets |
| Images | All five supplied primary IFFs decode already; title is 320×512, six-plane EHB; the others are 320×256, five planes |
| Browser evidence | [Original-load/MOD inspector](../demos/roller2.html) and [direct song player](../demos/tracker.html), with HTML Preview links from the gallery; no gameplay or VM Track Play yet |

The independent original statement fixture preserves its bytes, but excludes
Dir$, TRUE, Track Play, startup controls, procedures and gameplay. It is not a
modified full game advertised as compatibility. File lookup is a prepared,
case-insensitive `RII:` mapping; native relative-directory semantics remain open.

## Work in execution order

1. **Music loading and playback.** The [MOD reader and Track Load/loop foundation](mod-tracker.md)
   are implemented, along with a pure field-stepped player for C/A/E/F/D and
   phase-preserving Web Audio loop/volume/rate support. The complete tune traverses
   1,376 rows in 9,631 fields; the direct browser player has native audio checks.
   Next integrate Track Play/Stop with driver-owned ticks and bank mutation.
   Share the four hardware voice identities with Sam Play and cover
   mute/Stop/Resume/failure/replacement using the existing Web Audio session.
2. **Startup and the first title.** Implement Set Stack and Break Off with explicit
   portable semantics; boolean TRUE/FALSE and Not; Dir$ and Exist; Hide/Show
   overloads; Pop Proc and the original `FLOAD`/wait/fade routines. Do not register
   names without parser/lowerer/runtime behavior. Keep module calls explicit until
   playback exists. The first actual image request is `terminator el`.
3. **Screen/asset setup.** Screen Hide/Show/Clone, Get Palette, Screen To Front,
   Rainbow Del and supported drawing/text forms need integration. The tall EHB
   title requires a bounded presentation window, not an unrepresentable 512-line
   PAL scanout. Direct six-plane sprite images need the original low-four-plane
   hardware behavior; the current AMOS bridge rejects depths above four.
4. **First playable level.** Add Add/Swap forms, checked Doke/Deek/Leek/Copy/Fill,
   Get Icon, Mouse Zone, Scin and Key State as actually used. Validate tile movement,
   colours, collision, scrolling modes, timers and keyboard/joystick controls
   against the unchanged source and level data. Wider general forms remain gates.
5. **End states and tools.** Implement the AMOS Music bank format/player for
   game-over and win tunes, Mvolume fades, Boom effects, highscores and help/editor
   forms. The intro's native Run target is separate from the main source entry.
   Browser file selection/persistence remains host work; IndexedDB stays planned.
6. **Compatibility acceptance.** Full-game compilation, deterministic level and
   end-state replays, integrated WebGL/Canvas/audio/lifecycle checks, source-derived
   traces and external reference captures. Token recognition is not a completion
   percentage; the MOD inspector is not tracker playback.

Remaining decoder encodings span startup/flow, directory/files, booleans,
visibility/cloning/palette, drawing/text, memory/tile operations, mouse/keyboard
and music. The full audit command reports exact offsets, counts and first source
locations; use that inventory rather than guessing offsets from command names.

Local baseline for this slice: 517 tests, 28 offline browser scenario pages,
the existing 179 renderer plus eleven live-game GPU/CPU comparisons, and existing
native sample/fullscreen checks. These do not establish Roller II gameplay,
tracker audio fidelity, target-device performance or new hosted CI evidence.
