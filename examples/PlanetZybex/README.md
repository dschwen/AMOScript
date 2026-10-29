# Planet Zybex source and assets

These are unchanged copies of the supplied `Planet_Zybex/` files. The source
comments credit **P.J. Hickman**. `manifest.json` pins the program and all seven
external level banks by size/SHA-256; embedded sprites and Samples remain in the
126,082-byte `Zybex.AMOS`. No source fixes have been applied.

The complete original source now compiles to 1,122 instructions. Running it
unchanged now passes a bounded forty-field input replay per video standard,
including ship movement, real bullet launch and its first explosion.
Separate fixtures play the original Bob 21 and missile programs with manual
Synchro/Update, including Autotest mask collisions and native delay loops.
Three original random hunters also run with explicit beam/coordinate fixtures.
The computed/wide Sprite preview covers all thirteen ship images and row reuse.
Ship J0/J1 and independent Anim lanes now match 178 isolated PAL/NTSC frames.
Longer gameplay, sample-audio verification and the full launcher remain next. See [the showcase milestone](../../docs/planet-zybex.md).

The [live level preview](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex.html)
uses original Load/Unpack excerpts plus a declared Wait Key guard, retaining the
embedded banks. It lets you inspect all seven worlds using WebGL/Canvas scrolling
and fullscreen. It is not a game launcher. A separate declared fixture exercises
the original clear_amal register routine.

Regenerate independent expectations with `python3 tools/reference/packed-picture.py`,
then rebuild pages with `npm run build:demo`. Builds read these pinned files;
they do not automatically import changes from the untracked supplied directory.
Adopt future source/asset versions explicitly and update the manifest/oracles.

[Play the full original game](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex-game.html).
The shared-builder page is tested through firing, five natural life losses,
GAME OVER and a fresh game with keyboard/Gamepad, sound/fullscreen and lifecycle
checks. Later-level completion/progression remains open; see
[full-game acceptance](../../docs/planet-zybex-game.md). All seven supplied banks
are embedded, with unchanged manifest hashes.

The [progression replay](../../docs/planet-zybex-progression.md) now completes
level-1 docking and runs the first 25 vertical level-2 fields with all five lives.
It also verifies the shared AMAL/Basic Y-coordinate correction. Level-2 completion
and later levels/victory remain next; the source and manifest bytes stay unchanged.
