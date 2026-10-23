# Startup directives and VBL timer

The initial executable Wonderland slice covered the original first nine physical
lines, including its 20,001-iteration speed test and both resulting `a3000` values,
running unchanged in standalone JavaScript. That nine-line regression remains;
the shared browser demo now executes the first fifteen lines through original
sample-bank loading and setup. See [audio support](audio.md). These startup
fixtures are not shortened playable versions of the game.

## Set Buffer

Original token `$04fe` takes a decimal integer literal (`$003e`), not a runtime
expression. The original verifier's `VerSBu` multiplies the unsigned low word by
1,024, reserves variable/string memory and restarts verification; compiled `CSBuf`
records the request. AMOScript accepts this directive once, as the first
non-comment top-level statement. Later, repeated, nested and expression forms
reject with source locations. This is a narrower placement subset than AMOS.

The request is preserved in frozen `program.compilation.variableBufferBytes`;
absent requests are `null`. For Wonderland it is 10,240 bytes. JavaScript variables,
arrays and strings continue to use their existing storage. This does **not**
emulate the AMOS shared variable/string heap, garbage collection, or out-of-memory
boundary. Metadata is not an allocated buffer or an execution instruction.

## Timer

Original token `$12ce` has signature `V0`: it is both an integer-valued expression
and an assignable special variable. `InTimer` writes a longword; `FnTimer` reads it
as an integer, and VBL increments it. AMOScript supports `Timer=expression` and
bare `Timer`, including typed storage, arrays and procedure results. Assignment
uses the same numeric-to-integer conversion as integer variables. Parenthesized
argument forms and string assignments reject.

Each factory has an independent counter initially zero. The driver derives ticks
from elapsed milliseconds supplied by `options.now`, using `options.vblHz`
(default 50). Assignments change the counter without resetting the VBL phase.
Read/write values wrap as signed 32-bit integers. `program.timer()` and
`program.setTimer(value)` expose the same operations to hosts/tests.

Execution budgets, requestAnimationFrame and `sleepScale` do not advance or scale
Timer. It continues while execution is stopped or waiting. An injected clock must
be finite and monotonic; `setTimeout`, `clearTimeout` and `now` should be injected
together. This models nominal VBL counting, not Amiga interrupt delivery or a
wall-clock value shared between independently created program factories.

## Host system commands

`Amos Lock` (`$24e0`) brings AMOS forward and sets its no-flip flag in the original
handler. `Close Editor` (`$171a`) requests closing the AMOS editor; the original
standalone CLI entry has no editor work. In AMOScript these commands update
`program.state.system` and optionally call a synchronous host adapter:

```js
const program = create({
  system: {
    command(name) {
      // Handle 'Amos Lock' or 'Close Editor' in an embedding application.
    }
  }
});
```

Default system state is `{ amosLocked: false, amosFront: true, editorOpen: false }`.
Lock sets `amosLocked` and `amosFront` true; closing sets `editorOpen` false.
Standalone Node/browser hosts have no AMOS editor or Workbench to close/switch.
These logical state changes do not lock browser navigation or intercept operating
system shortcuts. Embedders supply their own UI behavior through the adapter.
Invalid adapters, promise-returning commands and host errors halt execution with
source context; logical state commits only after a synchronous call succeeds.

## Evidence and verification

[`wonderland-startup.json`](../test/fixtures/conformance/wonderland-startup.json)
contains independently assembled original token bytes, expected values and pinned
source links to `VerSBu`, `InTimer`/`FnTimer`, `InAmosLock` and the CLI editor entry.
The runtime timer also follows the pinned VBL source's `VblTimer++` in
[`src/w/vbl.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/w/vbl.cpp).
These expectations are source analysis, not AMOS execution captures.

Tests execute generated modules without `require`, checking VBL boundaries,
assignment phase, signed wrap, factory isolation, Stop, 50/60 Hz, typed values,
invalid forms and adapter failures. The
[Wonderland demo](../demos/wonderland.html) executes the exact fifteen-line original
prefix under two fake-clock schedules and displays both benchmark outcomes,
alongside the four independently checked image assets and remaining blockers.
