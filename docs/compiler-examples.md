# Original AMOS compiler examples

All **19 editable AMOS programs** supplied in `compiler_examples/AMOS_versions`
now compile. `.uaem` sidecars contain host metadata and are not compiler inputs.
The unmodified originals, all ten supplied GALAX banks and the three supplied
Graphics files are pinned under
`examples/CompilerExamples`, with byte lengths and SHA-256 hashes in its manifest.
Their original author and copyright comments remain in the programs.

[Open the catalogue](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/compiler-examples.html)
for individual debug pages with Play, sound, fullscreen, keyboard modes and error
locations. Compilation is covered for every source; full execution is not.

## Rebuild locally

```sh
npm run build:compiler-examples
```

This reads the user's current `compiler_examples/AMOS_versions` files, discovers
the sibling `compiler_examples/Graphics` directory, and writes
19 standalone `.module.js` files, 19 self-contained debug pages, `manifest.json`
and `index.html` in `compiler_examples/build`. Open that index in a browser.
The builder overwrites its generated outputs so subsequent edits can be rebuilt.
To select other input/output directories:

```sh
node tools/build_compiler_examples.js examples/CompilerExamples /tmp/compiler-examples
```

`npm run build:demo` rebuilds the repository catalogue and individual pages from
the **pinned** `examples/CompilerExamples` copies, alongside every browser test.
Update the pinned copies and hashes deliberately when adopting newer originals.
Choose **Keyboard: Typing** for text/number prompts, then focus the canvas. There
is no injected startup input. The supplied GALAX bank names are embedded under
relative paths and the original `AMOSPro_Extras:Compiler_Examples/AMOS_versions/`
volume paths (plus the shorter Compiler_Examples alias). IFF/ANIM assets also
use their original `AMOSPro_Extras:Compiler_Examples/Graphics/` names. `.uaem`
sidecars are excluded. Turtle.anim is embedded; playback is not covered by these
AMOS programs.

## Added language/runtime support

- `Ntsc`, `Screen Colour`, `Chip Free`, `Fast Free`, and one-field `Multi Wait`.
  Ntsc reflects the configured standard. Memory queries use optional synchronous
  `memoryFree('chip'|'fast')` metadata; absent metadata conservatively returns zero.
- Console `Input` suspends the VM, echoes byte characters, accepts Backspace and
  Enter, parses typed numeric/string fields and retries invalid input. Prompt and
  target indices evaluate once before suspension. Assignments occur only after
  all fields and target bounds validate. This first subset uses comma-separated
  fields; embedded commas in quoted strings and general Line Input remain open.
- Explicit `Proc`, main-scope `On Error Goto`/`On Error Proc`/`On Error 0`, and
  `Resume Label`. Error procedures take no parameters. Bare Resume Label uses a
  previously configured label; resuming restores the saved ordinary call/local/
  DATA state. A second error in the handler is fatal. Numeric error selectors,
  general Resume forms and native error numbers remain open.
- Labels on separate lines immediately before DATA now resolve Restore targets;
  intervening executable statements still prevent association.
- `Polyline` accepts 2–256 coordinate pairs with the existing portable line
  raster, checked patterned endpoints and ordinary Bob/Autoback replay.
- `Shift Up speed,first,last,rotate` uses the shared VBL palette scheduler with
  bounded catch-up, first-field onset, screen retirement and Stop/Resume cleanup.
  Rotation flag 0 retains the first colour; 1 wraps the last to the first.
  Speed is 1–32767 and the masked register range must increase. Simultaneous
  Shift/Flash/Fade jobs reject; call Shift Off before changing effects.
- Fixed-decimal `Print Using` accepts a single optional signed `#` field with
  up to nine fractional places. This portable formatter uses JavaScript decimal
  rounding; exact FFP conversion/rounding, exponent and semicolon formats remain
  open. Integer-only and string formats retain their previous behavior.
- `Dreg(0..7)` stores owned integer registers. Only Execall -132/-138
  (Forbid/Permit) are supported, through a checked nesting counter; they never
  suspend browser/OS multitasking. Arbitrary native calls reject. Amos Unlock,
  Break On and Close Workbench record host intent through the existing optional
  synchronous system adapter. Browser Stop remains available.
- `Bell` renders finite four-voice square-wave PCM using the source's note-70
  table, PAL/NTSC periods, default master volume and three-stage envelope.
  Sam Loop cannot loop it, and Stop cancels it. This is source-derived portable
  synthesis, not a recorded Amiga output or an emulation of mutable Wave/Envelope.
- `Get Sprite` reuses checked owned image capture. `Get Block` (word-aligned widths), `Put Block`
  (original location or explicit x/y), `Del Block`, `Del Sprite` and bounded
  logical `Sprite Col` pixel-mask queries support the GALAX forms. Hardware
  channel allocation/collision timing and additional block overloads remain open.
- `Amal Freeze` retains channel programs/counters while disabling their stepping;
  Amal On resumes them. Amal Off continues to remove programs.
- No-destination `Unpack` decodes a full packed picture into the selected existing
  bitmap through ordinary drawing/Autoback; palette and geometry are retained.
- `Scroll Off` disables the default text writer's bottom-row scrolling. Screen
  To Back changes physical priority without selecting the screen.

## Bitmap memory and dual playfields

`Logbase(plane)` and `Phybase(plane)` return CPU-facing virtual addresses for
individual planes of the current logical or physical bitmap. These addresses
occupy a separate range from banks and from GPU snapshot DMA storage. Peek/Poke,
word/long access, Fill, Copy and raw-file transfers share checked complete ranges.
Bytes are big endian, MSB-first planar views of the authoritative indexed pixels;
writes preserve other planes and bypass drawing/Autoback hooks. Word padding is
owned and initially zero. Aliases share addresses, swaps preserve buffer identity,
and replacement/close retires addresses once no live screen owns the buffer.

The initial `Dual Playfield a,b` subset supports distinct, equal-width lowres
screens of at most three planes each, with equal depths or one extra primary
plane. The secondary is hidden as a separate screen. Display snapshots interleave
real plane pointers and set DPF; Canvas/reference and WebGL resolve transparent
zero through the existing display pipeline. The primary owns the entire palette,
including PF2 registers 8–15. Independent offsets are captured at View. Raw
snapshotPlayfield remains a single bitmap. Closing/replacing either screen
unlinks the pair. Hires, clones and arbitrary raster geometry remain gated.

## 3Dcube3 progress screen and complete PAL run

The default 320×32 progress screen now renders through bounded copper DMA.
The former failure at line 95, byte 2984 came from a missing default-short-window
path in the physical bridge. The source and copper geometry checks are unchanged.
A complete input-only PAL run covers precalculation, all 500 animation frames and
both prompts, with five GPU comparisons of the original program. Eight synthetic
PAL/NTSC short-screen cases add eight GPU comparisons and 124,800 independent
pixels. See [the demo](../demos/short-screens.html) and
[window contract](screen-windows.md#short-default-bitmaps). NTSC's later oversized
cube screen remains a separate open geometry limit.

## Bump input and deformation run

Bump's former line 51/1502 Circle failure came from stale initial mouse coordinates,
not an invalid Circle call in the supplied source. Coordinate polls now reconcile
mouse limits without requiring pointer motion. The unchanged source starts at
radius one, accepts radius 80 via pointer input, completes its 64,000-pixel pass
and exits through the original prompt. The [browser regression](../demos/bump-runtime.html)
checks four GPU frames and 61,344 independent pixels/axis vectors. Circle still
rejects zero and negative radii. See [mouse polling](mouse.md#idle-coordinate-polling-and-bump).

## Verification and remaining startup gaps

The shared [runtime browser demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/compiler-examples-runtime.html)
checks a declared planar Copy/block/dual-playfield/Shift fixture against 20,480
independent Canvas pixels and two GPU frames. The unchanged `3Dcube1.AMOS` also
runs for 60 and 120 PAL fields, with two further actual GPU comparisons. With the newly supplied images,
unchanged BouncBobs runs its live animation with seven active Bobs (63 configured slots) and Mapping reaches its real
instructions and interactive preview. Three further Canvas/GPU comparisons and
82,176 independent decoded image/captured-Bob pixels cover these paths. Complete
benchmark runs and mapped-texture completion remain unverified.

Both images carry CAMG `$A1000`. Native `Load Iff` (`Lib.s` IfS1/IfS2) ignores
monitor selectors and extracts bitmap mode bits; the VM now explicitly requests
that policy from the shared reader. Raw metadata and image bytes remain intact.
This does not emulate another monitor's refresh rate, and standalone ILBM
reading continues to reject unsupported monitor IDs.
Unit checks cover all 19 standalone factories, source hashes, input/error paths,
planar memory lifetime, typed formatting, palette timing and finite Bell voices.
These are portable implementation checks, not native Amiga captures.

Initial bounded startup inspection found these remaining issues:

| Sources | Current startup limit |
| --- | --- |
| BouncBobs, Mapping | Supplied graphics now load; live animation/preview are checked. Full benchmark/completion replays remain open. |
| GALAX | All five pictures decode. Automatic AMAL and recorded PLay now run original game selection, movement/firing, a natural death and next-life restart with 36 GPU checks. Later stages, victory, editor and music remain unverified. [Contract](amal-automatic.md). |
| Fractal3, Plasma | Horizontal placement now works; both unchanged sources complete their tested input/animation routes. |
| NTSC cube startup | Oversized default screen windows remain outside the current runtime subset. |
| Bump | Idle coordinate polling now respects its positive mouse limits. The complete PAL radius-80 deformation and original exit prompt run; native raster/math/timing parity remains open. |
| DotBall1, Fractal1, Fractal2 | Reach real Input prompts; complete interactive runs remain unverified. |
| Other examples | Compile and reach execution/precalculation/waits in bounded startup checks; completion and native timing remain unverified. |

Horizontal placement, mixed-width lowres priority and GALAX packed headers are
covered in [the new milestone](horizontal-placement.md). Next work should expand
remaining raster/mode bounds and add input-only gameplay/completion replays.
Do not replace missing files with blank images or weaken runtime checks merely
to make a page appear to run.

## Source evidence

The token signatures and native routines were checked against the pinned
[official AMOS Professional source, revision 533b4b1](https://github.com/AOZ-Studio/AMOS-Professional-Official/tree/533b4b1f5acd604814513f78e02c7b4796cb0531).
Relevant routines include `InMWait`/`WaitMul`, `FnNTSC`, `FnScreenColour`,
`FnLogBase`/`FnPhyBase`, `ShStart`/`Shifter`, `Duale`/`CreeDual`, block and
Sprite collision entry points, and Music.s `Bell0`/`EnvBell`/`TNotes`.
The documented bounded contracts and independent checks distinguish implemented
behavior from native timing, raster-edge and OS equivalence still to be verified.
