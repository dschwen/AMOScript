# Manual AMAL execution

The complete unchanged Planet Zybex source now compiles to 1,122 instructions.
Its first runtime gap is `Autotest` inside the original channel-20 program:
**line 276, byte 11614, AMAL character 11**. Compilation does not imply playable
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
| End / end of string | Finish execution while retaining the installed record |
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
to depth 64. Syntax failures include the original string character offset and
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
Next yields before repeating a loop, Autotest branches remain within their block,
and Bob collision tests require direct Synchro execution. Keep these boundaries
when extending the current manual subset.

Autotest/Direct/Exit, For/Next, Anim/animation lanes, Wait, joystick/mouse/random/
collision functions, local Amreg overloads, AMAL banks/raw-address targets,
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
unchanged program also runs separately to its exact Autotest error, with terminal
cleanup verified. Live checks exercise timed playback and renderer/input/disposal
ownership; they do not claim connected gameplay or native timing parity.
