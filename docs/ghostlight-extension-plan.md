# AMCAF, Turbo Plus and the Ghostlight milestone

Planning baseline: 2026-11-09, starting at `7008eb7` on
`feature/amcaf-turbo-ghostlight`. This is an implementation plan, not a support
claim. The local benchmark is `/home/daniel/Programs/ghostlight/GhostLight2.amos`.
Implement reusable extension semantics, keeping the game source unchanged.

Implementation progress: [compile-time extension profiles](extension-profiles.md)
now flow through the API, CLI, page builder, saved projects and desktop form.
Separate typed extension functions/statements preserve exact internal separators.
AMCAF Bank Temporary, Odd/Even, Vclip/Vin and byte-string conversions, plus Turbo
Word Hunt, have bounded implementations and synthetic standalone-module tests.
This completes the profile plumbing and starts the utility subset.
[Explicit read-only system metadata](system-information.md), Request Off, Amos
To Front and AMCAF Flush Libs/Audio Lock now let a bounded original PREPARE fixture
complete with host-provided Exec versions 34 and 40. The rest of boot/graphics,
music and gameplay remain open; there is still no complete game compilation.

The [graphics subset](extension-graphics.md) now adds Turbo F Plot/F Point/Set
Planes and core masked Get Block/plane-selected Put Block. Original INIT graphics
lines 1791–1815 complete with the supplied sprite bank in a declared excerpt,
including all ten block captures.
Six synthetic matrix frames have Canvas/GPU parity. Eight of the game's eighteen
third-party encodings are now implemented; the remaining ten include AMCAF
playback, Raster Wait/Smouse Key and Turbo Amos Pri. The packed walls atlas and
non-word-sized presentation still need separate work.

[Native screen width normalization](packed-storage-screens.md) now makes the
302-/86-pixel requests into the actual AMOS 288-/80-pixel bitmaps. Narrow lowres
copper presentation has three Canvas/GPU checks. The packed walls atlas decodes
all 900 rows with independent Python hashes, and existing-screen Unpack copies
it as bitmap data. Original new-screen Unpack remains explicitly gated on its
interlace/overscan presentation; the LACE flag is preserved rather than dropped.
Narrow slices inside a wider priority output also retain their fetched-data gate;
the cropped narrow-view fixture does not claim that combination.

## What the initial investigation establishes

The source is 67,810 bytes, with 2,005 physical lines, 67,784 code bytes and a
six-byte empty bank trailer. SHA-256:
`2c239036227fb69c28fc07863768d55085ce39a6dd577f3e31c09465f72d1ba8`.
At baseline the compiler rejected AMCAF Pt Play at line 43, byte 2084.
The current compiler passes those music statements, Amos Pri and Raster Wait,
and rejects Smouse Key at line 1750, byte 59604; see the latest progress update.
No complete compilation or game execution has passed yet.

An independent bounded token walk finds **13 AMCAF encodings / 24 occurrences**
and **5 Turbo Plus encodings / 15 occurrences**. Standard extensions add Track
Load, Led Off, Unpack Screen and Request Off. A diagnostic-only production token
walk, with catalog names supplied in an isolated process, reaches all 12,247
tokens. This does not establish parser/lowerer support. In particular, the
production reader also lacks Get Block `$1160`, Put Block `$1190`, Amos To Front
`$24aa` and Request Off (slot 3, `$0016`). The inventory is deliberately separate
from `ExtensionTable.js`; catalog entries must not become executable placeholders.

Reproduce the [extension inventory](../tools/reference/ghostlight-extensions.json):

```sh
python3 tools/reference/inventory_extensions.py \
  /home/daniel/Programs/ghostlight/GhostLight2.amos \
  --extension 8=tools/reference/amcaf-v1.50beta4/catalog.json \
  --extension 12=tools/reference/turbo-plus-v2.15/catalog.json
```

Slot assignments here come from explicit benchmark configuration. Neither slot
8 nor slot 12 universally identifies an extension. The tool emits metadata and
locations, not game code or assets, and does not compile or run the source.

## Required extension surface

Counts are lexical occurrences, including procedures that may not run on a
particular path. Offsets refer to the pinned libraries in [AMCAF](amcaf.md) and
[Turbo Plus](turbo-plus.md); their binary analysis is evidence, not native capture.

| Library | Offset | Entry | Count | Work required |
|---|---|---|---:|---|
| AMCAF | `$108e` | Pt Play | 3 | AMCAF player lifecycle and Tracker-bank integration |
| AMCAF | `$10c6` | Pt Volume | 3 | Music volume, including title fade, separate from SFX |
| AMCAF | `$10a8` | Pt Stop | 2 | Stop music with verified AMCAF voice ownership |
| AMCAF | `$10f2` | Pt Cia Speed | 1 | BPM changes, CIA/VBL modes and clock rebasing |
| AMCAF | `$1400` | Pt Sam Stop | 2 | Voice-mask cancellation during ongoing music |
| AMCAF | `$1412` | Pt Raw Play | 2 | Checked raw sample address/length/frequency and stealing |
| AMCAF | `$142a` | Pt Sam Bank | 1 | Sample-bank selection, including raw-loaded Samples file |
| AMCAF | `$008a` | Bank Temporary | 5 | Bank flags without payload/address replacement |
| AMCAF | `$0346` | Raster Wait | 1 | Cooperative field/scanline wait before Screen Swap |
| AMCAF | `$158c` | Smouse Key | 1 | Exact button bits and portable second-fire policy |
| AMCAF | `$16dc` | Odd | 1 | Integer low-bit test returning -1/0 |
| AMCAF | `$05d6` | Flush Libs | 1 | Explicit portable OS-command policy |
| AMCAF | `$0956` | Audio Lock | 1 | Session audio ownership; no gesture bypass |
| Turbo Plus | `$04fe` | Set Planes | 5 | Screen drawing mask, including Bar and Paste Bob |
| Turbo Plus | `$036e` | F Plot | 4 | Current-plane writes, hooks and bounded clipping |
| Turbo Plus | `$044c` | F Point | 1 | Logical-plane read, -1 outside bitmap |
| Turbo Plus | `$0b86` | Word Hunt | 3 | Five operands with two internal To separators |
| Turbo Plus | `$0928` | Amos Pri | 2 | Signed priority policy without browser scheduling hacks |

## Assets and non-extension blockers

All eight supplied data files pass the current bank or MOD structural reader:
69 sprite images, five data banks (four Pac.Pic. and one Samples bank), and two
four-channel M.K. modules. Further interpretation exposes these blockers:

* `title.abk` decodes as 320×200, five planes; `controls.abk` and `howto.abk`
  decode as 320×100, five planes. `walls2.abk` reaches a **368×900, three-plane
  packed screen with control `$3204`**, which the current packed-picture mode
  gate rejects. Establish the extra flags from AMOS pack/unpack sources and
  independent decoding before widening the gate. Audit the bitmap as an atlas,
  with only the committed display window subject to visible-row limits.
* Title MOD: four orders/four patterns, using nonzero arpeggio `0xy`, tone
  portamento `3xx`, vibrato `4xy` and vibrato/volume-slide `6xy`. Game MOD:
  fourteen orders/ten patterns, using `0xy`, `1xx`, `4xy`, `Cxx` and position
  jump `Bxx`. The existing tracker does not implement 0xy/3xx/4xy/6xy/Bxx.
  The title already fails its effect preflight. Implement AMCAF replay from its
  own player evidence; the standard Track player has different preprocessing
  and cannot simply be renamed.
* PREPARE line 1987 evaluates `Deek(Leek(4)+20)` to inspect Exec's version.
  This is outside checked bank/display memory. Decide an explicit portable
  read-only system-information ABI or a documented external compatibility
  profile. Never map arbitrary low addresses or weaken bank bounds. An opaque
  typed system region is preferable to a Ghostlight-specific constant in Peek.
* INIT captures transparent blocks with Get Block's sixth operand. Torch,
  moonlight and candle rendering use Put Block's fourth plane-mask operand
  (including 32, 48 and `CANDLEPOOLMASK`). Existing opaque block semantics are
  insufficient. Some captured rectangles are 20 or 80 pixels wide, so the
  present word-width restriction also needs source-backed treatment.
* Gameplay opens a 302×180 six-plane screen, a hidden 86×20 six-plane scratch
  screen, enables Double Buffer / Autoback 0 / Update Off, and copies between
  Logic and Physic. Check width rounding, clipping and buffer ownership together.
  Title/help also use overlapping windows with separate palettes and fades.
* SFX reads the complete on-disk Samples file through generic banks 5 or 90,
  extracts its sample headers and sends checked raw ranges to Pt Raw Play.
  Both chip and fast-memory paths need coverage. The game uses positive voice
  masks 8 and 15 while music is active; the current exclusive-player policy
  cannot express this interaction.

## Implementation sequence and acceptance gates

### 1. Explicit extension profiles and complete-source diagnostics

Thread a frozen library/slot profile through Transpiler, Parser and TokenReader;
carry it through CLI, game-page/project builders and the desktop project schema.
Retain current built-in behavior for existing callers. Reject conflicting slots,
unknown versions/offsets and stale cached-overload mismatches with source locations.
Store implemented signatures by library identity plus original offset; never
resolve different libraries through a shared bare command name.

Extend expression registration for extension integer/string functions. Preserve
exact argument types, overload offsets and separator positions: Word Hunt is
`(start To end, action, low To high)`, not five comma-separated operands.
Keep parsing pure and operand evaluation left-to-right exactly once. Pin library
hashes/version IDs in profiles; embed only implemented runtime helpers in emitted
standalone modules. All mutable extension state belongs to each factory.

Gate: synthetic mixed statement/function/overload fixtures, wrong-profile errors,
legacy profile regressions and inventory reproducibility. Do not add no-op handlers
to make the full game appear to compile. Unsupported semantics must still reject.

### 2. Boot and checked utility operations

Implement Odd, Bank Temporary, Turbo Amos Pri and the startup host commands with
documented portable behavior. Flush Libs has no Amiga library cache to flush;
Audio Lock records VM/session ownership, leaving browser AudioContext activation
to the existing gesture adapter. Document observable status, reset and failure
behavior rather than silently swallowing commands. Resolve PREPARE's OS version
read through the chosen system-information contract before claiming boot support.

Implement Word Hunt using checked memory: round addresses down to even, sort,
compare signed words, preserve the normally exclusive endpoint and its special
single-read equal-address path. Preflight access and retain address identity;
exercise each real ring-buffer range from lines 587/590/592 without game-state
patching. Verify action modes from R09f, not a generic JS search API.

Gate: original PREPARE completes; independent integer/bank/search vectors pass,
including malformed ranges, factory isolation and unchanged raw-memory bounds.

### 3. Graphics initialization and lighting

Implement F Point/F Plot against existing canonical indexed buffers with their
different logical/current-plane semantics. Add Set Planes to the shared drawing
path after auditing R04c; specify screen lifetime/reset behavior and which writers
consume the mask. Preserve unselected bits and Bob/Autoback behavior. Do not
implement plane selection by converting the display to RGBA.

Add source-backed Get Block/Put Block overloads, transparent masks and captured
dimensions/padding. Keep explicit Put Block masks distinct from screen drawing
masks; establish how they combine. Test clipping, mask-zero/all, replacement,
double buffering and independent captures, including 20-pixel widths.

Decode the walls atlas's extra mode flags and audit non-word-sized screens.
Gate: original INIT completes, original title/help windows render, PREP_GAME
loads the atlas and prepares both buffers. Independently expected pixel regions
must cover upper-plane lighting preservation, transparency and scratch copies;
compare real Canvas and WebGL output. Temporary prefix fixtures must state their
guards and must not be described as a full-game run.

### 4. AMCAF music, raw SFX and cooperative timing

Factor only genuinely shared MOD/PCM infrastructure out of the existing player.
Implement AMCAF tick/effect memory and CIA-speed semantics from R17d, covering
the actual 0/1/3/4/6/B/C effects and any nested behavior encountered. Preserve
existing standard Track semantics. Specify Pt Volume scaling, song restart,
Pt Stop behavior, and AMCAF's sample/music priority rules. Raw sample writes,
bank replacement/erase/shrink and active playback must obey checked ownership.

Pt Sam Bank must accept the source's loaded representation after complete
validation. Pt Raw Play must preflight byte ranges before stopping/replacing any
voice. SFX may take mask 8 or 15 while music progresses; verify channel return,
sample end, loops and subsequent music triggers against the recovered player.
Broader negative-mask free-voice selection remains a separately gated overload
policy if not implemented in this milestone.

Add Raster Wait to the injected display clock with a defined target-field policy.
It must yield in the gameplay loop and remain cancellable through Stop/Restart;
do not busy-poll or tie AMOS timing to requestAnimationFrame. Document scanline
approximation if exact beam timing is outside the portable model.

Gate: independent full-song tick traces for both modules (including a jump/wrap),
period/volume/effect-memory vectors, overlapping music/SFX control traces and
native browser audio lifecycle checks. Silence, inspector output or a loop flag
does not count as playback. Test 130–220 BPM from real level expressions, CIA/VBL
switching, Stop/Resume and factory/bank retirement.

### 5. Unmodified complete game and local application

Implement Smouse Key's exact bits through the existing input adapter after
auditing its hardware reads. Provide an explicit second-fire Gamepad/touch mapping
while preserving mouse/text/held-key independence and focus cleanup. Retain the
game's WASD/arrows, Space/Return and match controls; choose portable alternatives
for OS-reserved Amiga/meta keys in the harness.

Compile the entire original with no omitted procedures or synthetic handlers.
Build a local standalone HTML and debug counterpart using the existing page
builder, eight preloaded asset files and an explicit extension profile. A Play
button should activate sound/fullscreen and leave the original title in control.
Keep original input-driven replay separate from unit-prefix fixtures.

Gate: title, both help pages and return, game start, movement, torch, match,
candle/checkpoint, ghost/ghoul interaction, life loss and restart, next level,
game over and title return. Verify a fresh game, Stop/Resume/Restart, debug logs,
keyboard/Gamepad/touch and actual GPU frames without VM-variable/IP edits.
Document remaining untested paths rather than claiming completion from startup.

The private browser project now lives at `/home/daniel/Programs/ghostlight-browser`,
with build configuration, an eight-file asset manifest and build reporting. It
reads the original source/assets from the external `ghostlight` directory and
writes JS/normal/debug HTML only to its own `dist/`. Run `npm run build` there;
while unsupported commands remain, it writes a blocked report and no new game
artifacts. The project and game files are not part of this repository. Its builder
rejects output paths inside the compiler checkout; repository ignore rules also
cover recognizable Ghostlight source/module/page names and directories.

The supplied Readme restricts use/distribution of the game. Keep its source,
assets, generated game modules/HTML and full listings out of the public repo and
release artifacts. Public browser tests should use distributable synthetic
fixtures, each with a gallery demo/HTML Preview link. Local benchmark automation
should accept an external directory and clearly report missing inputs. Any public
Ghostlight showcase needs a separately established redistribution grant.

## Support for both libraries beyond Ghostlight

Ghostlight covers only 18 of the combined 500 catalog entries. After its
milestone, continue by coherent families rather than bulk token registration:

1. AMCAF integer/byte-string helpers and exact table-based quick maths; Turbo
   integer/range/relative graphics. Preserve integer widths and each library's
   differing endpoint rules. Use independent synthetic vectors.
2. AMCAF palettes and C2p Shift/Fire/Convert, then Imploder and runtime screen
   transitions; validate original Fire/ScreenTrans in bounded fixtures.
3. Turbo scenes/icons, objects, static blocks and stars; separate scene bank,
   icon bank, masks and viewport state. Verify original supported examples.
4. Turbo plane-pointer views, blitter/star interrupts and AMCAF particles/audio
   queries. Integrate with shared snapshots and per-factory VBL cleanup; no CPU
   fallback presented as WebGL support.
5. Remaining DOS/native-pointer/generated-68000/host-management features require
   explicit adapter or emulation contracts. AMCAF Static is an original RTS,
   Dynamic generates code, and Nfn has an undefined result register: do not invent
   stronger behavior from names or manuals.

For each family, update its contract and compatibility status, rebuild demos and
run `npm run check`; graphics/input/audio/lifecycle changes additionally require
`npm run test:browser`. Include standalone sandbox execution without require,
independent reference vectors, lifecycle/factory isolation and source-location
failures. Keep static deductions, browser checks and actual Amiga captures distinct.

**Next implementation task:** Smouse Key and the remaining Pt Sam/Raw commands,
then interlaced/overscan integration for the atlas. Music playback has VM
integration; Smouse Key is the next whole-file compilation blocker.

The progress entries below describe successive stages; the final entry records
the current VM support. Earlier gated statements are historical stage bounds.

### AMCAF playback progress: pitch kernel

The standalone source-derived pitch kernel now preserves all sixteen literal
finetune tables, the 74-byte portamento-target stride, word-wrapped slides, arpeggio and
integer sine vibrato with separate speed/depth memory. See
[AMCAF tracker implementation](amcaf-tracker.md) for its vectors and remaining
controller/host work. This is a prerequisite, not playback or a newly supported
token: `Pt Play` is still gated.


### AMCAF playback progress: tick controller

The pure controller now executes the Ghostlight effect families through both
modules' first end signal, preserving non-retriggering instrument-only repeat
changes, original PCM, finetunes and volume latches. Synthetic tick tests cover
flow and combined effects; `tools/check_amcaf_music.js` provides a bounded,
read-only external trace without publishing private assets. Scheduling, the
repeat-aware audio adapter and VM lifetime integration remain next. No `Pt Play`
token support or audible playback is claimed yet; see
[AMCAF tracker implementation](amcaf-tracker.md).


### AMCAF playback progress: repeat-aware PCM

The portable PCM renderer now preserves a current fetch until its boundary when
an instrument-only row replaces the pending repeat sample. Fractional phase,
pitch/volume updates, stereo pairing and nonzero one-word loops are covered by
unit tests and eight independent-formula/native Web Audio browser comparisons.
The public `amcaf-pcm` gallery demo plays synthetic music at a declared 50-Hz
preview clock with owned Play/Stop/disposal; no private assets are distributed.
Both private tunes also render finite, nonzero stereo PCM through their first
end signal locally. This supplies the repeat-aware rendering foundation;
streaming audio, CIA/driver timing and VM/SFX ownership remain next, and `Pt Play`
is still gated. See [AMCAF tracker implementation](amcaf-tracker.md).


### AMCAF playback progress: per-voice streaming bridge

The stream bridge emits independently cancellable PCM channels and preserves
computed phase across Pause/Resume. Its composed Web Audio host schedules bounded
queues, drops/trim expired chunks and supports mask-local ordinary-sample
takeover. The synthetic gallery preview now streams the live engine with
Play/Pause/Resume/Stop instead of replaying a pre-rendered loop. Eleven native
browser comparisons cover repeat/pitch routing, takeover, underrun recovery and
filtering; see [audio streaming](audio-streaming.md). Private modules also run
through this bridge headlessly. Driver CIA/VBL scheduling, command registration,
bank lifetimes and actual Pt Sam/Raw ownership semantics remain next; Pt Play is
still gated.


### AMCAF playback progress: VM integration (2026-11-10)

Base Pt Play/Stop/Volume/Cia Speed now execute through driver-owned fractional
CIA/VBL wakes, cumulative PCM frame rounding and existing bank lifetime guards.
The page builder selects the streaming audio host for AMCAF profiles. A synthetic
compiled AMOS application demonstrates the ordinary Play/sound/fullscreen,
Stop/Resume and Restart harness; its opening 128 PCM samples match independent
bytes/phase through native Web Audio. See [AMCAF VM integration](amcaf-vm.md)
for clock/reload rules, callback retirement, evidence and limits.

This raises Ghostlight's implemented third-party encodings from 8/18 to 12/18.
The next production compile blocker is Turbo Amos Pri, slot 12 `$0928`, line 68,
byte 2584. Pt Sam/Raw ownership, other AMCAF commands, interlaced presentation and
whole-game execution remain open. Private assets remain external.


### Priority and raster pacing (2026-11-10)

Turbo Amos Pri now preserves signed-long bounds and records optional synchronous
host intent without changing browser scheduling. AMCAF's one-argument Raster Wait
now returns dedicated control IR and waits on the unscaled program field clock,
with explicit PAL/NTSC, line-zero, passed-line and out-of-field behavior. A public
manual-clock demo covers both operations and owned Stop/Resume/End handling.
See [extension timing](extension-timing.md) for source offsets and limitations.

Ghostlight now has 14/18 third-party encodings implemented. The next compiler
blocker is Smouse Key at line 1750, byte 59604. Its native inputs are CIA bit 7
and POTINP 6/4, so it must not be aliased to the main mouse mask; the next input
work needs a second-port button policy. Pt Sam/Raw, atlas presentation and full
game execution remain open. The original source/assets stay private/external.
