# Browser demos

**[Open the gallery through HTML Preview](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/index.html)** or [open it locally](index.html).

## Start here

- [Play Wonderland](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/wonderland-game.html): original game, WebGL/Canvas, fullscreen and optional sound.
- [Play Roller II](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/roller2-game.html): game with the AMOS boundary-check fix and current supplied assets; tested through the level-3 warp, game over, scores, menu return and a fresh game.
- [Watch the tunnel animation](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/tunnel.html): original animation with its supplied external icon bank and IFF background; optionally choose a custom IFF.

The gallery places games first, then animation/music and interactive examples.
Individual command, parser/runtime and graphics verification demos are grouped
under **Compiler and runtime checks**, closed by default. All remain linked and
runnable; the gallery is the complete catalogue.

## Running locally

Open `demos/index.html` in a browser. Each page embeds its scripts and prepared
assets, so no server or network downloads are required. On the full-game pages,
click the large red **Play Game** button to launch directly with sound, fullscreen
and ordinary startup input. **Browser checks and captured frames** is a separate,
collapsed section; its **Run demo** button runs the shared verification.
Other demos retain their Run demo controls. WebGL demos require WebGL2.

HTML Preview links target `master` and reflect committed, pushed files. Prepared
fixtures and missing resources are described on each page; these are not claims
of complete original-game or native Amiga parity.

## Maintaining the gallery

Browser scenarios live in `test/helpers/browserScenarios.js`. Playwright and the
generated pages share their inputs and assertions. Every browser test must retain
a runnable page and an HTML Preview link, including the collapsed technical demos.

```sh
npm run build:demo
npm run check:generated
npm run check
npm run test:browser
```

The generated-artifact gate detects stale program modules, pages and catalogue
entries without writes. Real Chromium tests run every scenario offline and
exercise the live controls, input and host lifecycle. Screenshots are written to
the ignored `test/artifacts/` directory.
