# AMAL joystick input and animation lanes

Planet Zybex's original horizontal ship and eight bullet AMAL strings now
compile and run. `J0`/`J1` (also written `Joy0`/`Joy1`) and independent `Anim`
lanes remove the previous line-1142 installation failure. A bounded input-only
run of the **complete unchanged game** now covers forty manual fields per video
standard, including movement, real bullet launch and its first explosion.
This establishes that prefix, not full-game completion or native Amiga parity.

Choose **Ship controls and animation** in the
[Zybex preview](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex.html).
Advance to start, then use the focused canvas: arrows move; Ctrl or standard
Gamepad fire sets the ship's fire flag. This isolated fixture omits the Basic
bullet-launch/landscape loop. Its declared collision input at field 73 plays the
original explosion, and its finite loop stops at a final key guard. Waits are
slowed by 3×. Select another view and return to replay.

## Joystick operands

`J0` and `J1` have no argument list. The native uppercase-initial scanner also
accepts `Joy0` and `Joy1`; `JOY1`, `J2` and `J1(0)` reject. Command-position Jump
and J labels keep their existing meaning. Results are masks 0–31, sharing Basic
Joy's up/down/left/right/fire bits 1/2/4/8/16.

Each occurrence polls the existing synchronous joystick reader, left to right,
at evaluation time. No per-field cache, RAF dependence, input consumption or
new browser API is introduced. With no reader, the per-program injected mask
is used. `setJoystick`, `setJoystickReader`, keyboard, Gamepad and optional
virtual joystick mappings remain the host contract in [joysticks](joysticks.md).
Opposite-direction cancellation belongs to those mappings, not AMAL arithmetic.

Invalid, asynchronous and throwing readers fail before the containing assignment.
AMAL rejects recursive Synchro and checks channel/target ownership and host
Stop before committing a pending read. A retired installation or changed reader
cannot relatch a returned mask or write the old target. Previously completed
instructions retain their effects. Errors retain the AMAL command character and
original AMOS installation location.

## Independent animation lane

`Anim repeats,(image,duration)(image,duration)...` installs or replaces one
animation lane on that channel. The repeat expression is evaluated immediately;
image/duration expressions remain owned immutable ASTs and are evaluated only
when their frame is reached. At least one pair is required. The portable profile
caps a list at 256 pairs, retaining the existing source/AST limits.

Each manual Synchro runs a channel's Autotest, normal program, then animation.
New Anim falls through normally and publishes its first image in that same
pass. The animation advances alongside Pause, Move, jump-budget yields and For
loops. A later Anim in either execution phase replaces the earlier lane before
the animation phase runs. Direct preserves the lane until an explicit Anim
replaces it.

The frame image writes A first; its duration expression therefore sees the new
A. A duration failure retains that completed image write, matching the native
operation order. Image words use the existing Bob/Sprite intent and bank lookup
rules. Publication still requires Update in manual mode; no playfield overlay
or renderer timer drives animation.

Native countdowns are unsigned 16-bit storage. A positive duration N holds that
image for N passes. Zero wraps through 65,536 passes, and -1 through 65,535;
neither is an immediate tight loop. Repeat zero loops forever. Other repeat
words count complete traversals; negative values retain their unsigned word
count. Finite completion leaves the final image in place and clears the lane when
its last countdown reaches zero.

**AMAL End ends the normal/Autotest lanes and retains animation.** The diagnostic
`ended` flag describes the normal lane. `amalSnapshot()` now includes a frozen
`animation` record (`index`, `remaining`, `loops`) or null; index is the next pair
to fetch. Ordinary AMOS End/Edit/failure, Amal Off, replacement and target
retirement release owned lanes. Stop freezes them; Resume continues without
catch-up. The driver also honors a host Stop before executing the next AMOS
instruction, including when Stop is called synchronously from a frame callback.

## Evidence and verification

The primary executable source is
[AMOS-Professional-Official +W.s, revision 533b4b1](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BW.s):
`AniJoy`, `AmJ0`/`AmJ1`, `ClJoy`/`JoyTab`, `AnAni`, `AmAni`, `AmDoAni`,
`Animeur`/`AmRet` and `AmStop`. These establish input reuse, lazy expressions,
word counters, animation ordering and End's independent lane behavior.

`tools/reference/planet-zybex-amal.py` independently transcribes the original
horizontal AMAL program, models native jump/Move/animation suspension and decodes
the raw packed background and AmSp bitplanes. It imports no production parser,
runtime or rendered frames. Eighty-nine records include neutral/cardinal/
diagonal/fire input, exact read counts, coordinates, shared registers, animation
state and full-image hashes; twelve PNGs illustrate the sequence.

The isolated fixture retains original Global/array declarations, clear_amal and
**the entire horizontal_ship procedure**, including all eight inactive bullet
programs. Hidden coordinate screen geometry, level=1, manual loop/key guards and
a Basic RZ assignment at field 73 replace the omitted game/landscape loop. No
AMAL fragments, live VM variables, IPs or bank pixels are patched. Unit and
browser tests compare **178 PAL/NTSC frames** and 24 additional GPU frames.
Live-host checks use real keyboard events and an explicitly injected Gamepad API
device, then run the explosion and replacement/disposal paths.

A separate full-source replay drives only the joystick adapter: neutral for five
fields, right for ten, up+fire for ten, then neutral. Source-derived first-25-field
coordinates/images, a real bullet and the first explosion are checked. A host
Stop at field 40 preserves all seventeen installed programs and clears held
input/timers. Eight extra GPU/reference comparisons inspect the real playfield,
Sprites and hires score strip. These full-game images have GPU/reference parity;
independent complete gameplay-image expectations remain a next acceptance step.
Total Zybex coverage is now **174 GPU comparisons**.

Regenerate with `python3 tools/reference/planet-zybex-amal.py` and
`npm run build:demo`; verify with `npm run check` and `npm run test:browser`.
Longer life/restart and horizontal/vertical progression replays, audible sample
verification, a full application launcher, remaining AMAL functions and native
beam/interrupt captures remain open. Automatic synchronization is still gated;
Zybex explicitly uses Synchro Off and Update Off.

## Connected loss/restart update

The [full-game replay and page](planet-zybex-game.md) now extend this prefix through
all five life losses, four reloads, GAME OVER and a fresh game, with keyboard/
Gamepad, independent regions and original sample verification. The Play Game
launcher uses the public shared harness. Later-level completion/progression and
native captures remain open; this document's 40-field/174-GPU figures describe
the earlier input/animation slice (current total: 214 Zybex GPU comparisons).
