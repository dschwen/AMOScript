# Repository Guidelines

## Project Structure & Module Organization
- `lib/`: Core transpiler sources.
  - `Buffer.js`: AMOS binary reader utilities.
  - `Grammar.js`: Token grammar and parser driver.
  - `RuleFunctions.js`: Grammar action helpers.
  - `Transpiler.js`: Orchestrates parsing; entry for transpilation.
- `amos/`: Browser/runtime layer — `driver.js` (switch/IP driver), `background.js` (browser facade), `system.js` (token helpers).
- `bin/amoscript`: CLI entry (Node) that invokes `lib/command.js`.
- `examples/`: Sample AMOS programs (`*.AMOS`) with ASCII refs (`*.Asc`).
- `index.html`: Simple browser harness loading the driver and demo.

## Build, Test, and Development Commands
- `npm install`: Install dependencies.
- `npm test`: Runs unit + e2e tests (driver, buffers, codegen). Includes numeric print coverage and control-flow lowering checks.
- `node bin/amoscript examples/Test1.AMOS > out.module.js`: Transpile to a driver-based JS module.
- Browser: open `index.html`, click `Run` to execute the driver demo.
- Node (module): `const create = require('./out.module.js'); const prog = create({ setTimeout }); prog.tick(100);`

## Coding Style & Naming Conventions
- JavaScript ES6; use semicolons; 2‑space indentation; prefer template strings.
- Files holding classes use `PascalCase` (e.g., `Buffer.js`); helpers lowerCamelCase.
- Keep grammar readable: add token names in `lib/TokenTable.js`, and reference them in `lib/Grammar.js` rules.
- In‑file `/* jshint esversion: 6 */` is used; keep new files consistent.
 - Codegen style: driver cases are side-effect free unless returning control objects; assignments declare variables up-front.

## Testing Guidelines
- Runner: `test/run.js` discovers `*.test.js` and `test-*.js`.
- Unit: focus tests (e.g., `Buffer` reads, fake timers).
- E2E: transpile `examples/*.AMOS` to a module, run via driver, capture `console.log` and assert outputs.
  - Strings: `Test1.AMOS`.
  - Numbers: `Test7.AMOS` (floats/ints with tolerance checks).
  - Exponentiation: `Test27.AMOS` (verifies `^` precedence and lowering).
  - Control flow: `Test21.AMOS` end-to-end validates `Start → One → Two → Three → End` using `Goto`, `Gosub`, `Return`, and `End` lowering.
- Lowering checks: verify `goto`/`gosub` and labels (see `Test21.AMOS`).
- Headless: inject `{ setTimeout, vblHz, sleepScale }` for deterministic timing; use fake timers in tests.

## Commit & Pull Request Guidelines
- Commits: concise, present tense. Examples:
  - `feat(codegen): add switch(ip) driver`
  - `fix(buffer): correct DWord endianness`
  - `refactor(grammar): flatten ifStatement rules`
  - `chore: add example AMOS programs`
- PRs: clear description, rationale, and scope; link issues; include before/after CLI logs or screenshots; list example files used.

## Architecture Overview
- Pipeline: `Buffer` reads AMOS bytes → `Grammar` consumes tokens using `RuleFunctions` → `Transpiler` drives parsing and codegen. Browser runtime in `lib/amos` executes generated code.

## Codegen Roadmap
- Module output: one self‑contained JS module per AMOS program.
- Prelude: bundled scheduler, `state` struct, and helper ops.
- Dispatch: `switch (state.ip)` with one `case` per reachable IP; each case executes the mapped semantic, updates `state.ip` (usually `ip+1`), then `break`.
- Driver: `tick(maxSteps)` runs until a yield or step budget is reached, then re‑schedules.
- Timing/config: constructor options `{ setTimeout, vblHz, sleepScale }` to support tests and headless environments.
- Calls/returns: IP stack for `Gosub`/procedures (`{ call, ret }`).
- Facade: browser `AMOS.init({ ... })`, `AMOS.load(cases)`, `AMOS.run()` delegate to the driver.
- Testing hooks: inject fake `setTimeout` and fixed `vblHz` for deterministic tests; assert `state` transitions, yields, and sleeps.
- Lowering implemented: `Print` (strings/numbers), basic arithmetic with `^` precedence, `Goto`, `Gosub`, `Return`, `End`, and simple assignments (with predeclared variables). Duplicate-op guards ensure single semantic effect per AMOS op.

## Next Steps
- Eliminate duplicate op emissions in the grammar (reduce need for no-op guards).
- Broaden arithmetic lowering (additive/multiplicative precedence) and conditional branching (`If/Then`).
- Consider exposing raw `cases[]` from generated modules for `AMOS.load(cases)` in the browser, while keeping the current program factory for Node.
