# Device keyboard input

The application pages now have a **⌨** button. Tap it to focus a real HTML text
field, which lets a phone or tablet open its normal keyboard. Type normally;
characters are sent immediately to the running AMOS program. **↵** sends Enter,
**⌫** sends Backspace and **×** dismisses the field and returns focus to the game.

This works with `Inkey$`, `Wait Key` and `Input`. It uses the existing `sendKey`
interface; the compiler and AMOS program need no changes. Text typed here bypasses
keyboard joystick mappings, so Z and Enter reach AMOS even if those physical keys
are configured as fire. It does not synthesize held keys, joystick masks or mouse
clicks. Physical special keys in the field retain the Canvas host's character/raw
scan-code convention; ordinary committed text has no invented physical-key state.

IME composition is sent once when committed. Decomposed text is normalized to
NFC, including German umlauts. AMOS accepts byte characters (Latin-1); unsupported
characters are skipped with a status message. Paste is handled as committed text.
The field disables autocapitalization, autocorrection, spellcheck and autocomplete.

Stop, terminal cleanup, detach, page visibility changes and window blur close the
field and discard unfinished composition. Closing the widget keeps text already
sent to AMOS; it does not erase the program's queue. Resume does not replay text
typed while stopped. Key Speed does not close or clear the field. Restart and
linked-program changes dispose the old widget and create a fresh, closed one.

## Embed it in a host

The shared game-page builder enables the control. Roller II and Wonderland's full
application launchers use it too. Custom harnesses opt in:

```js
const host = AMOS_BROWSER.createCanvasHost(canvas, {
  textInput: {
    container: gameContainer, // Stable element inside the fullscreen container.
    toolbar: controls        // Optional; defaults to container.
  }
});
host.attach(program);
```

`host.detach()` removes the widget and its listeners. Keep the container inside
the fullscreen element so the input remains accessible in fullscreen. Focusing a
field must happen in the user's tap handler; automatically focusing one during
startup is intentionally avoided.

[Interactive browser demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/mobile-keyboard.html).
Checks cover committed text/umlauts, IME completion, Enter metadata, Backspace,
joystick isolation, Stop/Resume, Key Speed and stale input after detach. A mobile
viewport/touch context is also exercised during development. Headless Chromium
can verify focus and event handling; displaying the actual OS keyboard needs a
real phone or tablet.
