# Key Speed and browser repeat

`Key Speed delay,period` (`$11c6`) controls focused Canvas keyboard repeat after
numeric-to-integer conversion. The original `InKeySpeed` rejects negative
arguments; `TKSpeed`/`CalRep` convert units using division by 50 and 20,000
microseconds. Thus Wonderland's `Key Speed 10,2` means a 200 ms initial delay and
40 ms repeat interval, independently of runtime `vblHz` or requestAnimationFrame.

The supported subset accepts delay 0–32767 and period 1–32767. Zero-period and
larger word-boundary cases reject explicitly pending reference verification;
they are not clamped into invented repeat behavior. The original conversion uses
a signed low word, which is why larger values need a separate compatibility gate.

The runtime stores frozen settings in `program.state.input.keySpeed`. Node hosts
can observe these settings and continue to inject keys through `sendKey`;
headless execution creates no keyboard timers. The Canvas adapter implements
actual repeat with one pending timer for the latest supported held key. Native
repeat events are suppressed when AMOS repeat is configured. Before Key Speed,
the browser's existing native repeat behavior is preserved.

Keyup, blur, modifier shortcuts, detach, program Stop, termination and runtime
errors cancel controlled repeats. Changing Key Speed resets the held key; its new
settings apply on the next keydown. Resume requires a new key press rather than
restarting a released key. Common character/control keys now carry physical [scan codes](scancodes.md).
Controlled repeats preserve that metadata. Composition and AMOS-wide
operating-system repeat preferences remain separate input work.
Optional [keyboard-to-joystick mappings](joysticks.md) now handle arrows and fire
as held state, independently of this text-repeat path.

`program.subscribeInputReset(callback)` returns an unsubscribe function. It is a
host cleanup notification used by the Canvas adapter for settings/lifecycle
changes. The callback receives `key-speed` for repeat changes and `lifecycle`
for Stop/termination/failure; repeat changes preserve held joystick state.
Reset-listener failures do not replace language failures. The browser
host accepts injected `setTimeout`/`clearTimeout` alongside its rendering hooks;
the test scenario injects a finite fake clock, not an animation-frame clock.

The [source-derived fixture](../test/fixtures/conformance/bank-byte-access.json)
includes original offsets and pinned `InKeySpeed`, `TKSpeed` and `CalRep` sources.
The shared [keyboard demo](../demos/key-repeat.html) asserts events at 0, 200 and
240 ms with no native duplication, then verifies release/blur/Stop/detach/End
cleanup and no pending timers. A focused live canvas exposes the same repeat
behavior with Stop/Resume/Detach controls, exercised in Chromium. It is linked
from the [demo index](../demos/index.html) through
[HTML Preview](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/key-repeat.html).

These are source-derived language and browser-host checks, not AMOS input-device
captures. The browser changes are scoped to the attached Canvas; no global browser
or operating-system keyboard preference is changed.
