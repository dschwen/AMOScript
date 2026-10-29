# Planet Zybex showcase milestone

Planet Zybex is the next full-game target, alongside the existing Roller II and
Wonderland regressions. The supplied `Planet_Zybex/Zybex.AMOS` is attributed in
its original comments to **P.J. Hickman**. The unchanged source and seven external
level banks are pinned under [examples/PlanetZybex](../examples/PlanetZybex/README.md).

The [browser preview](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex.html)
currently shows all seven original level backgrounds, with horizontal/vertical
scrolling, WebGL2 and fullscreen. The **Score display (fixture)** option shows
the original hires score strip below a lowres level-1 playfield; a key advances
between two declared score/lives inputs. **Default startup (fixture)** exposes
the original reset/close/48-line Sprite allocation prefix. **Game-over text (fixture)**
shows the original transparent outline, an explicit opaque comparison and restoration.
All options are marked as previews.
**The full game does not compile or play yet.** No AMAL commands are replaced by
no-ops and no running game variables, IPs or assets are patched to make the preview work.

## Source and dependency audit

The program is 126,082 bytes with 68,434 code bytes and 1,522 physical lines.
Its embedded banks contain 47 four-plane sprite/Bob images and a 45,526-byte
Samples payload. All seven explicitly loaded external files are supplied.
Four worlds are 960×160 and three are 320×640, all with 16 colours.

The [pre-implementation inventory](planet-zybex-inventory.json) pins the original
source hash, complete bounded token audit, strings, embedded-bank metadata and
first compilation failure. It found 15 unsupported **encodings**, not an estimate
of development time. Recognized tokens can still expose runtime gaps.

Six of those encodings are now implemented:

- Slot 2 `$0056`, `Unpack bank To screen`, decodes the original packed backgrounds.
  Full indexed bitmaps/palettes match an independent Python decoder; 35 scrolled
  windows match independent RGBA expectations and actual GPU output. See
  [packed pictures](packed-pictures.md).
- `$1fa2`, global `Amreg(index)` reads/writes, uses native signed-word storage.
  The unchanged `clear_amal` procedure runs with declared score/bullet inputs and
  verifies all 26 registers. This establishes communication storage, not an AMAL
  interpreter. See [Amreg](amreg.md).

- `$13c6`, `At(x,y)`, returns ordinary encoded cursor-control strings with either
  axis omitted. The two original score statements now run against the original
  640×10 hires strip, alongside the 320×160 lowres playfield. Four independent
  PAL/NTSC frames match actual GPU output. See [At and score display](at-text.md).

- `$0cee`, `Default`, restores the shipped display profile, clears display and
  animation resources, resets owned audio and retains language/bank/filesystem
  state. Original lines 90–92 now run through declared startup guards in the
  preview. See [Default](default.md) for its profile and remaining native gates.

- `$1986`, `Set Sprite Buffer`, now allocates and owns the triple stream pool.
  Original line 93 sets 48 lines (4,800 bytes). Direct-sprite publication consumes
  the pool’s control/data words; same-size requests preserve state, resize clears
  assignments and enforces the native height gate. Computed/wide sprites remain
  unsupported. See [Sprite buffers](sprite-buffer.md).

- `$1066`, `Gr Writing`, selects transparent (0/JAM1) or opaque (1/JAM2)
  graphics Text/patterned-line output per screen. The original five GAME OVER
  text passes preserve their outline; Print/Writing keep their own mode. See
  [graphics writing](gr-writing.md) for the supported profile and native gates.

The whole-program compiler now stops at **Amal Off, line 179, byte 8844**.
There are 9 remaining unsupported encodings:

| Encoding | Command | Current uses |
| --- | --- | --- |
| `$1fd2` / `$1fe2` | Amal Off, all / one channel | 1 / 2 |
| `$1fbc` | Amal On, all channels | 2 |
| `$2012` | Amal channel,string | 33 |
| `$1f94` | Channel ... To Bob/Sprite | 27 |
| `$205a` / `$206c` | Synchro Off / Synchro | 7 / 7 |
| `$207a` / `$20ae` | Update Off / Update | 7 / 9 |

Re-audit with `node tools/audit_program.js examples/PlanetZybex/Zybex.AMOS`.
The JSON above remains the frozen baseline rather than silently changing its
historical counts after each compiler addition.

## Implementation sequence

1. **Packed levels and shared registers — accepted foundation.** Preserve native
   screen metadata, ordinary bank ownership, full bitmap pixels and word register
   semantics. The live inspector and checks use declared source excerpts, not the
   complete executable. The preview starts immediately and needs no test replay.
2. **Startup and presentation contracts.** Implement Default's actual reset,
   Set Sprite Buffer's allocation/lifetime contract, Gr Writing 0 and Print At's
   retained-y positioning. Validate the 640×10 hires score strip at y=211 alongside
   the 320×160 lowres playfield. Preserve palette/setup budgets, double buffers,
   screen identity and original startup. At’s retained-y positioning and the
   mixed hires/lowres score layout now pass a declared presentation fixture.
   Default now passes its reset matrix and the original guarded startup prefix.
   Set Sprite Buffer now passes its owned-pool/direct-sprite checks and original
   startup allocation. Gr Writing 0/1 now passes original GAME OVER text and
   explicit comparison/restoration checks; this is not gameplay acceptance.
3. **AMAL execution and manual frame control.** Add checked Channel bindings,
   owned compiled AMAL strings, local registers, the existing 26 global words,
   on/off lifetimes and explicit Synchro/Update behavior. The source deliberately
   disables automatic synchronization/update and calls them after Wait Vbl.
   Keep field scheduling separate from rendering and host requestAnimationFrame.
   Do not implement these commands as aliases that omit movement or swapping.
4. **Player, bullets and enemies.** Support the actual AMAL language used here:
   labels/jumps, Let/arithmetic/comparisons, For/Next, Pause, Move, Anim, Autotest,
   Exit/Direct, random Z, Joy1, BC collisions and screen-coordinate functions.
   Derive label abbreviation, signed-word arithmetic, animation/movement timing,
   collision-trigger interruption and bounds from the original interpreter.
   Logical Sprite 15 uses images up to 48 pixels wide; the current direct 16-pixel
   sprite path cannot render it. Add computed/wide allocation through physical
   sprite channels and shared copper snapshots, not an RGBA overlay. Other images
   up to 80 pixels wide are Bobs, not evidence that all need hardware allocation.
5. **Connected level 1.** Run the entire original source through native setup,
   scrolling, joystick movement, firing, enemy hits, landscape collisions,
   explosion, score/lives and a natural restart. Use input/host events only and
   independent sample/pixel evidence. Keep every earlier boundary explicit until
   this connected path passes.
6. **Horizontal/vertical progression and full page.** Continue from level 1 into
   real level 2, then all seven maps, docking/win/game-over/finish-message returns,
   and source-driven replay. Publish the normal and debug application pages with
   Play Game, gesture-activated sound/fullscreen, Ctrl fire, keyboard/Gamepad and
   optional touch controls, using the shared page harness. Preserve the original
   program's direct game startup; do not inject startup input or verification
   state. Keep checks/captures collapsed and mark the page playable only after
   the connected game acceptance passes.

The next slice is **AMAL bindings**, followed by program execution and manual
synchronization/update. Default and Set Sprite
Buffer now have implemented reset/allocation contracts; native computed/wide
sprite allocation and custom interpreter preferences remain open. Different
COLOR00 values across score/playfield (the later thunder effect) still require
their own setup/capture verification.

Every slice must include compiler/runtime integration, source-located errors,
independent expectations and a repository demo with an HTML Preview link. Native
Amiga captures and exact beam/interrupt timing remain separate acceptance gates.

## Current verification boundary

The background fixture retains the original Load/Unpack lines for each level,
then adds a declared Wait Key guard. All other game statements are omitted;
embedded image/sample banks remain intact. Its UI only changes the preview
screen offset. The separate register fixture retains original Global/array setup
and `clear_amal`, with declared input values 1234/4. Neither fixture controls a
running game or supplies hidden replacements for AMAL.

`tools/reference/packed-picture.py` expands the original pointer/flag/byte streams
independently before reconstructing planes and pixels. The shared browser scenario
checks seven worlds, 35 independent windows, 35 GPU/reference frames and the
original register exchange.

The score fixture retains original screen setup 111–128, level-1 Load/Unpack/Display 245–249, playfield palette/priority 1207–1209 and copy 1252, and score
updates 1310–1313/1482–1485. Synthetic inputs, one explicit buffer swap and key
guards replace the missing game loop; it does not execute Synchro/Update or AMAL.
Both PAL/NTSC outputs preserve the actual row-210 setup gap and y=211 hires
placement. Four independent full-frame PNGs/score bitmaps and GPU comparisons
extend the presentation checks to 39 GPU frames. Original Default/Screen Close/
Close Editor lines 90–92 now add two PAL/NTSC GPU frames and two display-clear
checks, bringing that total to 41. The prefix now includes original Set Sprite Buffer
line 93. A separate declared direct-sprite matrix adds ten PAL/NTSC Canvas/GPU
comparisons for same-size preservation, resize clearing, redraw and Default’s
restoration, bringing the total to **51 GPU comparisons**. Its image is a literal
two-row test bank, not a Zybex player replacement. The rest of startup and
gameplay still do not execute.

The GAME OVER fixture retains original lines 189–199 on a declared blank screen
2, then replays 193–199 with explicit opaque and restored transparent modes.
Synthetic inputs/key guards replace the surrounding finish routine; its AMAL,
audio, fades, manual Update and score paths do not execute. An independent Python
rasterizer with pinned public-domain font bytes produces three indexed/RGBA
expectations and PNGs. Six PAL/NTSC Canvas/GPU frames bring the total to **57 GPU
comparisons**. These are portable font/raster checks, not a native Topaz capture.

Live-host checks cover level replacement, scroll limits, score fixture
selection/real key advancement, startup-reset/close guards, real-key GAME OVER mode changes, fullscreen and owned input/GPU disposal. Existing
Roller II/Wonderland launch, gameplay, audio and editor regressions remain required.
