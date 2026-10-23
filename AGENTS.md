# Repository Guidelines

## Project structure and architecture

- `lib/Buffer.js` validates AMOS headers, code bounds and binary reads.
- `lib/TokenReader.js` decodes tokens with physical line/byte locations;
  `TokenTable.js` records original token offsets.
- `lib/Parser.js` builds ASTs without code-emission side effects. Function/display
  signatures live in `FunctionTable.js` and `DisplayTable.js`.
- `lib/Lowerer.js` handles typing, scopes, labels and control-flow IR.
  `lib/Transpiler.js` emits standalone program factories.
- `lib/BankReader.js` decodes supported trailing and external asset banks; generated
  modules embed it for runtime Load through the synchronous files adapter.
- `lib/BankWriter.js` encodes supported ABK/ABS files and is also embedded for
  runtime Save. Serialization coverage includes independent expected bytes.
- `lib/amos/driver.js` executes an instruction-function table using `state.ip`,
  call/procedure stacks, cooperative budgets and waits. It is not a switch emitter.
- `lib/amos/operations.js` implements language operations; `display.js` models
  indexed screens; `font.js` supplies glyphs; `files.js` provides synchronous
  memory/Node file adapters. Host-specific APIs belong in adapters.
- `lib/amos/browser.js` handles Canvas/input; `background.js` exposes AMOS.
  Generated modules embed scheduler, operations, display and font, without imports.
- `bin/amoscript` invokes `lib/command.js`; `index.html` runs generated demos.
- `examples/` contains Test1–27 and synthetic programs with `.Asc` references.
  ASCII is not an accepted compiler input yet.
- `Grammar.js` and `RuleFunctions.js` are legacy. No compiler, CLI, test or tool
  imports them; Grammar still imports RuleFunctions. Preserve them until their
  external compatibility/removal policy is settled.

## Commands

- `npm ci`: install locked dependencies.
- `npm run check`: verify generated demos, then run unit/CLI/integration tests.
- `npm test`: discover `*.test.js` and `test-*.js` through `test/run.js`.
- `npm run build:demo`: regenerate the three standalone browser modules.
- `npm run check:generated`: report missing/stale demo modules without writes.
- `npm run build:examples`: regenerate additional synthetic examples.
- `npm run install:browser`: install pinned Playwright Chromium in the ignored
  `.cache/ms-playwright`, unless PLAYWRIGHT_BROWSERS_PATH overrides it.
- `npm run install:browser -- --with-deps`: also install browser system libraries
  on supported Linux hosts; this can require elevated system permissions.
- `npm run test:browser`: check demos, then run real Chromium Canvas/input/lifecycle
  tests. Screenshots go to ignored `test/artifacts/`.
- `node bin/amoscript examples/Test21.AMOS /tmp/program.js`: compile without
  overwriting existing files. Omit the output path to use stdout.
- `node -e "require('/tmp/program.js')({ setTimeout }).tick(1000)"`: execute it.
- `node tools/dump_tokens.js examples/Test7.AMOS` and
  `node tools/dump_ir.js examples/Test14.AMOS`: inspect decoding/lowering.

CI targets Node 22/24 on Ubuntu 24.04, with Chromium on Node 24. Node 18.19.1 has
also been used locally. Hosted CI evidence exists only after the workflow runs.

## Coding conventions

- Use semicolons, two-space indentation, template strings, and the existing
  `/* jshint esversion: 6 */` comment. Class files use PascalCase; helpers use
  lowerCamelCase.
- Verify original token offsets before adding names. Add parser/lowerer/runtime
  semantics together and reject unsupported forms explicitly.
- Carry source locations through AST/IR; runtime failures must halt with context.
- Use shared language helpers where JavaScript coercion/Math differs from AMOS.
  Static expressions and Val tags must agree at conversions/storage boundaries.
- Generated cases perform their semantic effects and return control objects for
  branches/calls/waits. Allocate program variables up front. Each factory call
  must have independent mutable language/runtime/asset state.
- Browser and Node share semantics; keep parsing free of code-generation effects.

## Verification

- Preserve Test7 numeric ordering, Test14 procedure behavior, and Test21's exact
  `Start → One → Two → Three → End` output. Test26/27 use tolerances for
  source-derived power approximations; integer/string cases use exact results.
- Execute standalone generated modules without `require` in their sandbox.
  Check outputs, state transitions, bounded execution and timers.
- Inject `setTimeout`, `clearTimeout` and millisecond `now` together. Use fake
  clocks and finite budgets; Test19 deliberately reaches an invalid Return,
  while Test25 deliberately loops forever.
- Keep decoder coverage independent of the production encoder where possible.
  Conformance fixtures distinguish source analysis from actual reference
  execution. Never relabel derived expectations as AMOS captures.
- Exercise typed scalars, arrays, DATA and procedure results for semantic changes.
- Rebuild demos after codegen/runtime edits, then run `npm run check`. Rendering,
  input and browser lifecycle changes also require `npm run test:browser`.
- Passing synthetic tests does not prove full AMOS compatibility. Document limits
  in the appropriate `docs/` contract and compatibility matrix.

## Commits and pull requests

Use concise present-tense commits, such as `fix(parser): preserve literal bytes`.
PRs should explain behavior, rationale, source evidence and material limits; list
relevant checks and fixtures. Do not claim checks/reference execution not run.

## Continuing work

Follow `PLAN.md` and `docs/compatibility.md`. Numeric formatting, base-10 Log,
remaining functions, target-library reference captures, sprites, audio, remaining
bank/file forms and an ASCII frontend remain open. Replacing the established
parser/dispatcher or optimizing it needs measured evidence.
