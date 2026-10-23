# Compatibility and implementation status

Updated 2026-10-23. The test suite currently has **248 passing tests**, plus a
passing real-Chromium rendering/input smoke test.
This describes implemented behavior, not a claim of complete AMOS compatibility.
Artifact/unit/CLI checks pass in a clean-install copy on Node 22 and 24; the
Chromium smoke check also passes on Node 24. A workflow is configured, with hosted
execution still pending. See [development evidence](development.md).

## Feature matrix

| Area | Status | Evidence / limits |
| --- | --- | --- |
| Tokenized source | Implemented core | All 27 existing `.AMOS` fixtures decode and parse. Invalid lengths, truncated payloads, unknown tokens, incomplete syntax and unmatched blocks are errors. |
| File variants | Partially verified | The reader recognizes the historical Basic/Pro header strings; execution fixtures primarily use `AMOS Basic v134 `. Other versions need representative files. |
| Source diagnostics | Implemented | Compile/runtime errors include line index and byte offset; CLI adds the filename. Line indices are one-based physical lines. |
| Literals and symbols | Implemented core | Integers, FFP literals, escaped strings, case-insensitive typed names, default values, collision-free JS names. Character decoding follows the existing byte-to-character mapping. |
| Expressions | Implemented core | Parentheses, unary signs, power, arithmetic including `Mod`, comparisons, `And/Or/Xor`; operators follow the original evaluator's token priority and left associativity. |
| Integer semantics | Implemented core | Static and Val-derived integer arithmetic share helpers. Division truncates and retains the signed 32-bit quotient; addition/subtraction check overflow. Multiplication follows the evaluator's quick/checked paths. `Mod` uses unsigned dividend bits and an absolute divisor; zero divisor preserves the dividend. `Inc/Dec` and `Next` wrap. Float-to-integer conversion truncates and saturates; bitwise/Mod operands use that conversion. These edge cases are source interpretations pending AMOS execution comparison. |
| Floating point | Partial | Literal FFP values decode correctly. Integer promotion, arithmetic, loops and decimal input use explicit FFP rules. Ln/Exp/power and Sin/Cos/Tan use source-derived CORDIC; Pi# uses AMOS's stored constant. Base-10 Log still uses JavaScript. Target-library verification, multiply-variant selection and double-precision support remain unfinished. See [numeric contract](numbers.md). |
| Functions | Implemented subset | `Pi#`, `Sin/Cos/Tan` with per-program Degree/Radian modes, `Min/Max` for numbers or strings, `Log/Ln/Exp`, type-preserving `Abs/Int`, integer-valued `Sgn`. Inverse/hyperbolic trigonometry and additional functions remain unsupported. |
| Strings | Implemented subset | Literals, variables, checked concatenation/subtraction, comparisons, string `Min/Max`; `Left$/Right$/Mid$` retrieval and assignment, `Flip$`, `Chr$/Asc`, `Len`, `Instr`, `Space$/String$`, ASCII case conversion, `Str$/Val`. Literals retain embedded zero bytes. Retrieval/assignment follow source validation order; repetition uses word-sized results. Nonempty concatenation enforces String_Max. `Val` retains its dynamic numeric type. AMOS heap limits, extreme raw-memory search offsets and numeric formatting remain unfinished. See [string contract](strings.md). |
| Print | Implemented core | `write` host preserves separators and newlines; default/`print` host receives values per statement. Text also rasterizes into the current indexed screen with cursor movement and scrolling. Full AMOS number formatting and text control sequences remain unfinished. |
| Same-line statements and labels | Implemented | Colon-separated statements, labels before statements, duplicate-label diagnostics. |
| Goto/Gosub/Return/End | Implemented subset | Static named targets, scoped procedure labels, IP return stack; missing targets and invalid returns are errors. Dynamic targets, numbered labels and other variants remain unsupported. |
| For/Next | Implemented core | Nested/descending loops, optional variable, captured bound/step expressions, first body execution before `Next` check. |
| Conditionals | Implemented core | Inline `If/Then/Else`, structured `If/Else If/Else/End If`, nested blocks, true comparisons return -1. |
| Other loops | Implemented core | `Do/Loop`, `While/Wend`, `Repeat/Until`, multi-level `Exit/Exit If`, integer `Inc/Dec`. Additional loops use synthetic token fixtures. Until's actual 0x025c encoding is tested independently of the token helper. |
| Procedures | Implemented subset | Skipped top-level definitions, parameters, fresh local frames, recursion, named `Global/Shared` declarations, and `End Proc[result]` with typed `Param` slots. Wildcard declarations and additional procedure control commands remain unsupported. |
| Waits | Implemented | `Wait`, `Wait Vbl`, `Wait Key`; fake timer/input tests cover suspension and resumption. |
| Node packaging / CLI | Implemented | Self-contained generated modules, package entry and binary, exit codes, stdout/stderr separation, exclusive output creation. |
| Browser | Implemented core | Generated factory, facade, Canvas renderer and focused keyboard/pointer host. Real Chromium checks Canvas colours, keyboard resumption, pointer mapping, program switching and Stop. Screenshot inspected. |
| Scheduler | Implemented core | Step budget, self-jumps, one pending continuation, stale-callback guards, stop/resume and remaining sleep duration. |
| Arrays | Implemented core | Typed multidimensional arrays with inclusive bounds, scalar/array namespaces, local and shared arrays, default elements and bounds errors. Sparse storage; dimension bounds 0–65535, total size must be a safe integer. Re-dimensioning an existing array is rejected. |
| Data/Read/Restore | Implemented core | Read-time expression evaluation, empty entries, array destinations, fresh procedure cursors, caller cursor restoration. Named Restore targets must directly label a Data statement; other forms fail explicitly. |
| Sequential file I/O | Implemented subset | Explicit memory/Node host adapters; `Open In/Out`, `Append`, `Close`, `Print #`, `Input #`, `Line Input #`, `Eof/Lof/Pof`. Latin-1 byte strings, channels 1–10, CRLF records, synchronous adapters, commit on Close. Random records, devices, seek assignments and async adapters remain unsupported. |
| Screens and graphics | Implemented subset | Indexed screens 0–7, 2–32 colours, Lowres/Hires, palette updates, Point/Plot, clipped lines/boxes/bars, text cursors, 8×8 bitmap text and scrolling. See [display contract](display.md). One screen is presented; hardware display modes/composition and remaining drawing operations are unfinished. |
| Input | Implemented subset | Shared FIFO key queue, Inkey$/Put Key/Clear Key/Wait Key, injected mouse state and canvas-local mouse queries. Browser focus, borders and CSS scaling are covered. Hardware coordinate offsets and the full Amiga input API remain unfinished. |
| Asset banks and static images | Implemented subset | Bounded trailer and external AmBs/AmSp/AmIc/AmBk decoding, independent per-instance banks, Load with generic overrides/image appending/group replacement, Paste Bob/Icon, palette transfers, Hrev/Vrev/Rev, image masks and mixed-depth pasting. External bytes use a synchronous files adapter; generated modules embed the decoder. See [bank contract](banks.md). More formats, manipulation and failure/hardware edge fidelity remain unfinished. |
| Bank lifecycle | Implemented subset | Four Reserve As Work/Data/Chip forms, single/all/temp Erase, integer Length, Bank Swap, generic Bank Shrink and single/group Save through synchronous files. Save includes work banks, preserves source bank order, normalizes live image flips and writes planar bytes. Object-bank changes restore saved Bob backgrounds. Missing-bank Save truncates before error; two-absent Swap is an explicit unsupported-memory error. Physical memory, addresses, oversized/corrupt image-save paths and other manipulation remain unfinished. |
| Moving Bobs | Implemented subset | Saved-background drawing, movement, priority, hotspots, Set Bob background/plane/minterm options, Limit Bob clipping, hiding/removal, explicit/manual and cooperative automatic updates, per-buffer snapshots, screen cleanup and animated browser fixture. See [Bob contract](bobs.md) for creation/limit quirks derived from source. Hardware VBL timing and blitter edge effects remain unfinished. |
| Bob collisions | Implemented subset | Bob Col, inclusive first To last range, Col status and repeatable negative searches, cached image masks, current coordinates and screen ownership. Independent-byte fixture and Chromium verify results. See [collision contract](collisions.md). Sprite/cross-type/hardware collision APIs and further hardware edge cases remain unfinished. |
| Double buffering / Autoback | Implemented subset | Separate logical/physical buffers, Double Buffer, Screen Swap selected/all, Autoback 0/1/2 with Bob background synchronization and single cursor/output advancement. Chromium verifies hidden drawing until swap. See [buffering contract](buffering.md). Hardware swap scheduling and multi-screen interrupt side effects remain unverified. |
| Hardware sprites and audio | Not implemented | Hardware/computed sprites, sample/music decoding and playback remain unfinished. Unsupported platform/extension commands fail explicitly. |
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
