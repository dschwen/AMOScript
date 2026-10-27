# Browser fullscreen displays

The live [Wonderland game](../demos/wonderland-game.html), [main examples](../index.html)
and every visual gallery page now have a Fullscreen button. Click it to enter;
the same button becomes Exit fullscreen. Escape leaves fullscreen before reaching
AMOS input. A subsequent Escape outside fullscreen retains the game's normal
return-to-title behavior.

The fullscreen target is a stable container with controls and a display surface.
It contains either a Canvas 2D or WebGL canvas. In the live game, switching
renderers or restarting replaces the canvas while retaining that container, so
fullscreen remains active. Game, audio and error status remain visible inside it.

`lib/amos/fullscreen.js` exports `createFullscreenHost(container, options)` via
CommonJS and the `AMOS_FULLSCREEN` browser global. Options provide a button,
status element, display `surface`, optional `getContent()` and an ownership-change
callback. The returned controller has `toggle`, `refresh`, `status` and asynchronous
`dispose` methods. Call toggle from a user action; the request is issued before
any await. Disposal removes listeners/observers, restores ordinary dimensions and
exits only this controller's fullscreen container, including a late request that
resolves during disposal.

The controller scales CSS dimensions to fit the available surface, preserving
aspect and borders. Space around the display is black; there is no letterbox
inside the canvas. Canvas bitmap dimensions, WebGL buffers, AMOS screen geometry,
VM clocks and sample playback stay unchanged. The existing host therefore maps
pointer positions across the actual canvas content rectangle in either renderer.
Resize and mutation observers refit resized, replaced or newly loaded content.
The live host clears held input and restores canvas focus on its own fullscreen
transitions; unrelated fullscreen containers do not trigger that callback.

The Fullscreen API and frame permission must be available. Unsupported contexts
show a disabled button and an explanatory status. Rejected requests show an error
without failing or pausing the program. Embedded previews may restrict fullscreen;
the same standalone HTML files can be opened directly from the repository.

Verification includes native Chromium entry/exit for the gallery, main examples
and both live renderers; aspect fitting during emulated viewport resize; hardware
pointer mapping; switching and Restart while fullscreen; Escape priority without
leaving gameplay; GPU context loss/restoration; and cleanup while fullscreen.
Four unit groups cover CSS/bitmap separation, unsupported/denied requests, surface
replacement, listener ownership and late request disposal. The browser checks
use the shared gallery and live-demo controls. The optional touch joystick now
has additional 390×844 touch-enabled Chromium coverage, including native pointer
input and fullscreen exit; this is not a physical phone/iOS or Amiga capture.
See [touch input](joysticks.md#optional-fullscreen-touch-cross).
