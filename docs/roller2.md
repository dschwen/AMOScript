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
| Token inventory | 194 distinct encodings; initially 43 unrecognized, now 11 after tracker/startup, display/memory commands, Boom and Fill/Copy |
| Whole-source compiler gate | Unsupported Set Line `$1034` at line 333, byte 16,928; recognition alone still does not prove parser/runtime support for later forms |
| Embedded banks | None; original source loads external assets |
| Original asset-load slice | Full physical line 15 and leading Track Load statement of line 16 execute standalone, followed by a declared End guard |
| Original startup prefix | Unchanged physical lines 1–17 execute through Hide, followed by a synthetic Wait Key; Set Stack records 501 entries, Dir$ is RII:, ITROM is -1, tracker playback/looping is active |
| Original first FLOAD | Unchanged lines 1–18 plus original procedure 63–68 load/fade the first logo; declared Wait Key/End guards stop before WTIN and gameplay |
| Original intro transition / declared main-title handoff | Unchanged lines 1–20 and WTIN/FDZ/FLOAD now handle input and fade-out. The fixture includes original array/highscore setup 32–56, SASINIT 205–239 and bank loads 275–279, skips remaining setup 281–286, then executes original title load 287; the menu/game remains excluded |
| Original joystick mouse movement | Original LIMM and lines 299–303 execute in a separate synthetic title-load/step fixture; X/Y Mouse assignment clamps doubled words to explicit bounds. Fourteen keyboard/Gamepad steps pass in the mouse demo; this is not integrated menu selection |
| Connected intro and guarded menu | Original executable sequence through 316 now runs, including setup 281–286, original FLOADs, continuing tracker and menu. Destination guards replace game/editor/scores/help routines. Ten connected browser cases select nine outcomes; three independent/GPU states and optional music controls. [Contract](roller2-menu.md) |
| Level metadata | Original line 608 reads all fifteen pinned level headers; original Doke/Wait Vbl line 474 edits only the time word. Generic-bank word/long access is bounded; icon addressing now runs original ICCOPY before its entry guard. [Demo](../demos/roller2-levels.html) |
| Original game-entry icon copies | Original 565–570 and ICCOPY 240–246 execute after menu game selection. Bounded live icon table/planar views preserve the inclusive allocation-tail byte and old masks. Independent PNGs and two additional GPU frames. [Contract](icon-memory.md) |
| Game screens and first level load | Original 571–600 creates hidden/game screens, initializes rainbow/status rows, loads level 1 and refreshes text through Cline. Independent portable-font/rainbow panel pixels match Canvas/GPU. Guard precedes overlapping-window presentation, board drawing and gameplay. [Contract](cline.md) |
| Editor memory transfers | Original Fill/Copy clear/backup/restore statements run on all fifteen prepared original payloads. Complete bytes/metadata/allocations and redraw-guard return are checked; no editor loop, redraw or persistence. [Contract](bulk-memory.md) |
| Boom and original arrows | Source-derived four-voice finite Boom unlocks original PFEIL/N34 and its actual timeout branch. Three level-2 turns, independent one-pixel/PNG expectations, twenty Canvas frames and ten GPU comparisons. [Boom](boom.md), [arrows](roller2-arrows.md) |
| Original pause modes | Original PAUSE/IPause now run in a separate progression fixture: paid mouse/Help pause, Space popup, keyboard/mouse/joystick exits, source Timer restoration and host lifecycle. Twenty Canvas images/ten GPU comparisons. [Contract](roller2-pauses.md) |
| Original bonus / next level | ZAEHLHOCH returns through LEVLOAD into the real second-level bank, ready prompt and starting ball. Inclusive bonus, bank retirement, Stop/Resume and absent-next-file win guard pass; fourteen Canvas frames and seven GPU comparisons. Other handlers remain guarded. [Contract](roller2-progression.md) |
| Original colour collections | KCWEG/HCWEG, sparse BCL Fade lists and GAMED now execute. All five level-1 colour tiles clear; independent pixels/map bytes/score/count/RNG and seven further GPU comparisons pass. Guard precedes bonus scoring/level loading. [Contract](roller2-colours.md) |
| First original floor movement | Original BEWEG/floor/stop/Lasttest now run through main string dispatch and cyclic Add. Level 1 slides to the colour-handler guard; independent trajectories/PNGs, original prepared stop/collapse maps and six more GPU comparisons pass. [Contract](roller2-movement.md) |
| Original game input loop | Unchanged JOAB 619–639 after connected setup: countdown, toggles, Key State and Escape title return. Four guarded direction paths, twenty-four Canvas checks and six additional GPU frames; movement/pause/game-over handlers remain gated. [Contract](roller2-input.md) |
| Connected board and ready prompt | Original startup/menu and entry through 617, GAMEDISP, blinking prompt, ball palette/sprite, fade and border. Eighteen Canvas checks and six GPU frames; guard precedes movement. [Ball contract](roller2-ball.md). [Contract](screen-priority.md) |
| Isolated board routine | Unchanged GAMEDISP renders all fifteen supplied maps; independent indices/pixels/counts pass. Sixteen Canvas frames and two additional GPU frames; declared palette restoration, no foreground/gameplay integration. [Contract](roller2-boards.md) |
| Sample bank | Loaded into bank 6; four Samples records decode (9,900 / 1,000 / 9,200 / 2,000 bytes at 15,000 Hz) |
| Main module | `mod.Roller_II_mus`: 84,006 bytes, M.K., four channels, 22 orders, twelve patterns, ten nonempty samples |
| Other music | Over.mus / Ywon.mus are separate AMOS Music banks in bank 3, not MODs |
| Sprites/icons | Four sprites; 117 icons; includes six-plane assets |
| Images | All five primary IFFs decode. Bounded AMSC displays the first logo at (128,42). The 320×512 six-plane EHB main title now displays through a bounded PAL window, preserving lower bitmap rows. Wider modes/placement remain gated |
| Browser evidence | [Guarded title-menu selection](../demos/roller2-menu.html), [Intro, initialization and main-title image](../demos/roller2-intro.html), [first image/FLOAD](../demos/roller2-title.html), [original startup](../demos/roller2-startup.html), [load/MOD inspector](../demos/roller2.html) and [music](../demos/tracker.html), with HTML Preview links; selected routines and gameplay remain excluded |

The independent load-only statement fixture preserves its bytes, but excludes
Dir$, TRUE, Track Play, startup controls, procedures and gameplay. It is not a
modified full game advertised as compatibility. File lookup is a prepared,
case-insensitive `RII:` mapping. The separate original startup prefix now executes
Dir$/TRUE/Track Play through Hide. Per-program directory prefixes and synchronous
Exist metadata queries are implemented; parent/assign/lock semantics remain open.

## Work in execution order

1. **Music loading and playback.** The [MOD reader and Track Load/loop foundation](mod-tracker.md)
   are implemented, along with a pure field-stepped player for C/A/E/F/D and
   phase-preserving Web Audio loop/volume/rate support. The complete tune traverses
   1,376 rows in 9,631 fields; all 1,997 note triggers and all ten instruments now
   have independent note/PCM checks, including full initial fetches before silent
   repeats. Compiled Track Play/Stop now use driver-owned field wakes, native
   bank preprocessing and the four shared sample voices. The browser player
   passes twelve native audio comparisons and offers Pause/Resume/Stop. Host
   pause freezes the sequencer but does not restore held sample phase. Bank
   replacement/erasure/shrink, active-write rejection and failures are covered.
   Wider effects, exact DMA/sample interrupt contention and captures remain open.
2. **Startup and the first title.** Set Stack metadata, Break Off host flag,
   TRUE/FALSE/Not, Dir$/Exist and nested Hide/Show now execute with explicit
   portable contracts. The unchanged first 17 physical lines pass with a synthetic
   Wait Key guard. Pop Proc and the original first FLOAD now execute with screen
   visibility, static clones, Get Palette, captured Fade To goals and bounded AMSC
   placement. Seven source-derived image states match independent Python pixels
   and seven GPU/Canvas frames; [details and limits](roller2-title.md).
   WTIN/FDZ now execute unchanged, including 32-entry explicit integer Fade lists.
   A [declared handoff to original main-title load 287](roller2-intro.md) shows the
   EHB title after the intro, with thirteen independent states and eleven GPU
   comparisons. Original highscore/array setup, SASINIT and work/icon/sprite bank
   loads now run, with independent table/score assertions in the same browser demo.
   The connected menu demo now runs original setup 281–286 and the menu after
   the intro/initialization, with no synthetic title load. Music continues through
   the transition. Next implement selected routines and their dependencies.
3. **Screen/asset setup.** Screen Hide/Show/Clone and Get Palette support the first
   image. Original LIMM and joystick X/Y Mouse movement now run in a bounded
   [mouse demo fixture](../demos/mouse.html). Mouse Zone and original selection branches now execute in a separate
   [connected guarded menu fixture](roller2-menu.md), including original
   startup/setup. Bounded Screen To Front now presents the original ready prompt;
   Rainbow Del and remaining drawing/text forms still need
   integration. Double-buffered clone/owner retirement forms remain gated. The tall
   EHB title now retains its full bitmap behind a bounded managed window. Direct
   six-plane sprite images now use the original low-four-plane
   hardware behavior for bounded 16-pixel direct sprites.
4. **First playable level.** Checked generic-bank Doke/Deek/Leek/Loke are now
   implemented, with original level metadata/time statements checked across all
   fifteen files. First game entry now calls original ICCOPY through raw Start(2) icon
   aliases. The guard now follows original setup and level 1 loading through 600.
   Cline refreshes status rows. A new connected [ready fixture](screen-priority.md)
   now runs through 617 with original GAMEDISP, foreground prompt/blinking,
   mouse/Fire exit, ball colours/sprite, fade, border and Timer initialization.
   JOAB input and Key State now run through 639 with guarded destinations.
   Main string Goto and cyclic Add now run original floor/stop/collapse paths.
   KCWEG/HCWEG, sparse BCL and score/tile effects now collect the five first-level
   colour tiles before a retained bonus guard. A separate progression fixture runs
   ZAEHLHOCH/LEVLOAD into real level 2; a further fixture runs original PAUSE/IPause.
   Finite Boom synthesis now unlocks unchanged PFEIL/N34, including its timeout.
   Original Fill/Copy now back up, clear and restore all fifteen prepared payloads
   before a declared redraw guard. Next implement Set Line and other reached handlers,
   Swap and remaining bank/text forms, Get Icon and Scin as actually used. Validate tile movement,
   colours, collision, scrolling modes, timers and keyboard/joystick controls
   against the unchanged source and level data. Wider general forms remain gates.
5. **End states and tools.** Implement the AMOS Music bank format/player for
   game-over and win tunes, Mvolume fades, wider synthesis forms, highscores and help/editor
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

Local baseline for this slice: 633 tests, 39 offline browser scenario pages,
179 renderer, eleven Wonderland live-game, seven Roller II first-image, eleven Roller II intro and three connected-menu, two icon-copy, two board and six ready-prompt/ball and six input-loop and six movement and seven colour-collection GPU/CPU comparisons, plus existing
native sample/fullscreen checks. These do not establish Roller II gameplay,
tracker audio fidelity, target-device performance or new hosted CI evidence.
