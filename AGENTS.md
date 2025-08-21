# Repository Guidelines

## Project Structure & Module Organization
- `lib/`: Core transpiler sources.
  - `Buffer.js`: AMOS binary reader utilities.
  - `Grammar.js`: Token grammar and parser driver.
  - `RuleFunctions.js`: Grammar action helpers.
  - `Transpiler.js`: Orchestrates parsing; entry for transpilation.
  - `amos/`: Browser runtime (`system.js`, `background.js`).
- `bin/amoscript`: CLI entry (Node) that invokes `lib/command.js`.
- `examples/`: Sample AMOS programs (`*.AMOS`) with ASCII refs (`*.Asc`).
- `index.html`: Simple browser harness loading `lib/amos/*` and `out.js`.
- `out.js`: Example generated program; used by `index.html`.

## Build, Test, and Development Commands
- `npm install`: Install dependencies (e.g., `binary-search-bounds`).
- `node bin/amoscript examples/Test10.AMOS`: Parse a sample AMOS file; useful for parser debugging.
- Open `index.html` and click `Run`: Executes `out.js` with the browser runtime for manual checks.
- Tip: Use your browser console to observe `AMOS.mainLoop` and token effects.

## Coding Style & Naming Conventions
- JavaScript ES6; use semicolons; 2‑space indentation; prefer template strings.
- Files holding classes use `PascalCase` (e.g., `Buffer.js`); helpers lowerCamelCase.
- Keep grammar readable: add token names in `lib/TokenTable.js`, and reference them in `lib/Grammar.js` rules.
- In‑file `/* jshint esversion: 6 */` is used; keep new files consistent.

## Testing Guidelines
- Current: no formal runner. Validate via:
  - CLI parse runs on `examples/*.AMOS` and inspecting console output.
  - Browser harness in `index.html` to step through runtime behavior.
- Headless tips: structure new runtime to accept `{ setTimeout }` so tests can stub timing; prefer deterministic `vblHz` in unit tests.
- When adding logic, include small unit tests (e.g., `Buffer` boundary reads) under a future `test/` directory.

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
- Testing hooks: inject fake `setTimeout` and fixed `vblHz` for deterministic tests; assert `state` transitions and yielded points.
