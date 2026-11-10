# Writing AMOS games with a fixed game speed

Make movement, resource consumption, cooldowns and animation depend on game time.
Keep drawing frequency and CPU throughput out of those calculations. A faster
machine should draw more often or finish its work earlier, rather than moving
characters faster or burning a torch sooner.

These recommendations apply to AMOS authoring and browser ports. The listings
are readable AMOS source for an AMOS editor; AMOScript currently compiles
**tokenized `.AMOS` files**, not these listings as ASCII input. This guide adds
no automatic pacing feature or runtime behavior change.

## Choose the clocks deliberately

| Clock | Use it for |
| --- | --- |
| Fixed simulation updates | Movement, collisions, enemies, resource depletion and gameplay cooldowns. |
| Elapsed clock ticks | Deciding how many simulation updates are due, or measuring an explicitly real-time deadline. |
| Display refresh | Presenting the latest state and yielding with `Wait Vbl`. |
| Music/audio timing | Tracker tempo, sample playback and audio scheduling, independently of drawing. |

The examples use a **50 Hz simulation** and a **50 Hz clock**, a PAL-oriented
starting point. They are separate settings: a 25 Hz simulation can also use a
50 Hz clock. For a 60 Hz clock profile, change `CLOCKHZ` to 60 while retaining
`UPDATEHZ=50` if you want the same gameplay. Choose a simulation rate appropriate
to the game; 50 Hz is not a universal statement about the intended speed of an
existing AMOS program.

In AMOScript, `Timer` counts the configured VM VBL clock: 50 ticks per second by
default. It does not count rendered frames. A monitor running at 120 or 144 Hz
does not change that clock. Confirm the timer rate of each native or host profile
you target instead of assuming every environment has the same refresh rate.
See [runtime timing](startup.md#timer).

## Avoid counting unrestricted loop iterations

This loop makes game speed depend on how quickly the CPU can execute it:

```amos
Do
   X=X+1
   Dec TORCH
   Rem Draw the new state here
Loop
```

The same problem occurs with delay loops such as `For DELAY=1 To 10000 : Next
DELAY`, keyboard autorepeat counts, or counters incremented once per drawing
pass. Changing renderer, enabling compiler optimization or upgrading the CPU can
change all of them.

Adding one `Wait Vbl` at the game-loop boundary is a useful minimum: it prevents
an unrestricted loop from running as fast as possible. It is not by itself a
complete solution when work takes longer than a refresh interval. Browser timers
can also wake late, and AMOScript currently implements `Wait Vbl` as a relative
wait, not a cycle-exact wait for the next physical display edge. Account for
elapsed time when a consistent simulation rate matters.

## Recommended pattern: fixed updates, elapsed-time accounting

Accumulate elapsed clock ticks. Run one or more fixed simulation steps when
needed, then draw once. Express speeds in units per second and convert them to
units per simulation step. Keep resource lifetimes as integer simulation ticks
when possible.

This small example moves a square at 100 pixels per simulation second and gives
its torch 20 simulation seconds. Left and right together cancel. Drawing and
input sampling happen outside the catch-up loop.

```amos
Screen Open 0,320,200,16,Lowres
Curs Off : Flash Off

CLOCKHZ=50
UPDATEHZ=50
MAXSTEPS=5
MAXELAPSED=10
CREDIT=0
LASTTICK=Timer
PLAYERX#=160.0
TORCHTICKS=20*UPDATEHZ

Do
   CURRENTTICK=Timer
   ELAPSED=CURRENTTICK-LASTTICK
   LASTTICK=CURRENTTICK
   If ELAPSED<0 Then ELAPSED=0
   If ELAPSED>MAXELAPSED Then ELAPSED=MAXELAPSED
   Add CREDIT,ELAPSED*UPDATEHZ

   J=Joy(1)
   DIRECTION=0
   If (J And 4)<>0 Then Dec DIRECTION
   If (J And 8)<>0 Then Inc DIRECTION

   STEPS=0
   While CREDIT>=CLOCKHZ and STEPS<MAXSTEPS
      PLAYERX#=PLAYERX#+DIRECTION*100.0/UPDATEHZ
      PLAYERX#=Max(0.0,Min(312.0,PLAYERX#))
      If TORCHTICKS>0 Then Dec TORCHTICKS
      Add CREDIT,-CLOCKHZ
      Inc STEPS
   Wend

   If CREDIT>=CLOCKHZ Then CREDIT=CREDIT Mod CLOCKHZ

   Cls 0
   Ink 2
   Bar Int(PLAYERX#),100 To Int(PLAYERX#)+7,107
   Wait Vbl
Loop
```

`CREDIT` uses integer units: each elapsed clock tick adds `UPDATEHZ`, and each
simulation update spends `CLOCKHZ`. This avoids rounding a fractional number of
updates every display frame. Carrying the remainder also supports rates such as
50 simulation updates per second on a 60 Hz clock.

At 50 updates per second, the square moves two pixels per step. At 25 updates per
second it would move four. `TORCHTICKS` decreases only in simulation steps, so a
faster rendering loop cannot consume it faster. Physics, collision detection,
enemy logic and gameplay animation should follow the same step boundary. Keep
fractional positions in `#` variables and round only when drawing.

This example intentionally bounds recovery after a stall:

- `MAXELAPSED=10` accepts at most ten clock ticks from one sampling interval
  (0.2 seconds on the example's 50 Hz clock).
- `MAXSTEPS=5` performs at most five updates before drawing and yielding again.
- If whole updates still remain overdue, `Mod` drops them while retaining the
  fractional credit.

Consequently, a severely overloaded device or a returning background tab can
lose simulation time. That is a deliberate policy to avoid a long catch-up burst,
teleportation and instant resource depletion. It does **not** guarantee full
speed when the device cannot process the required work. Choose different limits
or pause explicitly if that better fits the game. Do not allow unlimited catch-up
that leaves input and rendering starved indefinitely.

## Use elapsed-time movement selectively

For a simple menu animation, scrolling decoration or other behavior without
sensitive collision rules, elapsed-time updates can be sufficient:

```amos
DT#=ELAPSED*1.0/CLOCKHZ
X#=X#+VELOCITY#*DT#
```

Here `ELAPSED` is the checked, bounded tick difference sampled as above, and
`VELOCITY#` is measured in units per second. The `1.0` preserves a fractional time
value. Do not also multiply movement by elapsed time inside a fixed simulation
step; that would account for time twice.

Large variable steps can pass through walls or miss triggers. Prefer fixed
steps for collision-heavy games, or subdivide a large elapsed interval into
bounded steps before checking collisions. Using fractional positions does not
by itself prevent tunnelling.

## Separate rendering, input and sound

Draw the latest state once after the simulation updates. Put buffer publication,
Bob updates and the appropriate display synchronization at that presentation
boundary. Do not advance gameplay just because a draw or buffer swap happened.
If rendering is too expensive, reduce how often you draw before changing the
simulation rate. Interpolation between previous/current states is an optional
visual improvement; interpolated positions must not replace collision state.

Read held directions once per outer pass and reuse that input snapshot for its
fixed updates. Treat one-shot actions separately. Latch a new fire/key edge until
a simulation step consumes it, then clear the pending action. Otherwise a pass
with no update can lose a press, while a catch-up pass can fire several times.
Do not base movement on operating-system keyboard-repeat events, and avoid
repeatedly consuming `Inkey$` or `Mouse Click` inside catch-up steps.

Start a music track when the game changes tracks, rather than restarting it on
each update. Let its playback engine keep musical time. Trigger sound effects
from gameplay transitions and use simulation-time cooldowns where appropriate;
a held button should not enqueue an effect on every drawing pass. Slowing the
game should not require changing MOD tempo, sample frequency or the audio clock.

## Handle pause and long interruptions explicitly

After an intentional in-game pause, resume with a fresh elapsed-time baseline:

```amos
LASTTICK=Timer
CREDIT=0
```

Do not reset the global `Timer` just to measure one subsystem's elapsed time.
Other deadlines and animations may depend on it. Keep separate last-tick values
or remaining-time counters for unrelated systems.

Decide which deadlines use simulation time and which use real elapsed time. A
torch that should freeze during pause belongs to simulation time. An explicitly
real-time challenge may use a clock deadline, but must define whether menus,
background tabs and host Stop count toward that deadline. In AMOScript, host
Stop does not stop `Timer` from advancing; do not assume resume excludes that
time automatically. The runtime separately owns pause/resume of its audio engines.

## Porting existing games to AMOScript

Identify the loop that represents one gameplay update before changing timing.
For each counter, ask whether its unit is a pixel, simulation tick, clock tick or
second. A timer-based match lifetime and a per-loop torch drain can run at
different apparent speeds even in the same program. Test them separately.

The page builder's current `--slowdown` / Speed control scales future explicit
`Wait` and `Wait Vbl` delays. It does not establish a fixed update rate for a busy
loop, rescale `Timer`, or retime music. Likewise, the VM's instruction budget is
for cooperative execution; it is not an emulated Amiga CPU speed. See
[page-builder controls](game-webpage-tutorial.md).

Automatic host calibration could help meet a **declared** virtual execution or
update rate, but cannot discover an existing game's intended native speed from
browser performance alone. Establish a reference cadence or duration first.
A fixed main-loop timing boundary gives clearer gameplay semantics than applying
an arbitrary instruction-rate multiplier to every routine, including loading and
menus. CPU/cycle emulation and automatic main-loop pacing are not implemented by
this guide.

## Check behavior rather than the FPS counter

Measure observable outcomes over known amounts of simulation time:

- Unobstructed distance travelled in one or ten seconds.
- Torch/resource lifetime and action cooldown duration.
- Enemy movement and animation phase.
- Held directions, quick one-shot presses and opposite directions.
- Music tempo while gameplay is busy, idle, paused and resumed.

Repeat with Canvas and WebGL, compiler optimization on/off, desktop and mobile,
CPU throttling, and different display refresh rates. Within the device's ability
to sustain the simulation, these outcomes should remain stable even if rendered
FPS changes. Test both 50 and 60 Hz clock profiles if you support them. Also test
stalls and background/resume transitions: recovery should follow your documented
catch-up or pause policy, not produce an uncontrolled burst of updates.
