# Manual AMAL execution

The complete unchanged Planet Zybex source now compiles to 1,122 instructions.
Its first runtime gap is now computed player Sprite 15 creation at original
**line 1129, byte 53976**. AMAL Z now gets the program beyond level setup. Compilation does not imply playable
Zybex. The separate Bob 21 drop program now executes unchanged in a declared
preview, using real `Wait Vbl`, `Synchro` and `Update` statements.

## Supported profile

`lib/amos/amal.js` owns a pure parser, immutable instruction/expression records
and a per-factory controller. Generated factories embed it without imports,
`eval`, asynchronous callbacks or renderer dependencies. It shares the existing
26 signed-word Amreg globals and gives each installed program ten private local
words, R0–R9. Supported AMAL forms are:

| Form | Behavior |
| --- | --- |
| Let | Assign X, Y, A, R0–R9 or RA–RZ |
| Jump / If expression Jump | Checked single-initial labels; ten taken jumps yield one synchronization call |
| Pause / P | Resume at the next instruction on the next synchronization |
| Move dx,dy,count | Native 8.8 slope calculation and half-pixel initial fractions |
| End / end of string | Finish execution, disable Autotest and retain the installed record |
| AUtotest / AU() | Activate a pre-pass test region / disable it |
| Direct / eXit | Redirect normal execution / preserve its suspended position |
| For / Next | Paired local/global registers, captured bound, +1 word increments; repeats yield |
| BC(number,first,last) | Existing live Bob masks/owners/range and shared collision table |
| Z(mask) | Separate shared AMAL word generator with source-derived multiply/word mixing |
| XS, YS, XH, YH | Live screen/hardware coordinate conversion using the existing bounded screen geometry |

The source-derived scanner ignores lowercase/spacing; uppercase initials carry
meaning. `Begin` and `Banana` therefore name the same B label. Do not uppercase
the source or use JavaScript expression precedence. Operators `+ - * / = <> < >
| & !` apply left to right with signed-word results. Division by zero retains
the accumulator; signed division overflow retains its previous low word.
Decimal/hexadecimal literals and negative literals are supported. General
parenthesized arithmetic and unary negation of registers remain rejected.

The portable subset limits source to 32,766 byte characters, 4,096 explicit
instructions, nested function parsing to 32 levels and the final expression tree
to depth 64. Autotest has its own twenty-taken-jump quota; the normal pass retains ten.
Syntax failures include the original string character offset and
ordinary AMOS line/byte context. Unknown instructions reject; they never become
movement or animation no-ops.

## Installation, ownership and controls

`Synchro Off` selects the supported manual mode. AMAL installation in automatic
mode rejects explicitly. `Amal channel,string` compiles/owns its source, reads the
current [Channel routing](channels.md) pair and resolves the target at installation.
Bobs must exist; computed Sprite targets (8–63) remain gated. Direct Sprites use
their persistent coordinate/image intent. Subsequent Channel changes do not
retarget a program. Ordinary Bob/Sprite statements preserve object identity, so
installed programs continue to see their updated coordinates.

A syntax failure retains the previous installation. After successful parsing,
native replacement removes the old installation before resolving the new target;
a missing target therefore leaves that channel empty. New records are disabled
and locals start at zero. `Amal On` enables all installed programs; its numbered
form enables one. Enabling an ended record does not restart it. `Amal Off` removes
programs and locals, rather than freezing them. Omitted selectors or explicit -1
mean all; this profile checks numbered selectors 0–63 and rejects other wrapped
native selector forms.

`Synchro` runs one interpreter pass when manual mode is enabled, in ascending
channel order. It changes logical object intent only. `Update Off` disables both
automatic Bob and Sprite publication. `Update` runs the existing Bob restoration,
drawing and screen swap, then direct-Sprite publication. It does not invoke AMAL.
Clocked `Wait Vbl` belongs to the ordinary VM; rendering/requestAnimationFrame
does not drive AMAL and no AMAL timer is created by installation or On.

MOVE takes its first step on entry, performs exactly count steps, and resumes
following instructions on the next pass. Counts <=0 become 1. Each unsigned
8.8 slope quotient is word-checked, signed and shifted to a 16.16 increment;
overflow produces zero slope, with the native signed-word consequences preserved.
Each new movement starts with fraction $8000. Later steps combine their retained
fraction with the object's current integer coordinate, including external changes.
There is no forced endpoint correction.

Bob Off, screen retirement, Sprite Off and changed Sprite-buffer allocation
retire affected programs. Default clears programs/globals, restores channel
identity routes and returns to automatic mode. Stop retains manual programs and
movement state while VM execution is paused; Resume continues ordinary waits
without catching up missed AMAL passes. Main End/Edit/failure clears owned AMAL
programs. `program.amalSnapshot()` returns frozen independent inspection records;
it exposes no controller or mutable register arrays.

## Autotest, loops and collisions

An AUtotest declaration activates its test region when normal execution first
reaches it; the tests run before the normal pass on subsequent Synchro calls.
The active region always starts at its entry, with a separate twenty-jump quota.
eXit, implicit closing-bracket exit and quota exhaustion preserve normal resumption,
including an in-flight Move. Direct changes the normal resume point and clears
the pending movement counter. The normal target then runs in that same Synchro
call, as `Animeur` calls the test before its normal phase. No extra field is
inserted. End in either phase disables the test and finishes the program.
AU() disables the test without stopping normal execution.

Labels share one initial-letter namespace across the whole string. Ordinary
Jump and If/Jump must retain main/Autotest mode; Direct must originate in Autotest
and target main code. Nested Autotest, Direct/eXit outside tests, unclosed regions,
duplicate or unresolved labels and cross-mode ordinary branches reject before
installation. Move and For/Next inside tests reject. Pause inside tests remains
an explicit unsupported profile; Wait/On are not implemented in either phase.

For evaluates start and end before storing the start register, so its bound can
read that register's old value. Its body executes at least once, including when
start exceeds end. The captured bound belongs to that For instruction in that
installation; later changes to the bound expression do not affect it. Next
increments the counter as a signed word. A repeat stores the body resume point
and yields; the final Next falls through in the same call. Signed counter wrap
is preserved. Nesting and matching local/global register identities are checked
at compile time. A branch to a Next before executing its For sees the native
initial zero bound cell. The immutable IR is never modified to store loop bounds.

BC evaluates its three operands left to right, passes their unsigned low words
to the existing Bob collision resolver and publishes its shared Col table.
Queries use current logical coordinates, actual screen ownership and existing
stored masks/orientations. They do not draw, generate masks or apply pending
image flips. This profile remains manual-only, matching the native collision
function's synchronization requirement. Runtime failures identify the executing
test instruction and installation location without duplicating the main source
location on the driver error path.

## Evidence and remaining work

The pinned native implementation is
[`+W.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BW.s):
`AniChr`, `AniReg`, `AniExp`, `AnPasse2`, `CreAMAL`/`ResAMAL`, `OnOfFrz`/`DAMAL`,
`Animeur`, `AmJump`, `AmMove`, the word operators and coordinate functions.
[`+Lib.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BLib.s)
provides `MvA3`, On/Off, Synchro and Update;
[`+ILib.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BILib.s)
restores the default routing/synchronization state. This is source-derived
portable behavior, not an Amiga capture or exact interrupt/blitter timing claim.

The [AMOS Professional AMAL chapter](https://amospromanual.dev/07-06-amal.html)
confirms uppercase-initial parsing, left-to-right word expressions, the ten-jump
limit and Off deleting programs. It also specifies the next acceptance boundaries:
Next yields before repeating a loop, ordinary jumps retain their execution mode,
and Bob collision tests require direct Synchro execution. Keep these boundaries
when extending the current manual subset.

Anim/animation lanes, Wait/On, joystick/mouse functions, Sprite collision
and Col functions, local Amreg overloads, AMAL banks/raw-address targets,
Freeze and automatic synchronization remain unsupported. The entire original
program now compiles, but these AMAL runtime gaps and computed/wide Sprites still
block the full game. The original source is not patched to bypass them.

## Bob 21 preview

Choose **AMAL enemy drop (slow preview)** in the
[Zybex demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex.html).
Advance or press a key to play the drop. Host waits are slowed by 5× for visibility.
The fixture retains original Load/Unpack 245–247, manual controls 257, Channel/Bob
and all three string-construction/install lines 279–284, Amal On 1191, Wait Vbl
255 and Synchro/Update 1301–1302. Prepared RX=260/RN=0 admits the drop. The original
screen-2/game setup is replaced by drawing directly on the level-1 background;
a synthetic thirteen-iteration loop and key guards replace the game loop.
No running-game variables/IPs/banks are edited.

`tools/reference/planet-zybex-amal.py` independently decodes the packed world and
original planar image 27, applies the native integer slope recurrence and
composites its transparent pixels. It generates fourteen full-bitmap/viewport
hashes, five PNGs and six arithmetic movement vectors. Unit and browser checks
cover all fourteen positions and images in PAL/NTSC, plus ten actual GPU frames.
Together with earlier fixtures Zybex now has **68 GPU comparisons**. The full
unchanged program also runs separately to its current computed-player Sprite error, with terminal
cleanup verified. Live checks exercise timed playback and renderer/input/disposal
ownership; they do not claim connected gameplay or native timing parity.

## Original missile preview

The same [Zybex demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex.html)
now offers **AMAL missile loop** and **AMAL missile collision**. Both run original
Channel/Bob setup and the complete first enemy string, lines 263–276, on the
level-1 background with original manual housekeeping. A declared eighty-pass
loop/key guards replace the game loop. The collision variant adds one prepared,
stationary Bob 1 at (243,91), using original bullet image 25. It does not simulate
firing, run the ship controller or modify a running VM. Waits are slowed by 3×.

`tools/reference/planet-zybex-amal.py` independently decodes images 14/15/16/25
and the packed world, checks mask intersections and uses generator suspension
points for the original two-Pause/Next delay. Both paths' 81 frames include full
bitmap/viewport hashes and literal counter/score/movement states. Ten PNGs cover
initial flight, pre-hit, same-pass reset and relaunch. The collision path hits
at passes 6 and 70, adding 10 each time; the other path completes movement and
its five-iteration delay without points. PAL/NTSC checks cover **324 frames and
20 additional GPU comparisons**, bringing Zybex to **88 GPU comparisons**.
Stop/Resume retains an armed test and its flight/delay state without catch-up.
These are declared isolated enemy fixtures, not connected gameplay or a native
Amiga capture. The full unmodified program now passes level setup and reaches computed player
Sprite 15 creation at line 1129; input/animation functions and computed/wide
sprites still block the game.

## Random hunters

[AMAL Z](amal-random.md) now has the source-derived shared $1234 seed, unsigned
multiply/word-add/shift/mask recurrence and independent synchronous beam hook.
Basic Rnd/Randomize and Default do not reset it. Original 291–308 runs three
hunters with prepared coordinate/scroll inputs on the level-1 bitmap. Two beam
choices add 324 independent PAL/NTSC frames and twenty GPU comparisons, bringing
Zybex to **108 GPU comparisons**. See the random documentation for reader failure,
reentry/cancellation, zero-mask consumption and the exact fixture boundaries.
