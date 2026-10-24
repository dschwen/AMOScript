# Wonderland browser milestone

Assessment: 2026-10-24. **The original game does not compile or run yet.**
Wonderland is the next end-to-end compatibility target. Use its actual code and
assets to choose the next language/runtime/display work, while retaining the
existing parser, lowerer, instruction-function dispatcher and headless runtime.

## Reproducible target

[`examples/Wonderland`](../examples/Wonderland/README.md) contains the unmodified
51,424-byte `Wonderland.AMOS` and seven companion assets, with an upstream license,
pinned revision and SHA-256 manifest. The title in the original source is
“Dithell's Wonderland”. It includes the game and level editor.

```sh
node tools/audit_program.js examples/Wonderland/Wonderland.AMOS > /tmp/wonderland-audit.json
node bin/amoscript examples/Wonderland/Wonderland.AMOS /tmp/wonderland.js
```

The first command succeeds and inventories the whole bounded token stream. The
second currently fails with `Unsupported token 0x1646 at line 372, byte 13910`
(`Reserve Zone`). The original first 64 lines compile and execute through Wait Vbl,
Load Iff and the original title/menu marker Bob, including both startup branches.
Canvas, copper and GPU output match an independent source-derived composition. See
[title display support](title-display.md),
[startup support](startup.md), [bank memory](bank-memory.md), [Key Speed](key-speed.md)
and [audio support](audio.md).
The inventory uses original assembled token tables, including the music extension;
it never adds unsupported commands to the production compiler table.

| Evidence | Current result |
| --- | --- |
| Source size | 753 physical lines; 30,712 code bytes |
| Static inventory | 6,011 token occurrences; 142 distinct encodings |
| Decoder gap | 9 unrecognized encodings, appearing 25 times (initially 44 / 119) |
| Embedded image bank 1 | 75 images, four planes |
| Embedded level bank 4 | 7,206 bytes, including five level maps and rainbow seeds |
| External samples | Six PCM records decode and play through the optional Web Audio adapter |
| Four original ILBMs | All now decode and match independent PNG expectations |
| Original-program execution | 64-line title setup plus declared original-menu and game/editor screen-setup and three enemy-initializer fixtures and the original Escape/title and post-death Fade/Wait slices and original level/score fields and all five map-paste/copy loops run; complete game remains blocked |

These counts describe lexical recognition, not a compatibility percentage. A
recognized token may still have an unsupported overload or runtime limitation.
For example, the game uses four-plane hardware sprite images; the existing direct
AMOS sprite writer currently accepts at most two planes. Complete lowering and
execution will expose further gaps after the first decoder blockers are removed.

## Required work, in execution order

1. **Startup and language forms.** `Set Buffer` compile metadata, host-adapted
   `Amos Lock`/`Close Editor` and assignable/readable VBL `Timer` are implemented
   in a [documented subset](startup.md). `Key Speed` and bounded generic-bank
   `Peek`/`Poke`/`Start` are also implemented. Next add verified offsets and semantics
   for `Rnd` and the remaining numeric functions. Bounded Print Using now
   renders the original level/score fields in a [declared fixture](print-using.md). Scancode and the original Escape/title branch
   now pass a [documented fixture](scancodes.md). Named-label On Gosub/Goto now
   execute the original dispatch and three unchanged initializers in a
   [declared fixture](computed-branches.md). All music-extension
   calls used by Wonderland now have [implemented contracts](audio.md).
   Host-only editor/system commands need explicit documented adapter
   behavior. Unsupported forms must continue to fail with source locations.
   Bank addresses now have stable owned storage and checked accesses. `Timer` must
   follow injected AMOS time; its original startup speed benchmark must not be
   used to justify making timing depend on instruction counts or animation frames.
2. **Title/menu.** `Load Iff`, cursor disabling, view staging, table-based rainbows
   and the title's original Bob now run in a [documented subset](title-display.md).
   Joystick up/down/fire and the original menu loop now execute in a declared
   [keyboard/gamepad fixture](joysticks.md), including original animation and
   background toggle routines. Whole-program integration remains open. Resolve original
   `AMOSPro_Productivity2:Wonderland/...` filenames through a preloaded synchronous
   browser files adapter. Browser fetch/preload happens before execution. Define
   keyboard/gamepad mapping, focus and release behavior. The target is executing
   the original menu loop and entering the game/editor through its own branches.
3. **Playing one level.** `Screen Display` and `Screen Offset` now run in a
   [bounded original screen-setup fixture](screen-windows.md), with scrolling and
   independent panel pixel checks. [Fade to black](fade.md) now executes the original
   post-death Fade/Wait slice with a declared trigger. [Screen Copy and Logic/Physic](screen-copy.md)
   now publish all five maps through the unchanged original data/paste/copy loops
   in a declared fixture. [Flash Off](flash.md) now completes the unchanged original
   game/editor screen setup; explicit Flash cycles also run on the injected clock.
   Next implement remaining rainbow behavior and the necessary sprite support.
   The world is 960×288 with a scrolling
   320×168 game window and a separate 320×32 score window. Preserve logical and
   physical buffers, Autoback, manual Bob clear/draw/swap, image hotspots and
   collision semantics. Verify movement, jumping, collectibles, enemies and death.
4. **Complete program paths.** Cover all five levels, score/lives, win/lose/restart,
   background toggle, sample selection/play/stop/loop behavior and browser audio
   activation. Scancode is implemented; the editor still needs mouse clicks/limits/zones,
   `Bload`/`Bsave`, and a browser file-selector adapter for `Fsel$`. Verify a saved
   level can be reloaded. Do not silently strip editor or audio calls to claim the
   unmodified program is supported.
5. **Compatibility evidence.** Add deterministic input replays with fake clocks
   and finite budgets, covering both startup speed-test branches. Compare menu,
   play, scrolling, sprite/rainbow output and editor behavior against real AMOS
   reference execution when available. Keep reference captures separate from
   independent asset decoding and CPU/GPU comparisons. Measure sustained browser
   play and rendering before declaring the milestone complete.

The complete list of 19 currently unrecognized encodings, signatures, occurrence
counts and physical source locations is generated by the audit command above.
The [asset demo](../demos/wonderland.html) also displays a compact blocker list.

## Acceptance gates

| Gate | Done when | Current state |
| --- | --- | --- |
| W0: reproducible assessment | Original bytes pinned; complete token inventory; image/bank checks and browser asset demo | Implemented |
| W1: whole-program compilation | Unmodified source lowers and emits a standalone factory with implemented command contracts; isolated factories and useful failures tested | Open |
| W2: original title/menu | Browser executes startup and original interactive menu, using original assets | Original menu fixture passes keyboard/gamepad replay; whole-program integration open |
| W3: playable first level | Scrolling world, score panel, controls, Bobs/sprites, collisions and lifecycle work together | Open |
| W4: complete game/editor | Five levels and end states; sound and editor load/save paths exercised | Open |
| W5: compatibility validation | Deterministic replays, reference comparisons and sustained-play performance recorded | Open |

W1 is a complete-program contract gate; title work can progress incrementally
while remaining editor/game commands are being implemented. The browser
demo checks the 64-line title setup and W0 images; passing it does not mean the
complete original program ran. W1 remains open after this startup slice.

## Display integration and current loader changes

Follow [the display architecture](display-architecture.md) and
[the Amiga WebGL plan](amiga-webgl-display-plan.md). Add AMOS screen/window commands
to the shared display model and copper builder, keeping CPU/GPU consumers on the
same immutable snapshots. `snapshotPlayfield` remains the full-bitmap migration
API; physical display windows belong in `snapshotDisplay`. Preserve the CPU
browser path as the initial functional target; GPU host switching or unrelated
hardware modes need not block original-program progress.

The first concrete loader blockers are fixed: the original title/landscape use
legacy CAMG SPRITES metadata, panels use a PAL monitor ModeID, and three images
contain inactive CRNG records. The loader retains these metadata, normalizes the
display flags, and rejects active cycling and unknown modes. See the
[ILBM contract](planar-display.md). This follows the
[original ILBM format](https://wiki.amigaos.net/wiki/ILBM_IFF_Interleaved_Bitmap)
and [display database IDs](https://wiki.amigaos.net/wiki/Display_Database).

`tools/wonderland_goldens.py` independently decodes the four original images into
test PNGs with OCS high-nibble palette expansion and doubled lowres samples. Unit
and browser tests compare every output byte. These are independently decoded
original assets, **not Amiga execution captures**. Regenerate with:

```sh
python3 tools/wonderland_goldens.py
npm run build:demo
npm run check
npm run test:browser
```

The shared `wonderland` browser scenario runs both startup benchmark branches and generates a self-contained
[HTML Preview demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/wonderland.html)
and appears in the [demo index](../demos/index.html). Its frame selector exposes
the title, landscape, score panel and editor panel; its result includes the
compiler's current first failure and missing-token inventory.

Local verification: `npm run check` passes 438 tests on Node 18.19.1.
`npm run test:browser` passes the four original image comparisons, all twenty
standalone scenario pages offline, including Web Audio and controlled/live keyboard
repeat, original-menu keyboard/gamepad replay and live keyboard UI, existing Canvas/input/lifecycle checks and
169 GPU/CPU frames, including two Flash states, two copy states, four fade states, eight scrolling window patterns, the original
title and PAL rainbow wrap, with six
presentation checks in Chromium/SwiftShader.
This work has not added an AMOS execution capture or fresh hosted CI evidence.
