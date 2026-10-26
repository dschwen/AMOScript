# Edit as a terminal host request

`Edit` (`$0670`) now compiles to a distinct terminal `edit` control. Execution
halts at that instruction, retaining an inspectable frozen
`state.editRequest = { command: 'Edit', location: { line, offset } }`.
The location is copied from the actual compiled input. Handwritten instruction
tables without source metadata produce a null location. No following statement,
Gosub Return, procedure return or main continuation executes. Resume, tick and
keyboard injection cannot continue a halted program; Restart requires a new
factory instance.

The driver performs its normal terminal cleanup before notifying a host: it
cancels VM/palette/tracker wakes, stops tracker/sample voices, cancels palette
jobs and clears held raw keys, joystick state, mouse buttons/click history and
Scancode metadata through the existing lifecycle subscriptions. Queued text,
variables, arrays, procedure/Gosub frames, banks and the final display remain
inspectable under the existing terminal-state contract. GPU resources, browser
containers and AudioContext ownership stay with their adapters/callers.

After successful cleanup, an optional synchronous adapter receives
`system.command('Edit', request)` exactly once. It sees a halted, cleaned program
and a deeply frozen source request. No adapter is required: without one, the
request remains available and the VM stays halted. This does not open an editor
or set `state.system.editorOpen` true. The browser demos have no embedded source
editor; they report the request and offer Restart.

The driver consumes the notification before calling the adapter. Reentry cannot
repeat it. Invalid, throwing or thenable-returning adapters fail with source
context while the VM remains terminal. A failed cleanup suppresses notification.
A host that starts another VM and then fails does not cause old cleanup to run
after that new VM starts. Late callbacks remain inert even when a host's
clearTimeout cannot remove them. Host side effects are not rolled back.

Source evidence is pinned to AMOS-Professional-Official revision
`efddf2c9a09bf61a45b7b096a9be84630853c2b1`: `src/interp/control.cpp`
`interp_in_edit` calls `error(1000)`; the error path excludes codes at least 1000
from Trap/On Error handling and clears continuation. `src/interp/run.cpp` treats
these codes as program-to-host returns rather than ordinary source errors.
The implementation retains that terminal control meaning. Native editor UI,
source focus, Direct/System commands, exact screen/audio teardown and reference
execution remain outside this portable host boundary.

The [browser demo](../demos/roller2-edit.html) runs unchanged original sample load
15 and ROUNDTURN 949–957. PHALT is a declared Return stub and BEWEG a Wait Key
guard. Four cardinal directions take original rotation branches; prepared zero
and diagonal directions reach original Edit 956 and never fall through to 957.
The entry/file input and vector bitmap are declared fixtures; this is not native
movement, a reachable full-game replay or an editor integration. The request's
line/offset describe the relocated fixture, while its original source statement
is documented as line 956. Sample commands are logged silently in this preview.

Five headless groups verify literal decoding/AST/IR, frozen request/source
identity, default/optional host handling, once-only terminal behavior, nested
procedure/Gosub frames and typed state retention, tracker/sample/fade/input/timer
shutdown before notification, failed cleanup, throwing/asynchronous hosts,
replacement-VM isolation, late callbacks and all six original direction cases.

The shared browser scenario checks twelve independent axis/diagonal vector
Canvas frames, four actual GPU comparisons and two editor notifications. It
prepares held input through the real Canvas keyboard/joystick adapter and checks
that terminal cleanup releases it before notification. GPU rendering disables
CPU presentation. The live page covers the terminal request, guarded rotation,
fullscreen and fresh Restart. Its HTML Preview link is in the gallery. These
are source/fixture and CPU/GPU checks, not an Amiga capture or an embedded editor.

Whole-source compilation now stops at slot-1 Music `$0058`, original line 992,
byte 54202. Three of 194 encodings remain unrecognized: Music, Mvolume and
Music Off. Roller II's end tunes use AMOS Music banks, requiring their decoder/
player and lifecycle integration; the existing MOD tracker does not provide it.
