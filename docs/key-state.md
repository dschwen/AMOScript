# Held raw keys

`Key State(code)` uses original token `0x11d8`, returns integer -1 while a raw
key is held and 0 otherwise, and does not consume input. The numeric argument uses
the shared integer conversion and must then be 0–127. Negative/out-of-range codes
fail with source context. Native `src/lib/keyboard.cpp` validates this range;
`src/w/keyboard.cpp` ClInst reads the bit without consuming it. These references
are pinned to AMOS-Professional-Official revision
`7f32e0abe1b6b415c9502b598cd3e4cb131018f8`.

Each factory owns a 128-entry raw-state array. Hosts may inject it with
`program.setKeyState(code, boolean)` and clear it with `clearKeyStates()`.
Injection validates exact integer codes and booleans. It does not enqueue text,
change the Scancode latch or wake Wait Key. Conversely, sendKey/Put Key and their
prepared raw metadata do not pretend a physical key is held. Clear Key drains the
text queue; clearScanCodes clears metadata; neither clears held keys. Key Speed
changes repeat configuration without clearing physical state. Stop, End and
runtime failure clear the per-program held map; Resume does not restore keys.

Canvas records mapped physical keydown/keyup independently of character conversion
and joystick consumption. Multiple held keys coexist, including a joystick-bound
arrow whose text is consumed. Keyup releases only its raw code. A repeat event
cannot recreate state after blur or Stop. Canvas/window blur, hidden documents,
shortcut interception and detach release that host's owned keys. Detaching a host
leaves independently injected raw codes alone. Driver lifecycle resets clear all
program state and the host's ownership list. Gamepad input changes joystick state,
not keyboard Key State bits. Keyboard queries remain independent of animation.

The existing physical-code map covers basic keys, navigation, numeric keypad,
function keys and Help (95); F10 remains 89. Browser modifier raw codes and Key
Shift are not implemented. Existing composition/dead-key and Ctrl/Alt/Meta
shortcut handling is retained; shortcuts clear owned input. This is a bounded
browser mapping, not an OS-wide keyboard hook or Amiga hardware capture.

Four headless groups use the literal opcode, all 128 positions, typed DATA,
arrays/scalars/procedure results, independent factories, queue/latch separation,
repeat configuration, lifecycle cleanup and source errors. The shared
[scancode demo](../demos/scancodes.html) adds seven held-key browser groups and a
live physical-key readout. The [Roller II input demo](roller2-input.md) executes
the original Key State(95) query and confirms consumed arrow keys still report
held raw state while the original joystick branch chooses its direction.
