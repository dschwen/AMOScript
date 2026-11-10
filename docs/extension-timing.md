# Extension task intent and raster waits

Two more Ghostlight encodings now have bounded implementations:

| Library/profile | Offset | Statement |
| --- | --- | --- |
| Turbo Plus 2.15 | `$0928` | Amos Pri value |
| AMCAF 1.50beta4 | `$0346` | Raster Wait line |

Keep slot mappings explicit at compilation. These implementations do not change
the AMOS source, emulate Exec scheduling, or expose the physical monitor beam.
The [manual-clock browser demo](../demos/extension-timing.html) steps a synthetic
compiled program through both instructions and its Stop/Resume lifecycle.

## Amos Pri

Turbo R07d at library file offset `$4620` consumes a signed long and returns
without a call outside -128..20. Valid values call Exec FindTask(-294) for the
current task and SetTaskPri(-300), discarding the old priority. The portable
implementation preserves that accepted range and ignored-outlier behavior.

A valid request calls the optional synchronous system adapter once:

```js
system.command('Amos Pri', Object.freeze({ priority: value }));
```

After successful notification, the factory records `state.system.amosPriority`.
There is no assumed initial priority; it remains absent until a valid request.
No adapter is required. Browser/OS task priority, cooperative instruction budgets
and keyboard/Stop ownership remain unchanged. A host may interpret the intent
through its own scheduling policy, but the compiler does not invent one.

Invalid values still evaluate their operand normally, then leave state/hooks
alone. Throwing, malformed or Promise-returning adapters cannot commit the
request. Successful reentrant requests retain the last accepted priority instead
of being overwritten by an outer callback; failed nested requests do not retire
an otherwise successful outer request. Factories own separate intent state.
Existing system commands still receive their original single-name call.

## Raster Wait

AMCAF R0ce at `$4eda` polls the vertical word from VPOSR/VHPOSR. It compares the
argument's signed low word and does not exit on vertical zero. If the current
nonzero line has already reached the target it returns immediately. The second,
horizontal-position overload at `$0358` is not implemented.

The portable subset uses the driver's program-start field clock and the same
nonlaced PAL/NTSC line counts as the copper model: 312 or 262. It samples the
current nominal line, returns immediately for a reached target, or sleeps until
the requested line. Zero and negative low-word targets wait for line one when
called on line zero. Arguments preserve native signed-word wrapping, for example
65536 selects zero and 65535 selects -1.

Positive targets outside the modeled field reject before creating a timer.
The native loop may spin or escape after a missed line-zero observation at wrap;
that sampling-dependent behavior has no deterministic browser counterpart.
Interlace half-lines, horizontal beam timing and exact 68000 polling latency
remain unsupported. No actual GPU scanout position is read.

The parser remains side-effect free. A profile descriptor's `control` flag lowers
to dedicated `extension_control` IR; emission returns the operation's control to
the instruction-function driver. A waiting operation returns fractional
`sleepVbl` with `physicalWait: true`. This is an optimization barrier and cannot
be wrapped in Trap as a synchronous statement. Arguments execute once, including
when a wait suspends and resumes the VM.

Physical waits use the unscaled field clock: host sleepScale does not move the
nominal beam target or alter CIA/music clocks. Ordinary Wait/Wait Vbl retain their
existing scaling. Stop cancels the owned timeout; Resume retains its remaining
computed delay. It does not resample a physical beam after a pause. End/errors
use ordinary driver cleanup.

Event-loop timer granularity can make a wake late. This is cooperative pacing,
not cycle-exact raster emulation or capture of mid-field palette writes. Palette
changes following a wait still use existing display/snapshot semantics; the wait
does not add copper events or reconstruct raster bars from timed CPU writes.

## Evidence and remaining gaps

`test/extension-timing.test.js` covers signed priority bounds, no-adapter behavior,
immutable notification, failures/reentry/isolation, PAL/NTSC fractional deadlines,
slowdown independence, operand consumption, signed low-word targets, passed-line
returns, Trap rejection and owned Stop/Resume/End cleanup. The gallery/browser
probe executes the same synthetic program on a declared manual clock and checks
its live stepping/restart controls. These are source-derived portable checks,
not Amiga execution captures.

Ghostlight now passes these encodings and [Smouse Key](smouse-key.md). Its next
production compile blocker is Pt Raw Play at line 1914, byte 65598. [Pt Sam Stop](amcaf-sample-stop.md) now passes. The recovered Smouse Key routine
reads CIA bit 7 and POTINP bits 6/4: these are the second mouse/joystick port's
three buttons, not the main mouse's held mask. The implementation now supplies explicit portable
second-port input. Pt Sam/Raw support, interlaced atlas presentation and
whole-game execution also remain open. No private game assets are distributed.
