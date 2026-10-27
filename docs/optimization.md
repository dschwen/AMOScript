# Opt-in optimized emission

The compiler can combine consecutive pure scalar assignments into one generated
instruction function. The existing instruction-function table remains the default
and remains available at every original instruction address in optimized modules.

```sh
node bin/amoscript --optimize program.AMOS program.js
node tools/build_game_page.js program.AMOS game.html --optimize
node tools/benchmark_optimizer.js
```

From JavaScript, use `compiler.toModule({ optimize: true })`. The game-page
builder also accepts `{ optimize: true }`; see the
[page-building tutorial](game-webpage-tutorial.md).
The [runnable comparison demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/optimizer.html)
checks optimized and reference execution in the browser.

## Implemented scope

The lowerer marks eligible expressions from their AST structure. Scalar integer,
float and string assignments, scalar Inc/Dec, literals, scalar variables, Param,
unary operations and binary arithmetic/comparisons can qualify. Existing checked
integer, string and FFP helpers still perform every operation in source order.
This does not fold constants, reassociate arithmetic, eliminate stores or change
AMOS rounding/overflow rules.

Function calls, array reads/writes, DATA/file/input operations, display commands,
Add and control flow are barriers. Even pure library calls are conservatively
excluded. Runs split at every label and at 32 instructions; singletons use ordinary
dispatch. Numeric, named and computed branch targets retain original addresses,
as do Gosub and procedure return addresses.

The driver only runs a block when its entire original instruction count fits the
remaining `tick(budget)`. Otherwise it uses ordinary instructions. Each member
sets its own source location and advances IP/ticks only after success. A failure
retains the failing address, preceding stores and normal terminal cleanup. Bob
flushes, cooperative scheduling and waits remain at their original boundaries.

While a Tracker, AMOS Music or palette job is active, the driver uses ordinary
instructions. This preserves the exact per-instruction clock reads, engine
advancement and synchronous host callbacks. An eligible block cannot start a job,
read a host clock, poll input or call a host adapter. Broader batching while these
engines run needs separate evidence; it is not enabled by this option.

Optimized factories expose frozen `program.compilation.optimization` metadata
(static instruction/block counts) and `program.optimization` live counters
(`blocksExecuted`, `instructionsBatched`). Counters count successfully completed
blocks; failed blocks still retain ordinary partial progress in `state.ticks`.
Every factory owns its counters and language state. Reference factories omit this
metadata and the block table.

## Measurements

Run `node tools/benchmark_optimizer.js` to reproduce the local benchmark. It
compiles both paths before timing, alternates their order, discards two warm-up
runs and reports five samples and their medians. Timing includes factory creation
and VM execution, excludes compilation and browser rendering, and uses injected
clocks. Every paired run compares its semantic result. Machine and Node details
are included in the JSON output.

The recorded local Node 18.19.1 run measured a two-million-instruction scalar loop
at 116.36 ms reference versus 63.85 ms optimized (1.82×). Its optimized path
batched 1,838,678 instructions. The complete Roller II source provided 59 blocks
covering 169 of 2,535 instructions, but its current input-only replay executed
only one two-instruction block: ongoing music/fades keep the remaining candidates
on the reference path. Its median was 240.87 ms reference versus 251.23 ms
optimized; these noisy timings do **not** establish a Roller II speedup. See the
[recorded samples and machine details](benchmarks/optimizer-node18.json).

Optimized modules include both paths, so they grow: in that run the scalar module
increased from 301,466 to 303,827 bytes, and Roller II from 796,817 to 820,959
bytes. These figures include the embedded runtime, rather than minified payloads.
The default remains unoptimized. These are local Node measurements, not browser,
GPU, native Amiga or cross-version performance claims.

## Verification and remaining work

Differential tests cover instruction budgets down to one, bounded long runs,
integer/string/float values, arrays and query barriers, labels, procedures and
DATA through existing Test7/14/21/26/27, sleep/key waits, active palette clock
reads, factory isolation and a failure in the middle of a block. The full current
Roller II input-only replay compares milestone state and audio commands through
the level-3 bonus, timeout, scores/menu and a fresh game. A shared browser scenario
compares nine budgets and is published in the demo gallery.

Remaining opportunities include pure library-call classification, ranged Add,
For/Next setup, compact shared code emission, and profiling real games in browsers.
Batching while music/fades run must preserve clock/host-hook behavior and budget
boundaries before it can be considered. General dead-code, common-expression or
control-flow optimization is outside this first implementation.

Local validation: `npm run check` passed 745 tests, and `npm run test:browser`
passed all 58 offline gallery scenarios plus the rendering/input/lifecycle checks.
The focused differential suite also passed after strengthening array snapshots.
