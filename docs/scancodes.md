# Scancode and browser keyboard events

Bare integer `Scancode` (`$1262`) returns the raw code saved by the last successful
`Inkey$`, then clears that code. A second read returns zero. An empty `Inkey$`
leaves the saved code intact; consuming an ordinary text-only key replaces it
with zero. `Clear Key` discards queued entries without changing that saved code.
`Wait Key` consumes its event without updating the last-Inkey latch.

These distinctions matter in Wonderland: original lines 130–132 read
`Lower$(Inkey$)`, then Scancode, then Clear Key. Its Escape branch tests code 69;
the editor also uses arrow codes 76–79. This is a consumed-event latch, independent
of [held joystick state](joysticks.md).

## Host injection

The generated program and AMOS browser facade accept optional scan metadata:

```js
program.sendKey('\x1b', 0x45); // Queue Escape with its raw code.
program.inputValue('Inkey$'); // "\x1b"
program.inputValue('Scancode'); // 69
program.inputValue('Scancode'); // 0
```

Existing `sendKey(text)` calls keep their text-only behavior, including legacy
Wait Key wakeups. Supplying a scan code requires an integer 0–127 and exactly one
Latin-1 character, including NUL for supported nonprinting keys. Invalid raw
injection rejects explicitly. Each factory owns its queue and saved scan byte.
`state.input.keys` remains diagnostic state: legacy entries are strings; raw
entries carry `{ key, scanCode }`. Hosts should inject through sendKey.

Ordinary Put Key text has scan zero. Encoded Chr$(1) packets reject explicitly;
Scan$, Scanshift, Key Shift, Key State and the full original Put Key comment,
capacity and conversion grammar remain separate work. This slice does not claim
an emulated Amiga keyboard device or a complete keymap library.

## Browser translation and cleanup

The Canvas adapter maps physical `KeyboardEvent.code` positions using a bounded
US-style Amiga layout, while ordinary character text comes from `event.key`.
Shifted text therefore retains its physical raw code. Common alphanumeric rows,
punctuation, keypad positions, F1–F10, arrows and the available editing keys are
mapped. Return and keypad Enter have distinct raw codes 68 and 67. Unsupported
physical codes return null from exported `amigaScanCode(code)`; otherwise accepted
text without a mapping has scan zero. Modifier-only keys do not enqueue input.

The original AMOS input handler provides arrow characters `$1e/$1f/$1c/$1d` and
NUL characters for function keys, Delete and Help. The adapter follows those AMOS
values, which differ from console-device escape strings. Composition/dead-key
sequences and non-Latin-1 characters are ignored. Ctrl/Alt/Meta shortcuts retain
browser ownership. Regional keymap conversion, function-key macro strings and
shift-qualifier queries remain open.

Key Speed repeats retain the initial character and raw code, using its existing
controlled clock and native duplicate suppression. Before Key Speed, native
browser repeats retain their existing behavior. Keyup cancels repeats without
clearing a consumed scan latch. Keys consumed by joystick mapping do not enter
the text/raw FIFO; `keyboard.consume:false` allows both paths.

Stop, termination and failure clear saved and queued scan metadata. Browser blur,
window blur, document hiding, modifier shortcuts and detach also clear metadata
and cancel owned repeats. Queued characters retain the existing text FIFO contract;
cleared raw entries become text-only. The host helper `clearScanCodes()` performs
that metadata cleanup; it is intentionally different from language Clear Key.
Changing Key Speed retains saved/queued codes and held joystick state. Browser
keydown while stopped/halted does not enqueue input. Resume requires a fresh press
for repeating input.

## Wonderland evidence and checks

The [Scancode demo](../demos/scancodes.html) runs original physical lines 130–135
(input, Clear Key and Escape branch), plus the unchanged title routine at 49–64.
Synthetic screens/masks, bgon and an initial VBL make input injection reproducible;
path markers and Wait Key guards stop before menu/game/editor loops. Escape closes
both screens and enters the original title routine. Canvas output matches the
independent title PNG. Arrow and shifted-letter cases retain the original scan
value and take the non-Escape continuation. Captions on those frames are synthetic.
A separate live compiled loop reads Inkey$/Scancode with Stop/Resume/Clear controls.

Semantics follow pinned [`src/lib/keyboard.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/lib/keyboard.cpp),
[`src/w/keyboard.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/w/keyboard.cpp)
and [`src/w/input.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/w/input.cpp).
Raw positions are checked against the primary
[AmigaOS keymap documentation](https://wiki.amigaos.net/wiki/Keymap_Library).
These are source-derived and injected browser checks, not an Amiga keyboard capture.

Seven execution groups, an independent-byte conformance case and the facade
integration cover destructive reads, FIFO pairing, types/DATA/procedures, waits,
cleanup, diagnostics, mappings and original routing. Chromium also exercises the
live page using real browser keyboard events. All browser scenarios remain
standalone repository demos with HTML Preview links.

The full program now first encounters Fsel$ `$196C` on line 709, byte 29596.
One encoding remains unrecognized, appearing once; see
[Wonderland's milestone](wonderland.md).
