# AMCAF Smouse Key and extra joystick buttons

AMCAF 1.50beta4 `$158c` now returns an integer mask for the second mouse/joystick
port. Select its extension slot explicitly at compilation. The native R0ab
routine at `$472a` reads CIA bit 7 and POTINP bits 6/4 after configuring POTGO.
The portable adapter preserves the three resulting held-button bits:

| Mask bit | Meaning | Shared input |
| --- | --- | --- |
| 1 | Primary fire / left button | Joystick port 1's ordinary Fire bit |
| 2 | Secondary fire / right button | Optional second-port button input |
| 4 | Third fire / middle button | Optional second-port button input |

The query is nondestructive. It does not use the main mouse's button mask, consume
Mouse Click edges or text, alter Scancode/Key State, or modify coordinates. It
polls the existing synchronous joystick reader, independently of rAF, before
combining the second-port held inputs. There is no POTGO/register emulation or
native input capture claim.

## Portable runtime API

`program.setPortButtons(port, mask)` accepts ports 0/1 and three-bit masks 0..7.
`program.portButtons(port)` queries those portable joystick-host button lines;
`Smouse Key` always queries port 1. These host controls do not alias the main
mouse interface, even for port 0.

Primary fire is shared: a portButtons primary hold contributes bit 16 to Joy,
and an ordinary joystick Fire hold contributes bit 1 to portButtons/Smouse Key.
Independent holds are merged, so releasing one API's input does not release the
other's hold. Joy's existing five-bit contract remains unchanged: secondary and
third buttons never appear as high Joy bits. Existing numeric joystick readers
retain their signature and validation; a custom reader may update portButtons
synchronously before returning its ordinary five-bit mask.

Each VM owns separate holds. Stop, End and failure clear them with other input;
Key Speed and Clear Key preserve physical holds. Direct setters validate before
mutation. As with existing input setters, the host owns the lifetime of injected
holds and the freshness of its optional reader.

## Browser mapping

Joystick configurations may optionally add `fire2` and `fire3` bindings:

```js
joysticks: [{
  port: 1,
  keyboard: { fire: ['Space', 'Enter'], fire2: ['ShiftLeft', 'ShiftRight'] },
  gamepad: { buttons: { fire: 0, fire2: 1, fire3: 2 } }
}]
```

Secondary/third bindings default to empty/null, so existing keyboard/gamepad
configurations and diagnostic entry shapes remain unchanged. An extended entry
adds a `buttons` mask; its `mask`, `keyboard` and `gamepad` fields remain five-bit
values. Keyboard and gamepad holds combine before direction cancellation.
Virtual touch fire contributes only to primary fire.

The Canvas host polls both masks together and clears its configured ports on
blur, visibility loss, Stop, reconfiguration and detach. Key Speed preserves
those holds. Secondary keys are consumed only when explicitly mapped and the
keyboard mapping's existing consume policy permits it. No AMOS text, raw key or
mouse click is synthesized for gamepad input.

For pages built with an AMCAF profile, the application harness supplies secondary
fire on Shift and gamepad button 1 (the standard right face button). Gamepad
button 2 supplies third fire; there is no default third-fire keyboard binding.
Typing mode releases/disables keyboard joystick mappings while gamepad buttons
remain available. Normal pages without an AMCAF profile keep their old mappings.
The compiler runtime itself chooses no keyboard or browser device policy.

## Evidence and target status

`test/smouse-key.test.js` checks exact masks, shared primary fire, main-mouse/text
isolation, remapped extension slots, synchronous reader polling, factory ownership,
reset semantics and opt-in mapping behavior. The [browser demo](../demos/smouse-key.html)
runs a compiled AMOS loop and lets users test keyboard/gamepad buttons, Typing
mode, Stop/Resume, Restart and Key Speed. Browser checks inject a standard-mapped
pad and also verify the default mapping in the generated AMCAF application page.
These are portable/source-derived checks, not Amiga or physical-gamepad captures.

The private Ghostlight build now passes Smouse Key. Its next compile blocker is
Pt Sam Stop, slot 8 `$1400`, at line 1907, byte 65406. Pt Raw Play and Pt Sam Bank
also remain unimplemented; original interlaced atlas presentation and full game
execution remain open. The external project's build report is updated in
`/home/daniel/Programs/ghostlight-browser/dist/`; no source/assets or compiled game
are added to AMOScript.
