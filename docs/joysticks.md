# Joystick input: keyboard and Gamepad API

AMOS `Joy`, `Jup`, `Jdown`, `Jleft`, `Jright` and `Fire` now share per-factory
input state. Original token offsets are `$11f8`, `$1202`, `$120c`, `$1218`, `$1224`
and `$1232`. Ports are 0 and 1. Joy returns bits up=1, down=2, left=4, right=8,
fire=16; individual queries return -1 when pressed, otherwise zero. Port/type
validation and numeric conversions use the same compiler/runtime helpers as
other integer functions.

## Browser configuration

Mappings are optional host settings; existing Canvas hosts remain unchanged when
`joysticks` is omitted. Configure each port independently with keyboard, gamepad,
or both. These options belong to `createCanvasHost`, not the generated factory:

```js
const host = AMOS_BROWSER.createCanvasHost(canvas, {
  joysticks: [{ port: 1, keyboard: true, gamepad: true }]
});
host.attach(program);
host.focus();
```

`keyboard: true` uses ArrowUp/Down/Left/Right and Space/Enter for fire.
Bindings use physical `KeyboardEvent.code` names. A custom object overrides
selected defaults; each action accepts one code or an array, and `[]` disables it:

```js
host.configureJoysticks([{
  port: 1,
  keyboard: {
    up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
    fire: ['Space', 'Enter', 'KeyZ']
  },
  gamepad: { index: 0, deadZone: 0.25 }
}]);
```

Mapped keys are consumed, keeping Inkey$/Wait Key and text repeat independent.
Set `keyboard.consume: false` for intentional text-input passthrough. Joystick
state is held-level input, unaffected by native key repeat or Key Speed. Opposed
directions in the combined keyboard/gamepad mask neutralize each other; fire is
retained. Keyboard and gamepad contributions otherwise combine with bitwise OR.
At most one configuration per port is accepted. Passing `[]` disables both host
mappings and releases their state.

## Gamepad mapping and polling

`gamepad: true` means index 0, standard mapping, axes 0/1, D-pad buttons 12–15,
primary button 0 for fire and dead zone 0.25. Axes must exceed the dead zone to
activate a direction. A different gamepad index can drive each port. Nullable
axis/button indices disable individual inputs. Unmapped/raw devices require an
explicit layout choice:

```js
host.configureJoysticks([{
  port: 0,
  gamepad: {
    index: 1, standardOnly: false, deadZone: 0.2,
    axes: { x: 0, y: 1 },
    buttons: { up: null, down: null, left: null, right: null, fire: 2 }
  }
}]);
```

The default mapping and browser exposure rules follow the
[Gamepad specification](https://www.w3.org/TR/gamepad/). Browser access requires a
suitable secure context and may be restricted by embedding policy; a browser may
withhold devices until controller interaction. The host handles unavailable,
blocked, disconnected and unmapped devices as neutral gamepad input. Keyboard
input remains usable when enabled alongside it.

Joystick queries poll the current Gamepad API state through the host reader;
they do not wait for requestAnimationFrame or advance AMOS time. The host also
exposes `pollJoysticks()` and copied diagnostic `joystickStatus()` entries, with
port, combined mask, keyboard/gamepad masks and status. No polling timer or device
identifier log is created. Tests can inject `getGamepads()` and `hasFocus()`.

## Lifecycle and headless runtime

Browser controls are scoped to the focused Canvas. Keyup, blur/window blur,
hidden documents, Stop, termination, failure, detach and mapping changes release
held keyboard state. Native repeat events cannot re-latch a released mapped key.
Resume needs a new keyboard press; a physically held gamepad is sampled again
when the focused program next queries it. Disconnection clears the gamepad
contribution on the next poll. Key Speed changes only text-repeat settings.

Node tests and other adapters can inject `program.setJoystick(port, mask)` with
mask 0–31. `program.setJoystickReader(fn)` installs a synchronous reader returning
a mask or null for an unowned port, and returns an ownership-checked unsubscribe.
Invalid reader masks halt with source context. Browser detach releases owned
ports and unbinds its reader. Ports without a Canvas mapping retain explicit host
injection. Program Stop/termination clears both runtime ports.

## Original menu fixture and evidence

The [interactive menu demo](../demos/wonderland-menu.html) executes original
Wonderland lines 1–71 plus original menu subroutines 732–753. One explicit End
between the loop and subroutines stops after Start Game/Level Editor selection,
before unsupported dispatch. Selected original line bytes and embedded banks
are copied unchanged; the code-length header is recomputed for those ranges and
the End guard. This is a declared test fixture,
not whole-program compilation or a replacement JavaScript menu.

The live demo provides keyboard/WASD presets, Gamepad API/both modes, controller
index, dead zone and Restart/Stop/Resume controls. Automated browser checks replay
five original animated moves, background toggling and both selections through
keyboard and injected gamepad records, then operate the real live keyboard UI.
Headless tests cover typed scalars, arrays, DATA, procedure results, masks, reader
ownership and isolation. An [independent-byte fixture](../test/fixtures/conformance/joystick-queries.json)
pins original offsets and source links to the original joystick handlers.

Evidence is source analysis, injected input and Chromium's native API availability
path. A physical controller and real Amiga execution have not been captured.
The unmodified complete game still fails at Scancode on line 131. See
[the milestone](wonderland.md). The
[HTML Preview menu](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/wonderland-menu.html)
is linked from the shared [demo index](../demos/index.html).
