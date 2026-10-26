# Original Roller II game input loop

The [input demo](../demos/roller2-input.html) retains the connected original
startup/menu, ready prompt and ball/fade/border setup. It now includes unchanged
JOAB 619–639: joystick priority/direction multipliers, deadline checks, Inkey$,
Key State(95), Scancode, effect/music toggles, countdown printing and idle sprite
commands. Named movement, pause, input-pause and game-over destinations are
synthetic outcome/Wait Key guards. Movement stops before BEWEG 641; no sprite or
tile movement is inferred from selecting a direction. Earlier menu, ready-only
and ball fixtures retain their post-600, post-608 and post-617 guards.

The harness selects Game and releases the menu input. Original mouse/Fire input
starts the ball, and subsequent input executes the original loop. There are no
variable/IP edits to advance it. Escape follows original 631, including FDZ,
screen closure, rainbow adjustment and the original title/menu entry. Effects
and music keys clear the source's Inkey$ variable after each toggle; music Stop/
Play/Loop state is retained. The demo does not attach a Web Audio adapter, so its
music sequencing is silent. Other selected menu routines still have guards.

Help is a held-key query independent of text and the destructive Scancode latch.
At the original starting score 0, Help alone does not pass the `HI>0` pause gate.
The source's space-key pause selects its declared guard. Full pause handlers,
positive-score pause replays and timeout/game-over execution remain outside this
fixture's tested replay bounds. The idle loop has no Wait: the instruction-function
runner's existing finite budgets yield cooperatively while VBL timing remains
independent of requestAnimationFrame. This is not a native busy-loop speed claim.

## Unverified source forms

These lines contain integer identifier tokens after some named Goto instructions,
rather than preverified label-reference tokens. Pinned native `src/verif/tables.cpp`
label_or_expression converts such a standalone identifier into a label; the parser
now builds the same named-target AST. Ordinary scoped label resolution still
validates every static destination. Numeric expression branches remain gated; main
ASCII string expressions now have [bounded lookup support](string-branches.md).
A standalone uncached named label does not read a variable value.

Original deadline checks also use slot-1 Sam Play base offset `0x00de` with an
unverified parameter-count cache of zero and two arguments. Native
`src/verif/handlers.cpp` extension and `src/verif/expr.cpp` instruction/compare
select an overload from its supplied argument signature. The parser now supports
only that unverified Sam Play family with 1, 2 or 3 numeric operands, routing to
the existing checked sample/voice/frequency operations. It retains original
extension metadata and source location. Explicit cached overloads keep their
existing arities; unknown families, extra/missing arguments and wrong types
reject. This is bounded verifier normalization, not general overload recovery.
All references use revision `7f32e0abe1b6b415c9502b598cd3e4cb131018f8`.

## Evidence and next gates

`tools/reference/roller2_ball.py` adds an independent idle PNG to its raw
AmIc/AmSp/AmBk composition. Only the original countdown row changes: at controlled
5400 ms, Timer is 1 and integer `(35*50-1)/50` prints 34. Its extra glyph 3 is
extracted from the same upstream public-domain font8x8 header, verified against
the recorded SHA-256. These are portable-font, asset/source expectations, not
native Topaz pixels or external execution captures.

Headless checks verify the idle PNG/map/ball, all four joystick directions and
up/down/left/right branch priority, both music/effect toggle directions, guarded
Space and original Escape title return. Key State and unverified token forms
have separate literal/typed/lifecycle/validation tests. Browser replay uses four
input paths, twenty-four Canvas images and six actual WebGL comparisons, with
CPU presentation disabled for GPU execution. Consumed physical arrows retain
held raw state; Gamepad axes select an original joystick direction. The live page
retains fullscreen, Stop/Resume and Restart. Escape first exits fullscreen; a
later Escape reaches AMOS. The gallery links it through HTML Preview, and every
shared browser check remains runnable offline.

A separate [movement fixture](roller2-movement.md) now runs `Goto SAS$(HD)`,
cyclic Add and original floor/stop/Lasttest handlers, stopping before colour effects.
Next extend those actual handler dependencies. Keep
all reached labels checked and add independent trajectory/tile expectations;
do not replace source dispatch with a synthetic floor handler. Full compilation
still stops at Change Mouse (line 439), with eight token encodings unrecognized.
