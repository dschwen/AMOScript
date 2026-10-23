# AMOScript

AMOScript transpiles tokenized AMOS `.AMOS` programs into self-contained
JavaScript modules for Node and browsers. The core language is implemented;
full AMOS/Amiga compatibility is still in progress. See
[compatibility and remaining work](docs/compatibility.md) and [the plan](PLAN.md).

## Compile and run

```sh
npm install
node bin/amoscript examples/Test21.AMOS /tmp/program.js
node -e "require('/tmp/program.js')({ setTimeout }).tick(1000)"
```

Expected output:

```text
Start
One
Two
Three
End
```

Omit the output path to write JavaScript to stdout. Errors go to stderr with a
nonzero exit status; existing output files are never overwritten.
`node bin/amoscript --help` prints usage.

The package entry point exports the compiler:

```js
const fs = require('fs');
const Transpiler = require('amoscript');
const compiler = new Transpiler(fs.readFileSync('program.AMOS'));
fs.writeFileSync('program.js', compiler.toModule());
```

The paired `.Asc` examples describe the programs for humans; ASCII input is not
yet accepted by the compiler. Stored numeric values can differ from the rounded
ASCII references.

## Runtime

```js
const create = require('./program.js');
const program = create({
  setTimeout,
  clearTimeout,
  vblHz: 50,
  sleepScale: 1,
  write: text => process.stdout.write(text)
});
program.tick(1000);
```

`tick(maxSteps)` executes up to the positive integer instruction budget, yielding
on waits. Budget exhaustion schedules a continuation. `stop()` cancels automatic
execution; `resume()` schedules it again, preserving an interrupted sleep's
remaining duration. `sendKey(key)` supplies input for `Wait Key`.

Inject `setTimeout`, `clearTimeout`, and `now` together for deterministic clocks.
`now()` must return milliseconds. `sleepScale: 0` preserves yields with no delay.
Polling `tick()` during a wait does not skip the wait.

`write(text)` receives text with semicolon concatenation, comma tab stops, and
trailing-separator newline suppression. `tabSize` defaults to four characters.
Alternatively, `print(...values)` receives the evaluated values for each `Print`
statement. If neither is supplied, the runtime calls `console.log` per statement.
Numeric text formatting currently uses JavaScript's string conversion.
Integer-to-float promotion uses a 24-bit mantissa, including for mixed-type
comparisons, typed storage and Val results. Floating addition, subtraction,
multiplication, division and For/Next increments use explicit FFP mantissa/range
rules derived from preserved Motorola routines. Val and numeric file input use
the AMOS converter's FFP digit accumulation and scaling. Ln, Exp and power use
source-derived fixed-point CORDIC routines; Pi# uses the stored AMOS constant.
Sin/Cos/Tan also use CORDIC, with per-program Degree/Radian modes.
Abs and Int preserve the argument's integer/float type; Sgn returns an integer.
Float-to-integer conversion truncates and saturates at signed 32-bit limits;
integer arithmetic retains its separate overflow checks.
Base-10 Log still uses JavaScript; verification against
the intended AMOS/Kickstart math library remains outstanding.
See [numeric behavior and limits](docs/numbers.md).

## Arrays, DATA and files

The compiler supports typed multidimensional arrays with inclusive upper bounds,
`Data/Read/Restore`, scoped procedure DATA, named `Shared` declarations, and
procedure result values through `Param`, `Param#` and `Param$`.
`examples/ArraysData.AMOS` exercises arrays and labeled DATA. Common string
functions include `Left$/Right$/Mid$`, `Chr$/Asc`, `Len`, `Instr`, case conversion,
`Str$` and `Val`. `Val` preserves integer/float type through subsequent expressions.
`Left$/Right$/Mid$` also support assignment to scalar and array strings, retaining
the destination length. See [string behavior](docs/strings.md) for bounds and
self-replacement rules.
Nonempty concatenation checks the AMOS String_Max boundary; retrieval and
repetition use source-derived bounds and word lengths. AMOS heap exhaustion is
not modeled.

Sequential file operations use an explicit synchronous host adapter:

```js
const { createNodeFiles } = require('amoscript/lib/amos/files');
const create = require('./program.js');
const program = create({ setTimeout, files: createNodeFiles('./data') });
program.tick(1000);
```

`createNodeFiles` resolves relative filenames against that directory; it does not
confine filesystem access. `createMemoryFiles(initialFiles)` provides the same
`read(name)` / `write(name, byteString)` interface in memory. Browser users can
load `lib/amos/files.js` and use `AMOS_FILES.createMemoryFiles()`.

Supported sequential operations are `Open In`, `Open Out`, `Append`, `Close`,
`Print #`, `Input #`, `Line Input #`, and read-only `Eof/Lof/Pof`. Output is
committed when the program closes its file channel. Records use CRLF; comma
print separators write a tab character. `Line Input #` preserves commas inside
text. Random-access records, devices, seek assignments and asynchronous file
adapters remain unsupported. See `examples/SequentialFile.AMOS` for a round trip.

Inspect `program.state` for instruction position, halt/pause/wait state, ticks,
return stacks, and source location. `state.variables` exposes read-only getters
for the compiler's generated global names. Each factory call creates independent
variables, frames, and timers. Runtime errors halt the program and include the
current source location.

## Browser demo

```sh
npm run build:demo
```

Open `index.html`. **Run** executes the control-flow example; **Graphics** draws
text, shapes and embedded Bob/Icon images from `Graphics.AMOS`, then waits for a
key. **Moving Bobs** runs `Bobs.AMOS`: press a key to present the hidden frame,
again to animate, and again to remove the objects. See [image commands](docs/banks.md),
[moving Bobs](docs/bobs.md), and [buffering/Autoback](docs/buffering.md).
All demos execute generated
code. Focus the canvas to send keyboard or mouse input. Rebuild the demos after
code generation or runtime changes; the integration suite checks their artifacts.
See [the display contract](docs/display.md) for supported drawing and input forms.

Generated scripts expose `globalThis.AMOS_MODULE`, the same factory exported in
Node. Load `lib/amos/background.js` for the optional facade:

```js
AMOS.init({ write: text => { output.textContent += text; } });
AMOS.load(AMOS_MODULE);
AMOS.run();
document.addEventListener('keydown', event => AMOS.sendKey(event.key));
```

The facade also accepts instruction tables when `font.js`, `display.js`,
`operations.js` and `driver.js` from `lib/amos/` are loaded, in that order.
For external bank loading in this direct-runtime mode, load `lib/BankReader.js`
before `operations.js` as well; Save also needs `lib/BankWriter.js` there.
Generated modules embed those implementations and need no separate runtime
scripts. `program.display` exposes indexed pixels and RGBA snapshots in Node
as well as browsers.

`Load "file.abk"` and its optional-number form read external Object/Icon/data
banks through `files.read`, using the same byte-string adapters as sequential
files. Image appending and grouped ABS replacement are supported. Browser hosts
preload file bytes; generated modules include the decoder. See
[external bank behavior](docs/banks.md#external-files) for numbering and limits.
`Save "file.abk",bank` writes a single bank; omitting the number writes an AmBs
group, including work banks. Both use synchronous byte-string file adapters.
Image saving normalizes live flip state. See [Save behavior](docs/banks.md#saving-banks)
for ordering, truncation and size limits.
The four `Reserve As Work/Data` forms (including Chip variants), `Erase`,
`Erase Temp/All`, `Bank Swap`, `Bank Shrink` and `Length(bank)` support basic bank
lifecycle. Physical Amiga memory pools and addresses remain unmodeled.

## Development

```sh
npm ci
npm run check
node tools/dump_tokens.js examples/Test7.AMOS
node tools/dump_ir.js examples/Test14.AMOS
npm run build:examples
npm run install:browser
npm run test:browser
```

The active pipeline is `Buffer` → `TokenReader` → `Parser` → `Lowerer` →
`Transpiler.toModule()`. Tokens, AST statements/expressions, and IR operations
carry source locations. Parsing constructs data without lowering side effects.
Generated modules embed `createProgram` from `lib/amos/driver.js` and the operations
factory from `lib/amos/operations.js`, display model and font, sharing
implementations with direct driver users. `Grammar.js` and
`RuleFunctions.js` are legacy code and are no longer used by the compiler.

Tests cover binary bounds, parser diagnostics, exact example outputs, recursive
procedures, numeric semantics, fake-clock waits, scheduler lifecycle, real CLI
execution from a temporary directory, and browser exports/page wiring in a VM
with a DOM stub. The separate Chromium smoke test verifies actual Canvas pixels
and real browser input, and writes graphics/Bob screenshots to `test/artifacts/`.
Browser binaries use the ignored `.cache/ms-playwright` directory. CI targets
Node 22/24 and pinned Playwright Chromium on Ubuntu 24.04; local clean-install
checks pass on both Node majors. Node 18.19.1 also passes locally.
`npm run check:generated` reports stale demos without rewriting them; rebuild
explicitly with `npm run build:demo` after compiler/runtime edits. The browser
command checks generated output before launching. See [development and CI](docs/development.md)
for Linux dependencies, reproducible installation and workflow evidence limits.

The `ArraysData`, `SequentialFile` and `Graphics` fixtures are generated by
`tools/build_examples.js` from explicit token sequences and include readable
`.Asc` references. They are synthetic fixtures using documented AMOS tokens,
rather than exports captured from reference AMOS execution.
