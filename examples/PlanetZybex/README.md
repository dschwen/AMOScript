# Planet Zybex source and assets

These are unchanged copies of the supplied `Planet_Zybex/` files. The source
comments credit **P.J. Hickman**. `manifest.json` pins the program and all seven
external level banks by size/SHA-256; embedded sprites and Samples remain in the
126,082-byte `Zybex.AMOS`. No source fixes have been applied.

The complete original source now compiles to 1,122 instructions. Running it
unchanged now passes level setup and Sprite 15 creation, reaching the ship AMAL
input function at original line 1142, byte 54290, character 37.
Separate fixtures play the original Bob 21 and missile programs with manual
Synchro/Update, including Autotest mask collisions and native delay loops.
Three original random hunters also run with explicit beam/coordinate fixtures.
The computed/wide Sprite preview covers all thirteen ship images and row reuse.
Wider AMAL grammar, ship input and animation lanes still block full gameplay. See [the showcase milestone](../../docs/planet-zybex.md).

The [live level preview](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex.html)
uses original Load/Unpack excerpts plus a declared Wait Key guard, retaining the
embedded banks. It lets you inspect all seven worlds using WebGL/Canvas scrolling
and fullscreen. It is not a game launcher. A separate declared fixture exercises
the original clear_amal register routine.

Regenerate independent expectations with `python3 tools/reference/packed-picture.py`,
then rebuild pages with `npm run build:demo`. Builds read these pinned files;
they do not automatically import changes from the untracked supplied directory.
Adopt future source/asset versions explicitly and update the manifest/oracles.
