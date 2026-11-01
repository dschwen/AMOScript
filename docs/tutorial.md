# AMOS Tutorial collection

[Open the Tutorial catalogue](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/tutorial.html).

The repository pins the original programs and their assets under
`examples/Tutorial`. The uploaded `Tutorial` directory is left untouched.
The catalogue includes all 43 native program files: 39 current tutorial programs,
two Multi_Rainbows versions and two ReTokenise editor-accessory versions. Each
entry links to a local page and HTML Preview. Versioned backups are detected by
AMOS headers, rather than being lost through an `.AMOS` extension filter.

## Rebuilding

```sh
npm run build:demo
npm run check:generated
```

This regenerates the Tutorial pages alongside the other repository demos. The
manifest records each program's size, SHA-256, compilation status and diagnostic.
A standalone build with separate JavaScript modules is also available:

```sh
npm run build:tutorial -- examples/Tutorial /tmp/amos-tutorial
```

Open `/tmp/amos-tutorial/index.html` through a local HTTP server. This command
writes all pages and the manifest, then exits nonzero if any program fails to
compile. A blocked program gets a diagnostic page; it is not a working demo.
The repository-wide generated check verifies that these diagnostics remain up
to date, without treating an acknowledged blocker as a new build failure.

Playable development pages use the shared game-page harness with audio,
fullscreen, keyboard modes and debug errors/downloads. Original asset paths such
as `AMOSPro_Tutorial:Objects/bobs.abk` resolve to preloaded bytes. Writes are
session-local. Original source programs are not rewritten to bypass commands.
Compilation is separate from completing a tutorial's execution.

## Implementation status and next work

All 21 core tutorial files currently compile. See the generated manifest for exact,
source-located blockers. The remaining work groups are:

1. Menus: `Menu$` trees, Choice polling, menu events, placement/shortcuts and
   Menu bank serialization (nine programs).
2. Interface: resource-bank graphics, the dialogue language, modal/cooperative
   Dialog Box execution, editing/list/slider zones and variable communication
   (nine programs). Expressions must never receive a Promise or replay effects
   while waiting for a requester.
3. User copper lists and checked Cop Logic memory (the two Multi_Rainbows files).
4. ReTokenise: editor/accessory services require a genuine editor host boundary;
   they cannot be implemented by pretending a standalone browser is the AMOS
   editor.

The [menu implementation notes](menus.md) describe the checked native bank
codec, graphical command streams and relative layout now covered by unit tests.
Compiler, driver and browser input integration remains necessary before any of
the nine menu programs can be promoted from its diagnostic page.

The first compatibility additions accept the supplied Basic v1.34 and spaced
Pro v1.00 headers while preserving binary bounds validation; handle uncached
statement overloads, computed DATA Restore, On Proc, Trap/Error/Resume Next and
Direct; and add bounded tutorial drawing/text controls. Appear follows the
native stride/count traversal and common-plane copy, including live aliasing.
Patterns use the original mouse resource's 35 pattern records. Ellipse and text
borders use portable rasterization; they are not claims of native pixel parity.
Err$ reports the actual portable runtime diagnostic after Trap; the native
AMOS numbered message catalogue is not yet supplied.

## Core tutorial coverage

The core builds include all seven AMAL examples, collision detection, Fade and
Iff_Animation. Supported additions include local Amreg access, Chanmv, Amplay
speed/direction through native local R0/R1, K1/K2 mouse buttons, Rainbow channels
and pattern strings, ranged mixed collisions, counted Cline, masked Fade To,
hires circles, Shoot and Bell note overloads.

The complete Iff_Animation source runs all 97 supplied frames to its original
Edit instruction using only mouse input and a VBL clock. Independent Python
ByteRun1/delta decoding checks every indexed frame and delay. Frame Length is
nondestructive and reports the owned raw-bank payload size (not an Amiga heap
allocation measurement). Frame commands ignore unused cycling metadata; normal
Load Iff retains its existing strict CRNG/DRNG checks.

Shoot uses the shared noise engine with its own native notes and envelope.
Independent Python/Fraction PAL, NTSC and fractional-onset vectors verify the
finite PCM prefix. As with Boom, exact DMA/interrupt tails and Amiga captures
remain open. Bell note playback follows the native octave sample lengths and
period clamp.
