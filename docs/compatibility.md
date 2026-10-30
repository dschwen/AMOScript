# Compatibility and implementation status

Updated 2026-10-30. The current local baseline has **932 passing tests**, plus a
passing real-Chromium rendering/input smoke test, 76 offline demo scenarios and
WebGL2 capability probe.
The later [compiler-examples milestone](compiler-examples.md) adds compilation
of all 19 originals, bounded console Input/error handlers, planar memory and
lowres dual playfields; its standalone debug pages expose remaining runtime gaps.

This describes implemented behavior, not a claim of complete AMOS compatibility.
The earlier 248-test baseline passed clean-install checks on Node 22 and 24.
The current run includes direct sprites and refreshed demos; the expanded suite
has not been rerun across those Node versions. Hosted CI is still pending. See
[development evidence](development.md).

The [complete Roller II runner](roller2-game.md) now uses the current supplied
assets, including the restored high-score image. It follows the level-3 warp,
Timer-expiry game over, scores/menu return and a fresh game. The frozen earlier
fixtures retain level-2 arrow and missing-resource regressions. Full-game
completion remains unaccepted. Writes remain in session memory; IndexedDB is
planned. Tunnel now uses the supplied external icons and original IFF background.

The current end-to-end target is [Roller II](roller2.md): 1,199 lines, 194 token
encodings, all recognized; the complete source now compiles to 2,528 instructions. Its unchanged first FLOAD call and original
procedure now load/fade the initial logo in a bounded browser VM, with original
paths/music, static clones, captured palette fade and AMSC placement. Full-game execution remains open. Original WTIN/FDZ now run in a declared fixture that
runs original array/highscore setup, SASINIT and work/icon/sprite bank loads,
then hands off to the main-title image while omitting remaining setup 281–286.
The connected menu fixture now runs the original executable startup-to-menu
prefix through 316, including setup 281–286 and continuing MOD playback. It stops
at guarded destinations; selected routines and gameplay remain open.
Wonderland remains a
[working regression target](wonderland.md).
Its original first 64 lines now execute both startup branches through Wait Vbl,
Load Iff and the original title/menu marker Bob. The unmodified complete source
now compiles (1253 instructions; no unknown encodings). Its own game branch reaches
level 1 in a [live keyboard/Gamepad demo](wonderland-game.md). Controlled input-only
replays render three deaths/fades, two life restarts, game over and a fresh game.
This does not establish all-level completion or native gameplay parity.
The declared original-menu fixture supports configurable keyboard/gamepad input,
animated movement, background toggling and both selections. Four original images,
embedded banks and six samples are checked, with standalone startup/asset and
audio demos. The live session now connects original sample effects through explicit Web Audio
Enable/Mute controls. Editor files and all-level/win coverage remain open.

## Feature matrix

| Area | Status | Evidence / limits |
| --- | --- | --- |
| Planet Zybex | New full-game milestone; background preview only | Seven original packed worlds and original Load/Unpack excerpts pass independent pixels, 35 GPU windows and live scrolling/fullscreen. Global register exchange passes; complete source still stops at Default and AMAL/player gameplay remain open. [Milestone](planet-zybex.md). |
| Unpack bank To screen | Implemented slot-2 full packed-screen subset | Owned checked SCCode/BMCode decoder, native square/column traversal, palette/window metadata, replacement preflight and retained bank addresses. Other overloads, partial/raw-address forms and modes remain gated. [Contract](packed-pictures.md). |
| Amreg globals | Implemented signed-word access | Per-factory RA–RZ, integer queries, low-word stores and checked indices. Original clear_amal runs in a declared fixture; channel-local registers/interpreter remain open. [Contract](amreg.md). |
| Signed Screen Display | Implemented bounded raster crop | Y -4095..28671 without biased-word overflow; committed top/bottom clipping, advanced planar pointers and early DMA endings. Both original RolIntrIdee2 sources complete, with all 200 PAL/NTSC frames independently checked, 28 GPU/pointer checks and live sample sound. Wider wrapping/horizontal forms and native captures remain open. [Contract](screen-slide.md). |
| Open Port | Implemented output-only adapter boundary | Shared file-channel ownership with explicit synchronous ports.open/write/close, raw byte Print #, terminal cleanup and opt-in bounded PAR: capture. All three original printer sources match 5,661 independent bytes; browser downloads/revocation pass. Input, serial/printer handlers, physical printing and PCL rendering remain gated. [Contract](open-port.md). |
| Frame Load / Frame Play | Implemented ANIM-5 subset | Checked channel prefix to temporary fast bank, native raw forms/AenD, integer count/continuation addresses and logical delta stores under caller swaps/waits. Both unchanged Logoanim sources finish; all twenty asset frames match independent hashes, with 16 GPU comparisons. Other operations/overloads, mutable/restored banks and native captures remain gated. [Contract](anim5.md). |
| Polygon | Implemented bounded portable solid fill | Explicit coordinate list, even/odd interiors and inclusive solid boundary, bitmap clipping and preflight; direct logical writes bypass Bob/Autoback. Twelve independent matrices and original eight-image generator/export/download replay pass with 12 GPU comparisons. Native AreaEnd edge parity and wider forms remain open. [Contract](polygon.md). |
| Save Iff | Implemented one-filename compressed export | Owned ILBM writer, row-bounded ByteRun1, current logical bitmap, palette/mode/AMSC metadata and one synchronous write after validation. Original generator saves rollerball; independent decoding/reload match pixels and Debug exports exact bytes. Buffering/wider forms/native byte identity remain gated. [Contract](save-iff.md). |
| Zoom | Implemented bounded raw bitmap resize | Ten numeric operands, exclusive in-bitmap extents, source-derived sampling, explicit logical/physical buffers and live overlap. Bypasses Bob/Autoback hooks. Original 49-line intro completes; all generated icons and 29 frames match independent expectations, with four Canvas/GPU frames. Wrapped geometry/native captures remain open. [Contract](zoom.md). |
| Sqr | Implemented source-derived FFP profile | Unary numeric function with float results, promotion, typed/DATA/procedure boundaries and negative-domain errors. 345 exact independent vectors; 4,096 grayscale pixels and two actual GPU comparisons. Original Kugel compiles but stops at its negative Plot colour; full sphere/native library capture remain open. [Contract](sqr.md). |
| Roller II high-score input | Prepared-file full-source replay | Both Ctrl keys fire and combine with arrows; Enter reaches original name entry. A declared zero-score table lets the natural 299-point path qualify, type a name, confirm, verify exact Highscores writeback and return to menu/fresh game. Shipped-score qualification and native captures remain separate. [Contract](roller2-game.md). |
| Roller II help source fix | Complete help/menu replay | Source line 1129 subtracts 48 for final entries 49–52. Strict text cursor checks remain unchanged. Seven icon pages, timed demonstrations and menu return; 1,024 independently decoded icon pixels and nine Canvas/GPU comparisons. [Fix](../examples/Roller2/current/help-page-fix.md). |
| Application debug UI | Optional builder/host presentation | `--debug` adds new/modified session-file downloads and bounded source error/state logs. Normal pages use accessible lifecycle icons and compact errors. Binary Bsave exports, reverted-file filtering and URL cleanup have a shared browser demo. Storage is still session-only. [Tutorial](game-webpage-tutorial.md#debug-builds-and-downloading-session-files). |
| Optimized emission | Opt-in scalar blocks | Pure scalar assignments and Inc/Dec share dispatch, capped at 32 instructions and split at every label. Original instruction budgets/locations remain intact; calls, arrays and active music/palette engines retain ordinary dispatch. Differential target replay and standalone browser comparison; no established Roller II speedup. [Contract and measurements](optimization.md). |
| Edit | Implemented terminal host boundary | Frozen source request; VM/audio/palette/input cleanup before optional synchronous notification, once-only handling, no continuation or embedded editor. Original ROUNDTURN fixture covers guarded rotations and fallback. Native editor UI/end-state music remain open. [Contract](edit.md). |
| Swap | Implemented same-type lvalue exchange | Integer/float/string scalar and array elements, captured addresses/indices/local owners, checked before writes, ordinary scopes and fallthrough. Original paired high-score sorting matches five independent cases/fifteen Canvas previews and three GPU frames. Native captures and shipped-score qualification remain open; prepared-file entry/writeback is covered separately. [Contract](swap.md). |
| Rainbow Del | Implemented table deletion | Specific 0–3, negative/all forms, absent-slot no-op and fresh recreation; live palette-row removal restores overlap/base colour without changing pixels, View or fade jobs. Original 557 fixture matches three independent Canvas/GPU frames. Native timing/positive wrapped aliases remain open. [Contract](rainbow-del.md). |
| Get Icon | Implemented bounded current/explicit-screen capture | Exclusive logical bitmap rectangle, word-padded zero tails, all planes, zero hotspots and no mask. Sparse growth/replacement preserves other images/palette and retires raw addresses. Original requester captures/restores match six independent Canvas/GPU frames; general capture aliases/native timing remain open. [Contract](get-icon.md). |
| Change Mouse | Implemented built-in portable profile | Per-program 1/2/3 map to CSS arrow/crosshair/wait through Canvas/WebGL with independent Hide/Show nesting and cursor restoration. Seven original statements and thirty browser style checks. Configured/native artwork and sprite-bank forms remain unsupported. [Contract](change-mouse.md). |
| Scin | Implemented bounded hardware-window lookup | Two/three-argument priority scan, explicit start -1..7, unsigned coordinates, exclusive right/bottom edges, hidden/clone handling and EntNul. Live geometry before View; original pointer lines and seven Canvas/GPU frames with both input hosts. General modes/native capture remain open. [Contract](scin.md). |
| Writing | Implemented default-window subset | Modes 0–4 and parts 0–2, shared pair/per-screen activation, checked selectors and existing buffer/Bob hooks. Original labels and fifteen-case matrix match four independent Canvas/GPU frames. Portable font; general windows and graphics Gr Writing remain open. [Contract](writing.md). |
| Set Line | Implemented bounded portable raster profile | Per-screen low-word mask, MSB-first foreground/background pattern and phase through Draw/Draw To/Box; signed-word patterned coordinates, shared Autoback/Bob hooks and preflight. Original blank selection preview matches three independent Canvas/GPU frames. General graphics writing modes and native phase/clip capture remain open. [Contract](set-line.md). |
| Fill / Copy | Implemented bounded bank-memory transfers | Big-endian Fill with exclusive/empty ranges (up to 1 MiB; odd starts only for byte tails), overlap-safe Copy with exclusive/nonempty ranges, complete preflight, active-Tracker and raw-icon protections. Original editor statements back up/clear/restore all fifteen payloads at a redraw guard; no persistence/editor rendering. [Contract](bulk-memory.md). |
| Boom | Implemented bounded portable synthesis | Four source pitches, shared noise recurrence, integer envelope and fractional onset render finite float PCM with explicit seed/constant-beam choices. Independent PAL/phase/NTSC vectors and five native Web Audio graphs pass. Exact DMA/beam capture and general live wave/envelope controls remain open. [Contract](boom.md). |
| Roller II arrows / N34 | Implemented bounded original handlers | Original PFEIL follows three real level-2 turns and N34/HCWEG rebound. Thirty-two one-pixel input positions, twenty independent Canvas images/ten GPU comparisons; original arrow timeout runs Boom before game-over guard. [Contract](roller2-arrows.md). |
| Rectangular Screen Copy | Implemented bounded eight-operand form | Exclusive ends, paired bitmap clipping, overlap-safe copies, common planes and Logic/Physic ownership. Original Tunneltest passes 48 independently decoded original-asset frames; five GPU comparisons. Wrapped geometry and explicit minterms remain open. [Contract](screen-copy.md). |
| AMOS Music banks | Implemented bounded VM playback | Music/Mvolume/Music Off, bank-3 decoder/player, independent driver wakes, master fade, bank/shared-voice lifecycle and Stop/Resume. Four complete first-wrap traces and 25 native Web Audio comparisons; stacked songs, voice stealing and full end-state integration remain open. [Contract](amos-music.md). |
| MOD / tracker | Implemented bounded playback | Owned M.K. decoder, Track Load/Loop/Play/Stop and C/A/E/F/D effects. Driver-owned VBL wakes share sample voices, cancel on End/failure/bank retirement, and pause without elapsed-note replay. Original music fixture matches 1,997 notes and twelve native Web Audio comparisons. Held sample phase after pause, wider effects, exact DMA contention, live bank editing and wider AMOS Music forms remain open. [Contract](mod-tracker.md). |
| Roller II pause modes | Implemented bounded original routines | PAUSE/IPause run after real progression, with mouse/Help score costs, native Space popup, three WTIN exits, exact Timer restoration and host lifecycle checks. Twenty independent Canvas images/ten GPU comparisons. Boom and remaining obstacle/game-over paths stay open. [Contract](roller2-pauses.md). |
| Roller II bonus / next level | Implemented bounded original progression | ZAEHLHOCH returns through LEVLOAD into real level 2, including bank retirement, ready prompt, metadata, fade and starting ball. Deterministic replay awards 177 bonus points; fourteen Canvas images/seven GPU comparisons. Other handlers and later-level progression remain open. [Contract](roller2-progression.md). |
| Roller II colour collection | Implemented bounded original handlers | KCWEG/HCWEG, sparse BCL and GAMED run through five first-level colour collections: score 50, NOI 0 and exact tile-byte/RNG/pixel expectations. Fourteen Canvas frames and seven GPU comparisons; bonus scoring/level loading remain guarded. [Contract](roller2-colours.md). |
| Roller II first floor movement | Implemented bounded original handlers | BEWEG/THE_MOVING, PHALT/stop and Lasttest execute via original SAS$ string dispatch. Keyboard/Gamepad verify 48 field positions, twelve independent Canvas frames and six GPU comparisons; colour/other tile handlers remain guarded. [Contract](roller2-movement.md). |
| Roller II original input loop | Implemented guarded original path | JOAB 619–639, countdown, effects/music toggles, held Help query and original Escape title return. Four guarded direction paths, twenty-four Canvas checks and six more GPU frames; movement and pause/game-over handlers remain gated. [Contract](roller2-input.md). |
| Roller II connected ready prompt | Implemented guarded original path | Original startup/menu, entry through 617, GAMEDISP, blinking prompt, ball palette/sprite, initial fade and status border. Eighteen independent Canvas frames, three input exits and six GPU frames. Guard precedes movement; [ball contract](roller2-ball.md). [Contract](screen-priority.md). |
| Roller II isolated boards | Implemented original routine in a declared harness | GAMEDISP renders all fifteen supplied maps with original entry copies/masks and counts. Independent indexed/RGBA goldens, sixteen Canvas checks and two GPU frames pass. Palette restoration is synthetic; the separate connected ready fixture now covers foreground integration, while gameplay remains open. [Contract](roller2-boards.md). |
| Roller II connected guarded menu | Implemented bounded original prefix | Original executable startup/intro/initialization/setup/menu through 316 runs with continuing tracker playback; destinations report guarded outcomes. Ten browser cases, nine selections and three independent/GPU frames; live WebGL/fullscreen and optional MOD music. Game selection runs original setup through 600, creating screens/rainbow/status rows and loading level 1; the guard precedes board drawing. Other selected routines and gameplay remain open. [Contract](roller2-menu.md). |
| Roller II intro / title image | Implemented bounded original slices | Original startup, WTIN/FDZ/FLOAD and integer Fade lists. Original arrays/highscores, tile-handler tables and work/icon/sprite banks run before a declared handoff skips setup 281–286 and loads the full tall EHB title behind a bounded PAL window. Three input modes, thirteen new independent image states and eleven GPU frames pass; live fullscreen preview. Menu/game initialization and gameplay remain open. [Intro contract](roller2-intro.md). |
| Dir$ / Exist | Implemented bounded subset | Per-program verified directory prefixes, strict synchronous metadata queries, common transfer/channel path routing, memory/Node metadata and explicit RII case mapping. Parent/assign/lock semantics and persistent browser storage remain open. [Contract](directories.md). |
| Original Wonderland session | Implemented first-level subset | Complete source/assets, default WebGL2/explicit Canvas switching and live keyboard/Gamepad mapping and Stop/Resume/Restart; input-only death/fade/game-over/fresh-game replays and jump/scroll/Escape checks. Original Web Audio sample effects, Enable/Mute and owned context cleanup pass; native timing/captures, all-level/win paths and editor files remain open. [Contract](wonderland-game.md). |
| Fsel$ / whole-program compilation | Implemented prepared-host subset | Four string overloads, synchronous host choices/cancellation, original retry/Gosub/Return and selected load/save calls. Unmodified Wonderland compiles and enters its own game branch; four physical frames render across two controlled seconds. Native requester UI and async modal expression continuation remain open. [Contract](file-selector.md). |
| Rnd / Randomize | Implemented source-derived subset | Per-factory word-arithmetic seed transition, integer mask/rejection, cached zero-bound reads, reseeding and optional controlled beam input. Eighteen original enemy streams pass independent vectors. Default seed/beam are zero; native startup/beam timing and captures remain open. [Contract](random.md). |
| Raw bank files | Implemented checked subset | Bload into existing generic bank/address, exclusive-end Bsave, one live allocation per range, stable identities/addresses and synchronous byte-string files. All five original level writeback/save/load slices pass, preserving the omitted fifth seed. Native arbitrary memory/image-bank ranges remain unsupported; Fsel$ requires prepared synchronous choices. [Contract](raw-files.md). |
| Mouse limits / clicks / assignment / hardware adapter | Implemented bounded subset | All three Limit Mouse forms, query-to-query Mouse Click, captured per-program bounds and lifecycle cleanup. Canvas explicitly opts into committed hardware raster coordinates; default local mapping is preserved. Original editor selection slice and scaled/bordered browser replay pass. X/Y assignment uses native doubled words and explicit Limit Mouse bounds; fourteen original Roller II keyboard/Gamepad steps pass. Native startup limits, pointer locking/warping, letterboxing, Hzone/Mouse Screen and general viewport/input routing remain open. Mouse Zone uses the selected live window and offsets. Bounded GPU host switching is implemented. [Contract](mouse.md). |
| Screen zones | Implemented bounded subset | Per-screen Reserve/Set/Reset Zone and current/explicit-screen Zone queries, unsigned-word coordinates, inclusive edges and lowest-number overlap priority. Original five-button panel fixture checks all 10,240 points with injected hardware input and independent panel pixels. Mouse Zone clips hardware input to the current live window, applies hires/scroll conversion, then queries zones; guarded original Roller II menu branches pass. Hardware input requires the explicit Canvas mode; Hzone/Mouse Screen and wrapped count/index aliases remain open. [Contract](zones.md). |
| Full bitmap Screen Copy / selectors | Implemented bounded subset | Two-operand raw copy, Logic/Physic current/numbered tags, clipping/common planes, preserved identities and Bob background ownership, Autoback bypass. All five original map loops publish in a declared fixture; ten Canvas frames and two native GPU frames pass. The separate rectangle overload is implemented; explicit minterms and exact DMA timing remain open. [Contract](screen-copy.md). |
| Flash / Flash Off | Implemented bounded subset | Explicit 1–16-step colour cycles, sixteen global entries, selected-screen cancellation, shared VBL wake with Fade and bounded chronological catch-up. Full original game/editor screen setup, fifteen synthetic Canvas/CPU frames and two native GPU frames pass. Implicit Screen Open colour-3 flashing, shifts, wrapped speeds and exact timing remain open. [Contract](flash.md). |
| Fade to black / screen / explicit palette | Implemented bounded subset | Fade speed 1–32767, captured 32-register components/goals, next-VBL first step, independent palette wake, catch-up and lifecycle cleanup. Integer lists skip negative/omitted entries; original FDZ/clone fades pass independent pixel/GPU checks. Float colour bit-patterns, bank/mask forms, word-edge timing and Amiga captures remain open. [Contract](fade.md). |
| Screen priority | Implemented bounded subset | Bare/numbered Screen To Front, staged priority and native-style DMA-disabled setup rows. Equal-width lowres windows with per-screen COLOR00; independent ready-prompt pixels and three GPU frames. Ordinary window overlaps and bounded direct sprites across setup rows now render; full-source Roller II editor entry/tile placement and level-test/return have ten additional Canvas/GPU checks. Unequal widths, larger sprite-palette transitions and exact native timing remain open. [Contract](screen-priority.md). |
| Screen windows / scrolling | Implemented bounded subset | Screen Display/Screen Offset, staged windows, field-edge clipping/parking, bounded equal-width lowres overlap slices, late DMA starts, physical-buffer coarse/fine scrolling and shared Canvas/CPU/GPU snapshots. Original game/editor setup fixture and independent landscape/panel pixels pass; general placement/priority, wrapped DMA, HAM fine scrolling and exact timing remain open. [Contract](screen-windows.md). |
| Joystick queries / browser mapping | Implemented subset | Joy plus five AMOS boolean queries, independent ports 0/1, optional configurable keyboard and standard/raw Gamepad API mappings, focus/lifecycle/disconnect cleanup. Original menu fixture and injected device tests pass; physical-controller/Amiga captures remain open. [Contract](joysticks.md). |
| IFF screen loading / rainbow rows / views | Implemented subset | Current/new-screen opaque Load Iff and bounded lowres full-bitmap AMSC placement; blank rainbow tables, Rain read/write and bounded PAL row presentation through shared copper/CPU/GPU snapshots; staged screen replacement/visibility with Auto View/View. Pattern strings, active NTSC, laced/remaining AMSC forms and exact display-list timing remain open. [Contract](title-display.md). |
| Generic bank byte/word/long access | Implemented bounded subset | Start returns per-factory addresses; Peek/Poke, big-endian Deek/Doke and Leek/Loke share owned payloads. Odd addresses work; complete ranges validate before writes, including active-Tracker protection. Swap/shrink retain surviving addresses; reload/erasure retire them. All fifteen Roller II headers and original time writes pass. Bounded raw icon count/pointers/header/planes now support ICCOPY, with separately owned padding/masks; sprite-bank/raw hardware addresses and icon metadata/mask-pointer access remain gated. [Contract](bank-memory.md). |
| Keyboard repeat | Implemented subset | Key Speed uses fixed 50ths; Canvas repeats held keys with native duplicates suppressed and release/blur/Stop/detach/End cleanup. Zero-period and large-word cases remain unsupported. [Contract](key-speed.md). |
| Music extension / sample audio | Implemented subset | Bounded slot-1 decoding for bank selection, sample play/stop, loop settings and Led On/Off. Original Samples descriptors, four voice masks, Paula-derived rates, optional Web Audio stereo adapter, user-activated live-game sound, context/binding ownership, lifecycle cleanup and offline PCM comparisons. Analog response is approximate; other music commands remain unsupported. [Contract](audio.md). |
| Startup / host environment | Implemented subset | Leading literal `Set Buffer` is preserved as compile metadata, without AMOS heap capacity enforcement. `Amos Lock`/`Close Editor` update logical host state and call an optional synchronous adapter. [Contract and limits](startup.md). |
| Timer | Implemented nominal VBL counter | Bare integer read and numeric assignment, signed 32-bit wrap, preserved VBL phase, injected 50/60 Hz clock and independent factories; continues while stopped/waiting. [Source-derived tests and limits](startup.md). |
| Tokenized source | Implemented core | All 27 existing `.AMOS` fixtures decode and parse. Invalid lengths, truncated payloads, unknown tokens, incomplete syntax and unmatched blocks are errors. |
| File variants | Partially verified | The reader recognizes the historical Basic/Pro header strings; execution fixtures primarily use `AMOS Basic v134 `. Other versions need representative files. |
| Source diagnostics | Implemented | Compile/runtime errors include line index and byte offset; CLI adds the filename. Line indices are one-based physical lines. |
| Literals and symbols | Implemented core | Integers, FFP literals, escaped strings, case-insensitive typed names, default values, collision-free JS names. Character decoding follows the existing byte-to-character mapping. |
| Expressions | Implemented core | Parentheses, unary signs, power, arithmetic including `Mod`, comparisons, `And/Or/Xor`; operators follow the original evaluator's token priority and left associativity. |
| Integer semantics | Implemented core | Static and Val-derived integer arithmetic share helpers. Division truncates and retains the signed 32-bit quotient; addition/subtraction check overflow. Multiplication follows the evaluator's quick/checked paths. `Mod` uses unsigned dividend bits and an absolute divisor; zero divisor preserves the dividend. `Inc/Dec` and `Next` wrap. Float-to-integer conversion truncates and saturates; bitwise/Mod operands use that conversion. These edge cases are source interpretations pending AMOS execution comparison. |
| Floating point | Partial | Literal FFP values decode correctly. Integer promotion, arithmetic, loops and decimal input use explicit FFP rules. Ln/Exp/power and Sin/Cos/Tan use source-derived CORDIC; Pi# uses AMOS's stored constant. Base-10 Log still uses JavaScript. Target-library verification, multiply-variant selection and double-precision support remain unfinished. See [numeric contract](numbers.md). |
| Functions | Implemented subset | `Pi#`, `Sin/Cos/Tan` with per-program Degree/Radian modes, `Min/Max` for numbers or strings, `Log/Ln/Exp`, type-preserving `Abs/Int`, integer-valued `Sgn`. Inverse/hyperbolic trigonometry and additional functions remain unsupported. |
| Strings | Implemented subset | Literals, variables, checked concatenation/subtraction, comparisons, string `Min/Max`; `Left$/Right$/Mid$` retrieval and assignment, `Flip$`, `Chr$/Asc`, `Len`, `Instr`, `Space$/String$`, ASCII case conversion, `Str$/Val`. Literals retain embedded zero bytes. Retrieval/assignment follow source validation order; repetition uses word-sized results. Nonempty concatenation enforces String_Max. `Val` retains its dynamic numeric type. AMOS heap limits, extreme raw-memory search offsets and numeric formatting remain unfinished. See [string contract](strings.md). |
| Cline | Implemented bare form | Clears the current full 8×8 text row in paper colour without moving the cursor. Existing Autoback/Bob hooks apply. Original game-load rows match independent portable-font/rainbow pixels. Counted form and general text controls/windows remain open. [Contract](cline.md). |
| Print / Print Using | Implemented bounded subset | `write` preserves separators/newlines; the print host receives values per statement. Using formats one integer/string item with source-derived padding/truncation/signs or tilde slots, sharing screen/file output. Text rasterizes into indexed buffers. Portable fixed-decimal numeric masks are also implemented; exact native float formatting, exponent masks, long-string chunking, full number formatting/streaming and text controls remain open. [Contract](print-using.md). |
| Same-line statements and labels | Implemented | Colon-separated statements, labels before statements, duplicate-label diagnostics. |
| Goto/Gosub/Return/End and On branches | Implemented subset | Static named targets, scoped procedure labels, IP return stack; On Gosub/Goto evaluate one numeric selector and fall through outside the list. Missing targets and invalid returns are errors. Dynamic targets, numbered labels and On Proc remain unsupported. [Computed branches](computed-branches.md). |
| For/Next | Implemented core | Nested/descending loops, optional variable, captured bound/step expressions, first body execution before `Next` check. |
| Conditionals | Implemented core | Inline `If/Then/Else`, structured `If/Else If/Else/End If`, nested blocks, true comparisons return -1. |
| Other loops | Implemented core | `Do/Loop`, `While/Wend`, `Repeat/Until`, multi-level `Exit/Exit If`, integer `Inc/Dec`. Additional loops use synthetic token fixtures. Until's actual 0x025c encoding is tested independently of the token helper. |
| Procedures | Implemented subset | Skipped top-level definitions, parameters, fresh local frames, recursion, named `Global/Shared` declarations, and `End Proc[result]` with typed `Param` slots. Wildcard declarations and additional procedure control commands remain unsupported. |
| Waits | Implemented | `Wait`, `Wait Vbl`, `Wait Key`; fake timer/input tests cover suspension and resumption. |
| Node packaging / CLI | Implemented | Self-contained generated modules, package entry and binary, exit codes, stdout/stderr separation, exclusive output creation. |
| Browser | Implemented core | Generated factory, facade, selectable Canvas/WebGL2 presentation, shared focused keyboard/pointer host and stable-container fullscreen controls. Native fullscreen entry/exit, pointer mapping, resize, renderer replacement and Escape priority pass. Real Chromium checks Canvas colours, keyboard resumption, pointer mapping, program switching and Stop. Screenshot inspected. |
| Scheduler | Implemented core | Step budget, self-jumps, one pending continuation, stale-callback guards, stop/resume and remaining sleep duration. |
| Arrays | Implemented core | Typed multidimensional arrays with inclusive bounds, scalar/array namespaces, local and shared arrays, default elements and bounds errors. Sparse storage; dimension bounds 0–65535, total size must be a safe integer. Re-dimensioning an existing array is rejected. |
| Data/Read/Restore | Implemented core | Read-time expression evaluation, empty entries, array destinations, fresh procedure cursors, caller cursor restoration. Named Restore targets must directly label a Data statement; other forms fail explicitly. |
| Sequential file I/O | Implemented subset | Explicit memory/Node host adapters; `Open In/Out`, `Append`, `Close`, `Print #`, `Input #`, `Line Input #`, `Eof/Lof/Pof`. Latin-1 byte strings, channels 1–10, CRLF records, synchronous adapters, commit on Close. Random records, devices, seek assignments and async adapters remain unsupported. |
| Default bitmap font | Portable ASCII/Latin-1 | Print, Writing and graphics Text render 160–255, including German umlauts/ß, using pinned public-domain rows; ASCII remains unchanged. Independent glyph/pixel and GPU checks; not an Amiga Topaz capture. [Contract](display.md). |
| Browser touch joystick | Optional host adapter | Fullscreen cross with central fire, Auto/On/Off, independent pointers/dragging and keyboard/Gamepad union with opposite cancellation. Lifecycle ownership and emulated mobile Chromium touch/fullscreen checks pass; physical devices/iOS remain unverified. [Contract](joysticks.md#optional-fullscreen-touch-cross). |
| Standalone game-page builder | Implemented | AMOS plus optional checked asset manifest to self-contained HTML with Play/sound/fullscreen, GPU/Canvas fallback and optional touch. Preloaded synchronous bytes; session-memory writes; no general requester/IndexedDB adapter. [Tutorial](game-webpage-tutorial.md). |
| Screens and graphics | Implemented subset | Indexed screens 0–7, 2–64 colours and lowres 4096-colour HAM6 (Hires maximum 16), EHB/HAM pixel conversion, source-derived palette masks, Point/Plot, lines/boxes/bars and text. See [display contract](display.md). Canvas/WebGL use committed screen windows and priority slices; an initial equal-width lowres Dual Playfield subset interleaves real plane pointers. General positioning, live modes and other drawing operations remain. |
| Input | Implemented subset | Shared text/raw FIFO, consumed-event Scancode, Inkey$/Put Key/Clear Key/Wait Key, injected mouse state and canvas-local mouse queries. Physical browser codes, repeats, lifecycle metadata cleanup and original Escape/title routing pass. Encoded Put Key, shift/state queries, composition and the full Amiga input API remain open. [Scan contract](scancodes.md). |
| Asset banks and static images | Implemented subset | Bounded trailer and external AmBs/AmSp/AmIc/AmBk decoding, independent per-instance banks, Load with generic overrides/image appending/group replacement, Paste Bob/Icon, palette transfers, Hrev/Vrev/Rev, image masks and mixed-depth pasting. External bytes use a synchronous files adapter; generated modules embed the decoder. See [bank contract](banks.md). More formats, manipulation and failure/hardware edge fidelity remain unfinished. |
| Bank lifecycle | Implemented subset | Four Reserve As Work/Data/Chip forms, single/all/temp Erase, integer Length, Bank Swap, generic Bank Shrink and single/group Save through synchronous files. Save includes work banks, preserves source bank order, normalizes live image flips and writes planar bytes. Object-bank changes restore saved Bob backgrounds. Missing-bank Save truncates before error; two-absent Swap is an explicit unsupported-memory error. Physical memory, addresses, oversized/corrupt image-save paths and other manipulation remain unfinished. |
| Moving Bobs | Implemented subset | Saved-background drawing, movement, priority, hotspots, Set Bob background/plane/minterm options, Limit Bob clipping, hiding/removal, explicit/manual and cooperative automatic updates, per-buffer snapshots, screen cleanup and animated browser fixture. See [Bob contract](bobs.md) for creation/limit quirks derived from source. Hardware VBL timing and blitter edge effects remain unfinished. |
| Bob collisions | Implemented subset | Bob Col, inclusive first To last range, Col status and repeatable negative searches, cached image masks, current coordinates and screen ownership. Independent-byte fixture and Chromium verify results. See [collision contract](collisions.md). Sprite/cross-type/hardware collision APIs and further hardware edge cases remain unfinished. |
| Double buffering / Autoback | Implemented subset | Separate logical/physical buffers, Double Buffer, Screen Swap selected/all, Autoback 0/1/2 with Bob background synchronization and single cursor/output advancement. Chromium verifies hidden drawing until swap. See [buffering contract](buffering.md). Hardware swap scheduling and multi-screen interrupt side effects remain unverified. |
| Integer Add | Implemented bounded subset | Integer scalar/array targets, signed-long wrapping, opposite-endpoint ranged snapping, numeric operand conversion and lvalue/operand ordering. [Contract](add.md). |
| String branches | Implemented bounded subset | Main ASCII string Goto/Gosub, one evaluation, checked own-label lookup and ordinary controls/stacks. Numeric, procedure/cross-procedure and non-ASCII forms remain gated. [Contract](string-branches.md). |
| Held keys | Implemented bounded subset | Key State(0–127), nondestructive integer booleans, independent per-factory raw state and browser ownership/lifecycle cleanup. Text/Scancode/repeat settings remain separate. Modifier raw mappings and Key Shift remain open. [Contract](key-state.md). |
| Hardware sprites | Implemented subset | Direct 16-pixel, 1–6-plane bank images (third plane ignored for three-plane images; four or more planes publish the first four as an attached pair) with structured rows/shared Canvas-reference composition, pending/presented updates, palette/priority and coordinate helpers have unit coverage; Chromium verifies manual updates, movement, indexed-pixel separation, instance isolation and cursor restoration. Computed/wide AMOS sprites and DMA contention/timing remain unfinished; bounded raw DMA/reuse/manual registers are implemented. See [display architecture](display-architecture.md). |
| Amiga reference/WebGL display | CPU/GPU subset implemented | ABI/chip memory, planar/copper/stack paths, static scroll/DPF, EHB/HAM6 and explicit normal/hires/EHB/HAM IFF fields have synthetic goldens. Weave/line-double take explicit history and handle odd heights. Eight-channel/attached sprite reference, bounded DMA/reuse/manual registers and direct AMOS sprite snapshots pass synthetic tests; Canvas/planar/copper EHB/HAM pixels and WebGL2 probe pass locally. AMOS display/copper commands, superhires/HAM8, live fields, sprite contention/computed allocation, general viewport/letterbox input routing and remaining GPU modes remain open; direct nearest/aspect/letterbox presentation and restoration pass six additional canvas checks; WebGL2 resource uploads/readback/loss restoration pass locally (see [contract](webgl-resources.md)); 179 local non-HAM renderer frames plus 11 Wonderland full-game, 7 Roller II first-image, 11 Roller II intro and 3 connected-menu, 2 icon-copy and 2 board host GPU/CPU frames pass, including 100 seeded frames and shader restoration (see [renderer contract](webgl-renderer.md)); full mode/capture gates remain open. See [mode contract](display-modes.md). |
| Other audio | Open | The bounded sample and MOD tracker subsets are implemented above. Remaining tracker effects, wider AMOS Music forms, synthesized effects, envelopes, speech and remaining platform/extension commands remain open. |
| Encrypted/compiled procedures | Explicitly rejected | Rejected from header flags before parsing their bodies. |
| ASCII input | Not implemented | Planned as a separate frontend sharing the AST/backend. |

## Fixture outcomes

- Tests1–8, 12–18, 20–24, 26–27 execute and halt. Test24 final variables are
  checked because its program does not print. Numeric comparisons use tolerance
  where appropriate.
- Tests9 and 11 print `One`, suspend, then print `Two` after their timer deadline.
  Test10 resumes on keyboard input.
- Test19 contains a subroutine jump into a loop followed by an eventual
  unpaired `Return`. It compiles, then raises `Return without Gosub` on line 4.
- Test25 loops forever intentionally; tests use a finite instruction budget.
- Test7's fourth stored FFP word is `0x96b43f55`, decoding to `1234567.875`.
  The readable ASCII example rounds this number.
- `ArraysData.AMOS` exercises multidimensional and string arrays, DATA and
  labeled Restore. `SequentialFile.AMOS` round-trips a file through string/numeric
  input. These fixtures are generated from explicit token sequences by
  `npm run build:examples`; they are not emulator exports.
- `Graphics.AMOS` draws bitmap text and coloured shapes, pastes an embedded robot
  tile as a transparent Bob and an opaque Icon, waits for a key, then pastes
  flipped copies with changed mask settings and resumes.
  Its generated module is used by the browser page and Chromium test.
- `Bobs.AMOS` builds a hidden Bob frame, presents it with Screen Swap, animates
  two overlapping/flipped Bobs with explicit updates and waits, then restores
  both background buffers on removal. Fake clocks and Chromium verify logical
  versus presented pixels, movement and termination.
  It also configures a selected-plane XOR Bob and clips its right edge with
  Limit Bob; Chromium checks the visible result.
  Ranged Bob Col/Col queries record contact before movement and separation after
  animation; both fake-clock execution and Chromium check these values.

## Semantic reference and outstanding verification

The original [AMOS evaluator source (`+ILib.s`)](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BILib.s)
informs the implementation: `OP_Ret` orders and reduces operators by token code;
`Chs0` negates an operand before subsequent operators; `InFor` captures bounds
and steps, while `InNext` performs the termination comparison. Integer division
uses a signed quotient; assignments call the float-to-integer conversion routine
when required. Addition/subtraction have overflow branches. These are source
interpretations and are covered by synthetic regressions; comparison against an
Amiga emulator remains desirable, especially for edge cases and float rounding.

The [conformance fixtures](../test/fixtures/conformance/README.md) distinguish
source-analysis expectations from reference execution. Eleven fixtures specify
raw program bytes independently of the production token encoder. `Op_Div`
retains a 32-bit quotient, including `-2147483648 / -1`; `Op_Mult` skips overflow
checks when both operand magnitudes fit in 16 bits, otherwise checking the
positive product before restoring its sign. `Op_Modulo` performs unsigned
restoring division after normalizing only the divisor's sign, with no zero
divisor branch. These deliberately preserve interpreter behavior rather than
JavaScript remainder rules. No emulator captures have been added yet.

The [manual's control structures](https://amospromanual.dev/05-04-control-structures.html)
specify -1/0 comparison results and nested loop exits.
[Procedure documentation](https://amospromanual.dev/05-05-procedures.html) describes
fresh local variables, parameters and global visibility.
[Text documentation](https://amospromanual.dev/05-06-text.html) defines semicolons,
tab stops, newline suppression and the four-character default tab spacing.
[Maths documentation](https://amospromanual.dev/05-03-maths.html) establishes default
radians and the core function contracts. Where prose descriptions of arithmetic
priority are less specific than the evaluator, the implementation follows the
token-based evaluator. No external source files have been copied into the project.

Command encodings are checked against the original
[`+Equ.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BEqu.s)
and [`+Lib.s` token table](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BLib.s).
The [string manual](https://amospromanual.dev/05-02-string-functions.html) documents
the string interfaces; [disc access](https://amospromanual.dev/10-02-disc-access.html)
describes sequential file commands. Substring retrieval and assignment are
implemented; assignment bounds and copy behavior follow RInMid/RInMid2 in the
original evaluator and have independent-byte source-analysis coverage.

## Next implementation work

1. Complete floating-point operation semantics, type edge cases and full numeric
   output formatting; verify against reference AMOS execution.
2. Finish remaining expression operators/functions and procedure variants with
   independent binary fixtures and reference behavior.
3. Complete string assignment/limits and remaining file variants; extend reference
   execution coverage beyond the synthetic arrays/DATA/file fixtures.
4. Extend moving Bobs with remaining drawing/collision modes; add sprites, screen
   modes, hardware input semantics, additional bank formats/manipulation and audio. Broaden buffering
   reference coverage, including multi-screen interrupt behavior.
5. Add the ASCII frontend after the core compatibility contracts are stable.

The full objective in PLAN.md remains active. The current work establishes the
core compiler and portable runtime; the expansion milestones are still required.

## Preloaded disk fonts and uncached display forms

Get Disc Fonts / Set Font now support a checked, preloaded monospaced bitmap
catalogue for graphics Text. Native Amiga disk-font decoding and OS enumeration
remain open; missing glyphs are never replaced silently. Uncached AMOS 1.3 Cls,
Screen Hide/Show and Logic/Physic operand forms normalize to existing checked
operations. All eight editable Fastball programs now compile. See
[Fastball and font bounds](fastball.md) for source evidence and remaining assets.
