# Output size and minification

Regular CLI and standalone-page builds omit AMOS line/byte assignments and DATA
source metadata. Runtime error messages and compatibility recommendations remain.
Compilation errors still report source locations. `--debug` retains runtime locations.
Desktop previews always retain debugging; exports follow the Debug checkbox.

Minification is independent of instruction combining (`--optimize`) and Debug.
Terser compresses expressions/removes provably unused local code and shortens local
identifiers. Property names, script globals and recognized license notices are
preserved. No unsafe compression options or property mangling are enabled.
Terser runs at build time only; generated programs remain standalone and do not
download or import it. Compiler distributions include its production dependencies
and license notices. Whole unused runtime subsystems are not yet excluded by a
compiler feature graph.

```sh
node bin/amoscript --minify program.AMOS program.js
node bin/amoscript --debug --minify program.AMOS program-debug.js
node tools/build_game_page.js program.AMOS game.html --minify
```

In the desktop form, select **Advanced → Minify JavaScript for smaller output**.
Saved projects store `options.minify`. The low-level `toModule()` API retains its
historical `debug: true` default; use `toModule({debug:false,minify:true})` for a
compact module. `buildGamePage()` defaults to `debug:false,minify:false`.

## Measured sizes

Measured with Node v24.22.2 and Terser 5.51.2. Sizes below are KiB
(1,024 bytes). Every variant uses the same program and asset files, with
`optimize:false`. JavaScript modules include embedded AMOS banks but exclude the
browser harness and external assets. Complete HTML includes the browser harness
and all declared assets; binary assets are not recompressed or removed.

| Program | Debug JS | Regular JS | Regular + minify JS | JS reduction vs debug |
|---|---:|---:|---:|---:|
| Test21 | 564.2 | 563.8 | 306.9 | 45.6% |
| Graphics | 568.8 | 567.6 | 309.9 | 45.5% |
| Wonderland | 872.4 | 816.2 | 488.0 | 44.1% |
| Roller II | 1052.6 | 938.8 | 549.3 | 47.8% |

| Program | Debug HTML | Regular HTML | Regular + minify HTML | HTML reduction vs debug | Gzip reduction vs debug |
|---|---:|---:|---:|---:|---:|
| Test21 | 686.9 | 686.5 | 384.1 | 44.1% | 30.3% |
| Graphics | 691.5 | 690.3 | 387.1 | 44.0% | 30.3% |
| Wonderland | 1088.3 | 1032.2 | 658.5 | 39.5% | 25.0% |
| Roller II | 1775.7 | 1661.9 | 1226.8 | 30.9% | 14.2% |

Removing diagnostics alone saves 6.4% of Wonderland JS and 10.8% of Roller II JS.
On tiny programs the runtime dominates, so diagnostic stripping alone saves less
than 1%. Minification gives the larger reduction across all four samples.

Gzip figures use level 9 as a transfer-size comparison; the emitted HTML itself
is not gzip encoded and remains directly openable from disk. Compression already
handles repeated source metadata well, so gzip savings are smaller than raw-file
savings. Assets dominate larger pages and limit the benefit of code minification.

Minified full-page generation took approximately 2.2–3.9 seconds in this run,
compared with 2–38 ms without minification. These are single-run build-time
observations, not execution-speed benchmarks. Instruction budgets and Wait
timing are unchanged; CPU-bound programs may still depend on host performance.

## Reproduce

```sh
npm run benchmark:size
node tools/benchmark_size.js --output report.json
```

The [recorded JSON](output-size-benchmark.json) contains exact raw/gzip sizes,
all four debug/minify combinations, source hashes, asset counts/bytes and build
times. The script reads repository-owned fixtures only and writes no game builds.

Tests cover matching program output, optimized blocks, DATA, terminal requests,
structured errors, normal/debug/minified browser pages and desktop/portable
packaging with the production minifier and its dependency closure.
