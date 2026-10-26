# Complete original Roller II browser runner

The [live demo](../demos/roller2-game.html) embeds the complete unchanged
`examples/Roller2/Roller II.AMOS` and all 32 pinned source/data assets. Its
[HTML Preview link](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-game.html)
is also in the generated gallery. The earlier bounded fixtures remain useful
unit acceptance cases; this runner omits no original statements or procedures
and inserts no instruction guards.

The initial live surface uses WebGL2, fullscreen, keyboard/Gamepad input and
optional gesture-activated sound. Enter fires, arrows move, Space reaches the
original pause screen, and M/F toggle music/effects. Escape exits fullscreen
before a subsequent Escape can reach AMOS. Restart preserves the container and
rebinds the owned audio session. VM/host errors are displayed and require Restart.
A Canvas host is available when WebGL initialization fails; automated GPU evidence
requires actual GPU execution and never counts that fallback as a GPU frame.

## Current acceptance path

`test/helpers/roller2Replay.js` runs the complete source through:

1. Original logo, input, initialization and title menu with continuing MOD music.
2. Original first-level ready prompt, starting ball and colour collection.
3. All five first-level collections, bonus and actual level-2 loading. On the
   declared 4 ms cooperative clock the resulting score is 248.
4. Level-2 ready input, ball metadata, down-arrow wall stop and up/left arrows,
   reaching board position (5,3) without changing the level payload.
5. Host Stop, 31 seconds of injected clock time, Resume and the original Timer
   expiry/game-over branch. Audio positions freeze during Stop and rebase on
   Resume. AMOS Timer keeps running, as the established host contract specifies.
6. Original Boom/fade effects, tracker stop/bank-22 erasure, original game-over
   image load and AMOS Music start.
7. Original input exit, Mvolume fade, Music Off/bank-3 erasure and the attempted
   high-score image load, which fails explicitly because the supplied asset is
   absent.

Only physical input and host Stop/Resume are injected. No variables, instruction
pointers, procedure targets, bank bytes or source statements are patched. The long
host stop deliberately exercises lifecycle/Timer semantics; it is not evidence
of native busy-loop speed or a normal uninterrupted 31-second gameplay recording.
The source follows the timeout branch with its own score and stack state.

Both keyboard and injected browser Gamepad paths replay the sequence. Twenty
Canvas frames match the shared CPU presentation; ten actual GPU frames match
physical snapshots with CPU presentation disabled during GPU rendering. Twelve
independent image-region comparisons cover six source-derived PNG fixtures in
both input modes: full logo/title and the upper 192 bitmap rows of the colour,
level-2 and arrow scenes. Cropping those board regions deliberately excludes the
clock-dependent score/time panel. Game-over pixels have CPU/GPU parity evidence,
not an independent native image capture. Two empty Canvas presentations and one
GPU clear verify that the missing-image failure forgets the removed screen.

Interactive offline gallery checks additionally exercise real-time start/ready
input, fullscreen, sound activation, Stop/Resume, Restart with the owned audio
binding, the post-game error path, separate title-menu scores entry, recovery
and context/fullscreen disposal.

## Reached display fix

Original line 1007 executes `Rainbow 0,1,380,24` to park its rainbow outside the
visible PAL field. `src/w/rainbow.cpp` stores a word Y and
`src/w/copperlist.cpp::update_rainbows` clamps the lower edge to 28 without a
field-end clamp. Those sources are pinned at
`efddf2c9a09bf61a45b7b096a9be84630853c2b1` in AMOS-Professional-Official.

The bounded display profile now accepts Y 0–65,535 when the effective Y plus
height does not wrap a word. Height remains 0–312. Off-field ranges retain their
metadata and produce no palette writes in the visible snapshot. Wrapped end
rows, negative/wrapped selectors and active NTSC rainbows remain unsupported.
A unit case verifies parked output, retained pixels and atomic rejected forms;
the full-source replay reaches the original statement unchanged.

## Missing original image and remaining work

Original line 1044 requests `RII:iffp/roller hi`. That file is absent from both
the supplied `RII/iffp/` directory and the pinned manifest. A case-insensitive
adapter cannot resolve an absent image. The runner preserves the original
request and reports its filename/source location. It does not alias another
image or alter the source. Title-menu Scores sets VTB=1 and skips that load; its
separate scrolling view is exercised by the live gallery test.
The replay expects this declared failure and checks halted state, silenced music,
cancelled wakes and retained off-field rainbow metadata. Passing this replay does
not mean the missing-image error has been repaired or high-score return works.

The host filesystem holds prepared byte strings in session memory and maps AMOS
case/volume paths explicitly. Writes, if reached, remain in that session across
Restart and disappear on page reload; this is not IndexedDB persistence. The
accepted route performs no writes. File selection, editor writeback, native
requesters, help/win/high-score entry/return flows, other tile handlers and later-level
completion remain unaccepted. IndexedDB remains planned in PLAN.md.

Next obtain the original `iffp/roller hi` asset, continue full-source input replays
through the remaining handlers and end states, and compare with external Amiga
execution/audio captures. The current checks establish a bounded working path in
the complete program, not full game or AMOS compatibility.
