# AMOScript demos

Play original AMOS games in your browser, or explore animation, music and interactive examples. Share this GitHub page directly; only runnable HTML pages use HTML Preview.

[Games](#play-the-games) · [More to explore](#more-to-explore) · [Technical checks](#technical-checks) · [Project and quick start](../README.md) · [Build your own game page](../docs/game-webpage-tutorial.md)

## Play the games

These demos run complete original programs; each page explains its tested paths and current limits. Enable sound and fullscreen through the page controls.

### Dithell’s Wonderland

Play the original game with keyboard or Gamepad controls, fullscreen and optional sound. Switch between WebGL2 and Canvas presentation.

[Play game](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/wonderland-game.html) · [Local file](wonderland-game.html)

### Roller II

Play the original puzzle game with music, keyboard/Gamepad and fullscreen. Includes the AMOS source fix for the level-3 time-bonus crash and the restored score image. Tested through the level-3 warp, game over, scores and a fresh game.

[Play game](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-game.html) · [Local file](roller2-game.html) · [Debug version](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-game-debug.html)

### Planet Zybex

Play the shooter with sound, fullscreen, keyboard/Gamepad and optional touch controls. Three AMOS docking copy fixes preserve the vertical viewport. Tested through both docking sequences, level-3 entry, GAME OVER and a fresh game; later progression remains in development.

[Play game](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex-game.html) · [Local file](planet-zybex-game.html) · [Debug version](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex-game-debug.html)

## More to explore

### AMCAF — original example collection

Twelve original AMCAF programs with sources, bundled assets and explicit build/runtime status. The quick-maths mouse demo runs; the catalogue records the remaining blockers.

[Browse collection](https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-examples.md) · [Local file](amcaf-examples.md)

### AMOS 3D — car and hero

Watch the car sequence and a rotating hero in an added demo loop, or select the original static hero ending. Includes pause/resume and fullscreen. The sprite intro is excluded; rendering uses a documented portable profile.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amos-3d.html) · [Local file](amos-3d.html)

### AMOS Compiler Examples — 19 original programs

Browse standalone builds of the original compiler examples, including cubes, fractals, stars and GALAX. Supplied graphics and Galax banks are embedded; debug pages expose remaining runtime limits.

[Browse collection](https://github.com/dschwen/AMOScript/blob/master/demos/compiler-examples.md) · [Local file](compiler-examples.md)

### AMOS Tutorial — original examples

Browse all 43 supplied program files by topic, with standalone debug pages, bundled assets and explicit compilation blockers.

[Browse collection](https://github.com/dschwen/AMOScript/blob/master/demos/tutorial.md) · [Local file](tutorial.md)

### BobTest — 64 bouncing objects

Run the original BobTest program with WebGL, pause/resume, restart and fullscreen. Press a key to start its 500-frame run.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/bob-test.html) · [Local file](bob-test.html)

### Planet Zybex — development previews

Explore all seven level backgrounds, ship controls, animation, enemies and allocation fixtures. The full game has its own Play Game page above.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex.html) · [Local file](planet-zybex.html)

### Roller II sliding-screen intro

Play both original RolIntrIdee2 intros live, with fullscreen, pause/resume and optional sample sound. Watch the screens slide in from above and below.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/screen-slide.html) · [Local file](screen-slide.html)

### Logoanim sphere intro

Watch the original sphere animation and logo sequence play live. Choose either original version, pause, resume, restart or enter fullscreen.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/anim5.html) · [Local file](anim5.html)

### Tunnel animation

Watch the original animated icons, pause or step frames, and choose an IFF background. The original supplied icon bank and IFF background are included.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/tunnel.html) · [Local file](tunnel.html)

### Roller II MOD player

Listen to the original title music with Play, Pause/Resume and Stop controls.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/tracker.html) · [Local file](tracker.html)

### Roller II end tunes

Play the original game-over and victory music, then run the original volume fade-out.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-music-vm.html) · [Local file](roller2-music-vm.html)

### Interactive AMOS examples

Try compiled examples with graphics, image banks, moving objects, keyboard/mouse input and program switching.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/programs.html) · [Local file](programs.html)

## Technical checks

<details>
<summary>Compiler and runtime checks (89 demos)</summary>

Individual commands, bounded game fixtures and rendering checks for development. Every browser test remains available here.

### Gru programs: scrolling and linked browser programs

Six independent overlap/clipping matrices and actual GPU comparisons exercise Def Scroll. A complete generated application chains Run File to a compiled target, then bare Run restarts that target while retaining session-file writes.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/gru-support.html) · [Local file](gru-support.html)

### GALAX: automatic AMAL and playable startup

The unchanged game starts from its menu, moves and fires, runs its death sequence and starts the next life. All fifteen recorded enemy paths match 4,444 independent positions. Automatic VBL scheduling, original Sprite publication and 36 actual GPU comparisons are covered; later stages and native timing remain open.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/galax-play.html) · [Local file](galax-play.html)

### Roller II Ctrl fire and Enter high-score confirmation

Complete original game execution with a declared zero-score input file so the natural 299-point run qualifies. Both Ctrl keys fire, Ctrl+arrows combine, and unmapped shortcuts stay outside AMOS. Real keyboard input types and confirms a name with Enter; the original code saves Highscores, returns to the menu and starts a fresh game. No VM variable/IP edits or native capture.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-highscore.html) · [Local file](roller2-highscore.html)

### Roller II help pages and menu return

The complete current AMOS source runs all seven help icon pages and the original timed colour/ball examples, then returns to the menu. Line 1129 has a source-level final-page offset fix; compiler cursor bounds remain strict. Four independent raw-asset icon regions and nine actual GPU/CPU frame comparisons. Input-only replay, not an Amiga capture.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-help.html) · [Local file](roller2-help.html)

### Shifted screens and GALAX packed pictures

Rounded hardware x, shifted OCS fetches, fine offsets, lowres/hires clipping and mixed-width windows. All five GALAX packed images match independent Python pixels. The unchanged Fractal3 and Plasma finish; complete GALAX startup reaches its scrolling menu. Twenty-six GPU comparisons; native timing/capture and GALAX gameplay remain open.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/horizontal-packed.html) · [Local file](horizontal-packed.html)

### Bump: mouse radius and image deformation

The unchanged Bump program starts without pointer motion, chooses radius 80 through hardware-coordinate pointer events, renders all 64,000 pixels and exits through its original prompt. Coordinate polls reconcile stale mouse limits without inventing button events. Independent IFF regions/axis vectors cover 61,344 pixels; four actual GPU comparisons check startup, radius selection, deformation and report. Circle keeps its positive-radius guard; native raster/timing parity remains open.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/bump-runtime.html) · [Local file](bump-runtime.html)

### 3Dcube3 and short default screens

The unchanged 3Dcube3 source renders its 32-row progress display, completes precalculation, runs all 500 PAL animation frames and exits through real Canvas keyboard input. Eight synthetic PAL/NTSC short-screen cases check 124,800 independent pixels and physical buffers. Thirteen actual GPU comparisons use bounded copper DMA; no native timing or Amiga capture is claimed.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/short-screens.html) · [Local file](short-screens.html)

### Compiler examples: bitplanes, dual playfields and cube

All nineteen originals compile. A declared fixture checks planar Copy, blocks, Dual Playfield and Shift Up against independent pixels and actual WebGL output. The unchanged 3Dcube1 runs for sixty and 120 PAL fields. The supplied Graphics images also run through unchanged Mapping preview and BouncBobs animation, with independent bitmap checks and three further GPU frames. Other examples remain development builds with explicit runtime/display limits; no native Amiga capture is claimed.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/compiler-examples-runtime.html) · [Local file](compiler-examples-runtime.html)

### Preloaded bitmap disk-font selection

Get Disc Fonts and Set Font select an owned, preloaded monospaced bitmap for graphics Text. A declared 10×9 test atlas checks width, baseline, MSB-first rows, transparent/opaque indexed pixels and restoring the system font. Three actual GPU comparisons and 192,000 independent pixels; this is not the missing Fastballfont/9 artwork or a native font capture.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/disk-fonts.html) · [Local file](disk-fonts.html)

### Planet Zybex lightning and score-panel palettes

Original horizontal and vertical lightning fades, with every palette step captured under PAL/NTSC at normal and half speed. Separate playfield/HUD background colours, transparent sprite setup rows, 184 real GPU/Canvas comparisons and 31,464 independent palette-row checks. Frozen keyboard input reaches level 3 with five lives; no VM, source or bank edits.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex-lightning.html) · [Local file](planet-zybex-lightning.html)

### Keyboard joystick and text entry

A visible Keyboard: Joystick / Typing selector lets Z fire during play and z/Z, Space and Enter reach AMOS during text entry. Held fire is released on mode changes; Gamepad input and Restart/Stop/Resume are covered. Includes a playable page-builder example.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/keyboard-mode.html) · [Local file](keyboard-mode.html)

### Application debug menu and binary file downloads

Normal and --debug page-builder examples: live game-speed selection, accessible icon controls, AMOS Bsave exports of new/modified files, exact binary bytes, compact errors, source logs and owned download URL cleanup. The examples below remain playable after checks.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/game-page-debug.html) · [Local file](game-page-debug.html)

### Optimized scalar instruction blocks

Compare reference and opt-in optimized standalone modules across nine instruction budgets, preserving typed values, source locations and original instruction counts. This is a semantic comparison, not a browser performance benchmark.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/optimizer.html) · [Local file](optimizer.html)

### Game page tutorial, Latin-1 font and touch joystick

Independent umlaut glyph pixels, real GPU text, multi-pointer cross controls, keyboard/Gamepad merging and owned input cleanup. Includes a fully generated playable HTML example with sound, fullscreen and touch settings.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/browser-game-harness.html) · [Local file](browser-game-harness.html)

### Roller II Edit host boundary

Original ROUNDTURN rotates four directions and reaches its Edit fallback for prepared zero/diagonal inputs. Twelve vector-oracle Canvas frames, four GPU comparisons and two post-cleanup editor requests; fullscreen and Restart. PHALT/movement are guarded; no embedded editor.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-edit.html) · [Local file](roller2-edit.html)

### Roller II paired high-score sorting

Original defaults, insertion and integer/string Swap sort all eleven score/name pairs. Five prepared entries match fifteen independent Canvas images and three GPU frames; editable score/name, fullscreen and Restart. Portable preview; source name entry, persistence and menu return excluded.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-swap.html) · [Local file](roller2-swap.html)

### Roller II rainbow deletion

Original line 557 deletes rainbow 0 after a declared HOPSCREEN guard. Overlapping prepared PAL tables reveal slot 1, then delete-all restores the screen palette. Three independent Canvas images/three GPU frames, fullscreen and Restart; bounce/editor return excluded.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-rainbow-del.html) · [Local file](roller2-rainbow-del.html)

### Roller II Get Icon requesters

Original missing-level and overwrite prompt captures on a prepared striped screen. Six independent Canvas images and six GPU frames verify exclusive bounds, padded icon 118 and masked restore. Declared requester guards; fullscreen and Restart, with editor/persistence excluded.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-get-icon.html) · [Local file](roller2-get-icon.html)

### Roller II mouse pointer shapes

Seven original Change Mouse statements select browser arrow/crosshair/wait cursors. Canvas/WebGL ownership, Hide/Show nesting and program switching are checked, with seven GPU comparisons. Prepared hover surface; editor actions and native pointer pixels excluded.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-pointer.html) · [Local file](roller2-pointer.html)

### Roller II screen under pointer

Original pointer-selection lines on declared overlapping windows. Seven Canvas stripe-oracle frames, seven GPU comparisons and pointer mapping on both hosts; live coordinate/zone readout, fullscreen and Restart. Editor scrolling/actions excluded.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-scin.html) · [Local file](roller2-scin.html)

### Roller II Writing text modes

Original Writing 0,2 label statement, a pen-only background proof and all fifteen mode/part combinations. Four independent Canvas images and four GPU comparisons; fullscreen and Restart. Prepared blank preview with portable font; editor loop excluded.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-writing.html) · [Local file](roller2-writing.html)

### Roller II patterned selection border

Original Set Line/Box selection, erase and redraw on a declared blank preview with the original palette. Three independent Canvas frames and three GPU comparisons; clipped edge-cell controls, fullscreen and Restart. Editor panel/Writing/game loop are excluded.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-lines.html) · [Local file](roller2-lines.html)

### Roller II editor memory transfers

Original editor Fill/Copy statements back up, clear and restore all fifteen real level payloads. Tile/colour bytes change while metadata, allocations and backup remain intact; restore waits at a declared redraw guard. Live in-memory preview without persistence or editor/game loops.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-transfers.html) · [Local file](roller2-transfers.html)

### Roller II original arrow movement

Original PFEIL/N34 after real level progression: one-pixel arrow steps and down/up/left turns, native timeout Boom, pause and source bank integrity. Twenty independent Canvas images/ten GPU comparisons over keyboard/Gamepad paths; remaining obstacle and game-over handlers stay guarded.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-arrows.html) · [Local file](roller2-arrows.html)

### Synthesized AMOS Boom

Original four pitches, shared field-mutated noise and integer EnvBoom rendered as finite PCM with explicit portable beam/phase choices. Five independent native Web Audio stereo comparisons, Stop/disposal and gesture-controlled audition. Exact DMA/beam capture parity remains open.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/boom.html) · [Local file](boom.html)

### Roller II original pause modes

Original PAUSE/IPause after real level progression: mouse/Help paid pause, Space pause popup, keyboard/Gamepad WTIN return and source Timer restoration. Twenty independent Canvas images and ten GPU comparisons; live fullscreen/Stop/Resume/Restart. Enter is joystick fire so Space reaches AMOS. Arrows and game-over remain guarded.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-pauses.html) · [Local file](roller2-pauses.html)

### Roller II bonus and next level

Original five-tile collection continues through ZAEHLHOCH inclusive bonus scoring, Return and LEVLOAD into the real second-level bank, ready prompt and starting ball. Fourteen independent Canvas images and seven GPU comparisons using keyboard/Gamepad. Other obstacle/pause/game-over handlers remain guarded.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-progression.html) · [Local file](roller2-progression.html)

### Roller II original colour collections

Original KCWEG/BCL/GAMED collect all five first-level colour tiles, update exact map bytes, score and remaining count, and fade only the ball palette. Fourteen independent Canvas images and seven WebGL comparisons across keyboard/Gamepad input; bonus scoring/level loading remains guarded.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-colours.html) · [Local file](roller2-colours.html)

### Roller II original floor movement

Original string-based SAS$ dispatch, wall checks and floor sliding on level 1. Keyboard and browser Gamepad paths verify 48 field positions, twelve independent Canvas frames and six WebGL comparisons; the colour handler remains guarded. Live fullscreen/Stop/Resume/Restart preview.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-movement.html) · [Local file](roller2-movement.html)

### Roller II original game input loop

Connected original setup and JOAB through 639: real countdown, physical Key State, keyboard/Gamepad directions, effects/music keys and Escape menu return. Twenty-four independent Canvas checks and six WebGL frames; movement, pause and game-over handlers are guarded.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-input.html) · [Local file](roller2-input.html)

### Roller II ready prompt and initial ball

Connected original startup/menu, game setup, GAMEDISP and blinking foreground ready prompt through line 617. Original ball palette, six-plane sprite, fade and status border; independent pixels, eighteen Canvas checks and six WebGL frames. Mouse, keyboard and Gamepad fire reach the guard before movement; live fullscreen preview.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-ready.html) · [Local file](roller2-ready.html)

### Roller II original board rendering

Unchanged GAMEDISP across all fifteen supplied maps, with original icon copies, retained masks and source tile counts. Independent board PNGs, sixteen Canvas checks and two WebGL frames. Live level selector/fullscreen preview; palette restoration is a declared harness and the full prompt/gameplay path remains excluded.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-boards.html) · [Local file](roller2-boards.html)

### Roller II raw icon memory and ICCOPY

Original game-entry icon copies through checked planar aliases, including rounded padding and unchanged masks. Independent before/after pixels and two WebGL frames; live Copy/Reset/fullscreen inspector. Game screen and level setup remain excluded.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-icons.html) · [Local file](roller2-icons.html)

### Roller II level metadata and word memory

Original metadata reads and Doke time writes across all fifteen pinned level files, checked against independent headers. Live level/time memory preview; no file persistence, game/editor loop or rendering.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-levels.html) · [Local file](roller2-levels.html)

### Roller II intro, menu and first level load

Original startup, menu and game entry now create game screens, initialize the rainbow, load level 1 and refresh status text. Ten input cases, nine guarded selections and three independent/GPU frames. WebGL/fullscreen and optional MOD music; board drawing, gameplay and editor/scores/help routines remain excluded.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-menu.html) · [Local file](roller2-menu.html)

### Roller II intro, initialization and main-title image

Original intro/input wait/FDZ/FLOAD, highscore and tile-handler initialization, work/icon/sprite banks, then a declared handoff to the tall EHB title load. Keyboard, pointer and injected Gamepad API input pass independent checks. Live WebGL/fullscreen preview; setup 281–286 and menu logic remain excluded.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-intro.html) · [Local file](roller2-intro.html)

### Roller II first image and original FLOAD

Unchanged startup through the first FLOAD, original procedure, AMSC placement, hidden palette clone and Fade To. Independent Python image pixels verify seven Canvas/copper states and seven WebGL comparisons. Live fullscreen preview precedes WTIN, the main title and gameplay.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-title.html) · [Local file](roller2-title.html)

### Roller II original startup

Unmodified first 17 lines execute Set Stack/Break Off, Dir$, TRUE, original sample/tracker loads and Hide. Step/reset controls inspect the silent field clock; native Canvas checks cover nested Hide/Show. The captured default screen precedes FLOAD; title rendering and gameplay remain open.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-startup.html) · [Local file](roller2-startup.html)

### Roller II AMOS Music end tunes

Direct field-stepped playback of Over.mus and Ywon.mus; independent full-cycle PAL/NTSC traces and 25 native Web Audio instrument comparisons. Separate direct-player foundation; the VM demo adds command/lifecycle integration.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-amos-music.html) · [Local file](roller2-amos-music.html)

### AMCAF strings, shifts and raw Work files

A compiled synthetic program selects AMCAF in slot 19, round-trips all 256 byte values through Wload/Wsave/Dsave, and prints decimal, lexical path and signed-shift results. This is a primitive compatibility check, not an original utility or native Amiga capture.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-utilities.html) · [Local file](amcaf-utilities.html)

### Original AMCAF quick maths

The complete unchanged QsinCosArcSqr.AMOS example follows three mouse directions, swaps double buffers and exits on Escape. Recovered integer tables drive Qsin/Qcos/Qarc/Qsqr; raw Blitter Clear clears one logical plane. Three Canvas/GPU pairs and 15,795 independent needle pixels. The full collection is linked from the AMCAF catalogue.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-quick-maths.html) · [Local file](amcaf-quick-maths.html)

### AMCAF second-port buttons

A compiled AMOS loop reads Smouse Key from the second mouse/joystick port. Optional keyboard/gamepad mappings expose secondary and third fire without widening Joy masks or consuming main-mouse clicks. Stop/Resume, typing mode and input cleanup are checked; the gamepad checks use an injected device.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/smouse-key.html) · [Local file](smouse-key.html)

### Extension priority and raster timing

Step a synthetic AMOS program through Turbo Amos Pri and AMCAF Raster Wait with a manual PAL clock. PAL/NTSC checks cover line deadlines, slowdown independence and owned waits. Priority is an optional system-hook intent; no browser OS scheduling or cycle-exact beam is claimed.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/extension-timing.html) · [Local file](extension-timing.html)

### AMCAF music in a compiled AMOS application

A synthetic tokenized AMOS program runs Track Load and Pt Play through the VM CIA clock while waiting for a key. The page builder supplies the streaming host automatically. Play, sound, Stop/Resume and Restart use the normal application harness; 128 opening PCM samples and selected Pt Sam Stop cancellation have native audio checks. Press Q to stop voice 1, Q again to play a synthetic raw effect, and Q again to end music. An additional 4,000 native audio samples check the raw effect. No Ghostlight assets are included.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-vm.html) · [Local file](amcaf-vm.html)

### AMCAF streaming music preview

Stream synthetic music with arpeggio, vibrato, portamento and non-retriggering sample changes. Play, Pause/Resume and Stop control the live engine. Eight PAL/NTSC stereo comparisons plus native sample-takeover, underrun and filter checks cover the streaming host. Uses a declared 50-Hz preview clock; AMOS VM and CIA integration remain open. No Ghostlight assets are bundled.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-pcm.html) · [Local file](amcaf-pcm.html)

### Roller II target and MOD inspector

Original sample/Track Load statements execute with explicit fixture boundaries. A bounded M.K. reader decodes the original module, instruments and effects. The separate music demo runs compiled Track Play; the whole source now compiles, while full-game execution remains open.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2.html) · [Local file](roller2.html)

### Fsel$ and unmodified Wonderland game entry

Prepared synchronous file choices execute the original retry/Gosub/Return routine and selected load/save calls. The unmodified complete program runs and renders four first-level frames over two controlled seconds, including attached sprites and rainbow/HUD scheduling. No native selector GUI or complete gameplay parity is claimed.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/file-selector.html) · [Local file](file-selector.html)

### AMOS Rnd and original enemy initialization

Source-derived seeded PRNG vectors and eighteen original blob/green-jump streams with controlled beam input. Includes step/reset/cache controls; gameplay, native startup seeds and real beam timing remain outside this data fixture.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/random.html) · [Local file](random.html)

### Wonderland raw level-file save/load

Original map writeback, Bsave, Bload and seed-refresh statements round-trip all five maps through an in-memory files adapter. Exact exclusive-end bytes, stable addresses and retained fifth seed are checked. Includes cell editing, raw download and optional local preload; file selection and gameplay are excluded.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/raw-files.html) · [Local file](raw-files.html)

### AMOS hardware mouse and original game input

Hardware-coordinate input, original mouse limits, polling-based Mouse Click and X/Y Mouse assignment. Original Wonderland editor selection and fourteen Roller II joystick mouse steps pass through keyboard and injected Gamepad API input. Includes a live editor button-selection harness; game actions remain excluded.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/mouse.html) · [Local file](mouse.html)

### Wonderland editor panel zones

Original five-button zone definitions and the original Zone expression classify all 10,240 panel positions with injected hardware coordinates. Independent panel PNG comparison and a live point/reset inspector; mouse clicks/limits and editor actions remain excluded.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/zones.html) · [Local file](zones.html)

### AMOS Flash and screen-local Flash Off

Clocked colour cycles, selected-screen cancellation, unchanged physical pixels and immutable snapshots. Normal/EHB/HAM6 Canvas and CPU output use independent RGB expectations. Includes live Stop/Resume/Flash Off controls; Screen Open implicit flashing remains unsupported.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/flash.html) · [Local file](flash.html)

### Wonderland: publish all five level maps

Original level-data and Paste Bob loops build five hidden maps, then Screen Copy Logic To Physic publishes their full bitmaps without swapping. Includes a clock-stepped map demo and host scrolling inspection. Gameplay remains excluded.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/screen-copy.html) · [Local file](screen-copy.html)

### Wonderland score fields and Print Using

Original level/score statements, integer padding/truncation and five panel frames checked against a separate glyph rasterizer over independent image PNGs. Includes a compiled integer-field sandbox. Floats and decimal/exponent masks remain unsupported.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/print-using.html) · [Local file](print-using.html)

### Wonderland Fade and VBL palette timing

Original title setup and post-death Fade 2 / Wait 64 / Wait Vbl lines, with declared trigger/exit guards. Nine independent RGB comparisons, immutable snapshots, unchanged physical pixels and clock-driven palette updates. Includes live Fade/Stop/Resume/Restart controls.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/fade.html) · [Local file](fade.html)

### AMOS scan codes and Wonderland Escape

Inkey$/Scancode consumption, physical key mappings, repeats, joystick passthrough and lifecycle cleanup. Runs the original Wonderland input/Escape branch and title routine in a declared fixture. Includes a live compiled keyboard reader.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/scancodes.html) · [Local file](scancodes.html)

### Computed branches and Wonderland initialization

One-based On Gosub/Goto, out-of-range fallthrough and return traces. Executes Wonderland's original dispatch line and three unchanged initializers; the other two targets have explicit End guards. Synthetic inputs and image captions; no enemy gameplay.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/computed-branches.html) · [Local file](computed-branches.html)

### Wonderland screen windows and scrolling

Original game/editor screen setup, physical-buffer scrolling, independent landscape/panel PNG checks, two blank rows and staged View commits. The complete game is not running.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/screen-windows.html) · [Local file](screen-windows.html)

### Wonderland menu: keyboard and gamepad

Original menu routines with animated movement, background toggle and mode selection. Choose keyboard mapping, Gamepad API or both in the live menu below. Stops before unsupported gameplay/editor dispatch.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/wonderland-menu.html) · [Local file](wonderland-menu.html)

### AMOS keyboard repeat and cleanup

Source-compiled Key Speed, controlled 200/40 ms repeats, ignored native duplicates and keyup/blur/Stop/detach/End cleanup. Includes a focused live keyboard demo.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/key-repeat.html) · [Local file](key-repeat.html)

### Wonderland samples and Web Audio

Six original PCM samples, independent offline stereo/rate comparisons, loops, replacement and Stop/disposal checks. Explicit buttons audition each sample.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/music.html) · [Local file](music.html)

### Wonderland milestone: original title screen

Original 64-line title setup executes through Wait Vbl, image loading and its menu marker Bob. Both startup branches match an independent source-derived image. The menu loop and game are not running yet.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/wonderland.html) · [Local file](wonderland.html)

### WebGL2 integer readback

Exact chip bytes, unsigned addressing, integer framebuffer and PNG decoding.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/webgl-integers.html) · [Local file](webgl-integers.html)

### GPU uploads and context restoration

All chip sizes and ABI tables, dirty rows, independent consumers, loss/restore and disposal.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/webgl-resources.html) · [Local file](webgl-resources.html)

### GPU / CPU rendering gallery

Independent IFF images, scroll and sprite matrices, copper stacks, 100 seeded frames, GPU presentation/aspect scaling and restored shaders.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/webgl-renderer.html) · [Local file](webgl-renderer.html)

### Sprite DMA and channel reuse

Chained descriptors, blank control lines, held rows and native Canvas pixels.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/sprite-dma.html) · [Local file](sprite-dma.html)

### Open Port: original printer programs

Run three unchanged Introideen printer programs through an explicit parallel-output capture. All 5,661 bytes match independently transcribed expectations, including escape codes, tabs and high characters. Download raw .prn files and inspect their hexadecimal bytes. No printer driver or physical printing is emulated.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/open-port.html) · [Local file](open-port.html)

### Polygon: sphere animation generator

Solid polygons with independently checked interiors/boundaries, plus the unchanged backup sphere generator. All eight exported IFFs match their rendered pixels and are downloadable below. The portable raster profile is documented; native AreaEnd edge parity remains unverified.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/polygon.html) · [Local file](polygon.html)

### Save Iff: render, save and download a sphere

The unchanged KugelanimBerech program renders its sphere and saves rollerball after a real Canvas key event. An independent decoder checks all saved pixels; a separate Load Iff preview and two actual GPU comparisons verify presentation. Download the generated IFF from the Debug menu below. Session files are volatile.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/save-iff.html) · [Local file](save-iff.html)

### Interface execution: graphics and array expressions

Dialog Run executes fourteen unchanged Interface strings from Graphics.AMOS (base plus lines 71–83), with declared resource/startup preparation and a separate executed title. A second source fixture renders Sliders data through PR, VA, AR and AS. Three real Canvas/GPU frames and an independent rectangle oracle; resource boxes, controls, background saves and waits remain unsupported.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/interface-run.html) · [Local file](interface-run.html)

### Interface channels and array references

Unchanged Communication, Editing Zones and Sliders startup through their first Dialog Open, followed by a declared Wait Key guard. Five channel-inspector previews compare Canvas/WebGL, including a compiled Vdialog numeric/string transfer and all 101 original Sliders entries linked through Array. Independent blank pixels verify opening does not draw. The separate Interface execution demo covers bounded Dialog Run; controls and resource-backed dialogue rendering remain unsupported.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/interface-channels.html) · [Local file](interface-channels.html)

### Interface resource screen settings

Original Graphics tutorial startup through Resource Screen Open and its first Wait Vbl, followed by a declared Wait Key guard. The official system resource metadata is checked separately. Four Canvas/GPU frames and independent palette pixels; the added indexed swatches are a preview, not dialogue execution or an Amiga capture.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/resource-screen.html) · [Local file](resource-screen.html)

### Roller II intro idea: Zoom animation

The unchanged 49-line RollerIIIntroIdee program and its supplied R.abk asset. Sixteen generated icons and all 29 animation frames match independent Python expectations; four Canvas/GPU frames are compared. Select captured frames to inspect the original animation.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/zoom.html) · [Local file](zoom.html)

### Sqr and the original Kugel shading program

Exact FFP square roots, independently checked grayscale tiles and the unchanged Kugel sphere program. The original source stops when its shading expression produces colour -1; the retained partial sphere is not a completed rendering. Two actual GPU/CPU comparisons.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/sqr.html) · [Local file](sqr.html)

### Device keyboard text input

Open a real text field to use the phone or tablet keyboard. Text, Latin-1 umlauts, committed IME input, Enter and Backspace go directly to AMOS, bypassing joystick fire mappings. Stop, Resume, Key Speed and detach are checked. Run the checks, then try typing into the live program below; native keyboard appearance itself requires a real mobile device.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/mobile-keyboard.html) · [Local file](mobile-keyboard.html)

### Joy Src1: Schokowahn labyrinth editors

Both complete, unmodified LabEdit sources with a declared initial hardware pointer and the accompanying LAB icons. Fill, clear, marker protection through Pop, painting and Escape/Edit are exercised. Twelve independent grid and GPU frames. The four empty source files and Labyrinth backup runtime bounds error remain explicit in the build report; this is an editor showcase, not the complete adventure.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/joy-source1.html) · [Local file](joy-source1.html)

### Interlaced packed screens and overscan

A synthetic 368 by 900 packed atlas is created by the original Unpack To token. Both field row tables feed Canvas/WebGL directly, with independent pixels, odd source offsets, progressive split-screen rows, setup blanks and hiding. Static weave presentation; no cycle-exact field timing or Ghostlight assets.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/interlaced-unpack.html) · [Local file](interlaced-unpack.html)

### Native screen widths and packed bitmap storage

AMOS word-truncated widths (302 to 288 and 86 to 80), bounded narrow-screen copper fetches, and all-row bitmap-only unpack of synthetic laced packed data. Three Canvas/GPU frames. The separate interlaced-unpack demo now covers visible packed-screen creation.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/narrow-packed.html) · [Local file](narrow-packed.html)

### Turbo Plus pixels and masked lighting blocks

Six independent indexed matrices cover graphics versus block plane masks, F Plot/F Point, rounded transparent captures and buffer publication; six real GPU comparisons. Synthetic lighting fixture, not Ghostlight gameplay or a native capture.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/extension-graphics.html) · [Local file](extension-graphics.html)

### Portable system information and boot commands

Explicit read-only Exec version metadata, strict default bounds and synchronous Request Off/Amos To Front/AMCAF startup notifications. Synthetic programs; no machine RAM or OS emulation.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/system-information.html) · [Local file](system-information.html)

### Trigonometry and angle modes

Source-compiled Sin/Cos/Tan, degree/radian modes and matching Canvas/planar/copper pixels.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/trigonometry.html) · [Local file](trigonometry.html)

### Extra Half Brite

Six-bit pixel codes, masked palette registers and exact four-bit halving.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/ehb.html) · [Local file](ehb.html)

### Desktop project builder walkthrough

Prepared browser walkthrough of directory-to-disk mapping, options, project save, preview and standalone HTML export. Uses the real desktop form and backend-produced sample pages; native dialogs and sandbox ownership are tested separately in Electron. Directory buttons select a declared sample, not your local folders.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/project-builder.html) · [Local file](project-builder.html)

### WebGL HAM6 colour carry

Native GPU masked-write prefix scans: independent HAM images, five/six planes, clipped history, scroll, row palettes, sprites, mixed modes, validation and context restoration. No CPU colour fallback.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/webgl-ham.html) · [Local file](webgl-ham.html)

### HAM6 colour history

Palette and component commands, row resets, independent factories and three matching output paths.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/ham.html) · [Local file](ham.html)

### Direct sprites and manual updates

Frozen/pending positions, movement, hiding, palette priority, mouse reservation and cursor restoration.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/sprites.html) · [Local file](sprites.html)

### Banks, buffers and Bobs

External load/save/reload, appending, swaps, reservation, shrinking, erasure and saved Bob backgrounds.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/banks.html) · [Local file](banks.html)

### Roller II — full game with debug enabled

The full current game and assets with a Debug menu for downloading modified session files and inspecting source errors. Play retains the original intro; no verification replay is required.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-game-debug.html) · [Local file](roller2-game-debug.html)

### Planet Zybex — full game with debug enabled

The current game and assets at half speed, with a Debug menu for source error logs and modified session-file downloads. Use the speed selector to adjust pacing.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex-game-debug.html) · [Local file](planet-zybex-game-debug.html)

</details>

## Limited demos

<details>
<summary>ASM — Das Spiel: limited demo of rooms 1–5</summary>

### ASM — limited demo: five room entries

Limited demo of ASM — Das Spiel, restricted to rooms 1–5. Later-room assets are excluded; play ends cleanly before entering another room. Intro and technical checks are included for this limited build.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/asm-rooms.html) · [Local file](asm-rooms.html)

### ASM — limited demo: rooms 1–5 replay

Limited demo of ASM — Das Spiel, restricted to rooms 1–5. Later-room assets are excluded; play ends cleanly before entering another room. Intro and technical checks are included for this limited build.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/asm-main-checks.html) · [Local file](asm-main-checks.html)

### ASM — limited demo: intro checks

Limited demo of ASM — Das Spiel, restricted to rooms 1–5. Later-room assets are excluded; play ends cleanly before entering another room. Intro and technical checks are included for this limited build.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/asm-intro-checks.html) · [Local file](asm-intro-checks.html)

### ASM — limited demo: Das Spiel: original intro

Limited demo of ASM — Das Spiel, restricted to rooms 1–5. Later-room assets are excluded; play ends cleanly before entering another room. Intro and technical checks are included for this limited build.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/asm-intro.html) · [Local file](asm-intro.html)

### ASM — limited demo: intro — debug preview

Limited demo of ASM — Das Spiel, restricted to rooms 1–5. Later-room assets are excluded; play ends cleanly before entering another room. Intro and technical checks are included for this limited build.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/asm-intro-debug.html) · [Local file](asm-intro-debug.html)

### ASM — limited demo: direct room 1 (WebGL)

Limited demo of ASM — Das Spiel, restricted to rooms 1–5. Later-room assets are excluded; play ends cleanly before entering another room. Intro and technical checks are included for this limited build.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/asm-room1.html) · [Local file](asm-room1.html)

### ASM — limited demo: Das Spiel: adventure build

Limited demo of ASM — Das Spiel, restricted to rooms 1–5. Later-room assets are excluded; play ends cleanly before entering another room. Intro and technical checks are included for this limited build.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/asm-game.html) · [Local file](asm-game.html)

### ASM — limited demo: main — debug build

Limited demo of ASM — Das Spiel, restricted to rooms 1–5. Later-room assets are excluded; play ends cleanly before entering another room. Intro and technical checks are included for this limited build.

[Run demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/asm-game-debug.html) · [Local file](asm-game-debug.html)

</details>

All HTML pages embed scripts and prepared fixtures. Open locally after cloning or use HTML Preview to run from GitHub; no server, Node or asset downloads are needed. WebGL requires WebGL2. Browser writes are volatile unless a demo explicitly says otherwise.
