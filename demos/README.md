# Browser test demos

Open [the local gallery](index.html) or
[the gallery through HTML Preview](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/index.html).
Preview links target the repository's `master` branch and become available when
the generated files are committed and pushed there.

Every current browser scenario is included:

| Demo | HTML Preview |
| --- | --- |
| [AMOS keyboard repeat and lifecycle cleanup](key-repeat.html) | [Run](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/key-repeat.html) |
| [Wonderland sample playback and Web Audio checks](music.html) | [Run](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/music.html) |
| [Wonderland original startup benchmark, assets and readiness (game not running)](wonderland.html) | [Run](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/wonderland.html) |
| [Integer GPU readback and PNG decode](webgl-integers.html) | [Run](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/webgl-integers.html) |
| [GPU uploads, dirty rows and context lifecycle](webgl-resources.html) | [Run](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/webgl-resources.html) |
| [GPU/CPU image, mode, sprite, scaling and seeded-frame gallery](webgl-renderer.html) | [Run](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/webgl-renderer.html) |
| [Sprite DMA and channel reuse](sprite-dma.html) | [Run](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/sprite-dma.html) |
| [Trigonometry and angle modes](trigonometry.html) | [Run](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/trigonometry.html) |
| [Extra Half Brite](ehb.html) | [Run](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/ehb.html) |
| [HAM6](ham.html) | [Run](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/ham.html) |
| [Direct sprites and manual updates](sprites.html) | [Run](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/sprites.html) |
| [Bank operations, buffers and Bob backgrounds](banks.html) | [Run](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/banks.html) |
| [Interactive control flow, graphics, Bobs, input and lifecycle](programs.html) | [Run](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/programs.html) |

Each HTML file embeds its runtime, shader factories, compiled programs and fixture
data. Open it directly from disk or through HTML Preview; no Node process, local
server, CDN scripts or fixture fetches are needed. WebGL scenarios require WebGL2
and the context-loss extension used by their tests. Results show failures explicitly.

Click **Run demo** for a scenario's actual browser-test evaluator and assertions.
Use the frame selector and pixel zoom to inspect captured images, including all GPU comparison
frames. The interactive page has Run/Graphics/Moving Bobs/Stop buttons; focus the
canvas and use the keyboard/mouse. Its live state display helps inspect input and
wait/stop behavior. Those three programs remain interactive rather than being
replaced by prerecorded images.

`test/helpers/browserScenarios.js` is shared by Playwright and the generator.
`tools/build_browser_demos.js` captures browser evaluators and their prepared
arguments at build time; it does not run a browser while building. The generated
`manifest.json` inventories the pages. Add new browser scenarios to that catalogue
so they acquire a demo and coverage automatically.

Run `npm run build:demo` to rebuild the three program modules and all gallery
pages. `npm run check:generated` checks both sets without writes; `npm run check`
also tests catalogue coverage, inline script syntax and missing/stale detection.
`npm run test:browser` runs the scenarios and every standalone page offline in
real Chromium, then exercises the interactive page's input/lifecycle behavior.
These demos expose current tested behavior; they do not imply full AMOS support,
hardware captures or GPU performance on other devices.
