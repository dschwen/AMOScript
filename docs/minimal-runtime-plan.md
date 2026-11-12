# Plan: minimal bundled runtime

Status: planned. `shared` and `full` packaging are implemented. The third
`minimal` option is reserved and explicitly unavailable until the requirements
below are met; no size claim is made for it yet.

## Objective and invariants

Emit a self-contained page/module with only the runtime features needed by its
programs, plus their transitive dependencies. Keep the full runtime as the
compatibility baseline. Packaging must not change AMOS execution semantics,
synchronous files, source error recovery, waits, memory validation, bank identity,
display ownership or Stop/Restart/disposal behavior.

Share code, not mutable game state. A feature's runtime constructors must remain
per-VM wherever they own state. Preserve public host APIs or explicitly declare
a reduced API contract; do not discover missing methods only after a host calls
them. Compilation must not execute programs or evaluate user expressions.

## 1. Inventory and dependency graph

Create a versioned feature registry. Each entry declares:

- Emission units: factories, codecs, helpers and adapters.
- IR operations and typed expressions that require the feature.
- Transitive dependencies, including lifecycle hooks and background wakes.
- Host API exposure and supported runtime asset formats.
- Whether dynamic input requires conservative retention.

Start with coarse subsystems: tracker/MOD, AMOS Music, sample effects/Boom,
AMAL/Anim, Interface/resource banks, menus, 3D, IFF/ANIM/packed pictures, bank
serialization and optional extension families. Core driver, checked memory,
typing/control flow and shared display contracts stay intact initially.
Split monolithic operations/display factories along these boundaries before
trying to remove their internal functions. Keep the graph independent of Parser
side effects; analyze the lowered IR and compilation metadata. Have lowering
record resolved primitive/feature identifiers explicitly, including expression
functions, rather than searching emitted JavaScript strings for method names.

## 2. Analyze all entry points conservatively

Union requirements across the main program and every linked `Run` target. Include
procedures that menus, On Error, computed branches and host entry points can
reach. Initial milestones need not prove AMOS procedures unreachable: collect
features from all lowered instructions, including dormant procedures.

Treat dynamic sources carefully:

- Dynamic AMAL/Interface strings retain their supported execution engines;
  inspecting a literal alone cannot establish all later strings.
- General Load/Bload and raw bank operations can introduce banks and addresses
  whose formats are not explicit in a command name. Retain necessary readers,
  memory guards and format support unless a validated closed asset set proves
  otherwise. Session files may change after compilation.
- Dynamically linked programs or host-supplied factories require a declared
  feature manifest or conservative full retention. Do not guess from filenames.
- Fade, Flash, menus and music may run through scheduler wakes while the main
  program waits. Their cleanup and error paths are dependencies too.
- Display modes, sprites, clones, palettes and chip-memory views share rendering
  machinery. Never substitute CPU rendering for a GPU feature removed in error.

Extension slot mappings select language profiles, not proof that every command
in a profile is required. Keep token decoding separate from feature selection.

## 3. Emit selected code and explain it

Use one selected runtime per minimal bundled page, including linked programs.
Feed selected units to the existing minifier after dependency closure. Minifier
DCE is a final reduction step, not the feature-discovery mechanism.

Record a capability manifest/fingerprint with the emitted units and their reasons.
Offer a build report listing direct requirements, transitive dependencies and
features retained because inputs are dynamic. Reuse shared/full ABI validation
for composition, but do not allow a capability-reduced library to impersonate the
full shared runtime. Keep unimplemented profiles as clear build failures.

Keep `runtime` independent of `debug`, `minify` and instruction optimization.
Enable the GUI's Minimal option only when real selected emission is available.

## 4. Incremental delivery

1. Add feature inventory/reporting without changing generated code.
2. Extract and gate a small isolated subsystem, initially 3D or AMOS Music.
   Compare output and lifecycle behavior against full emission.
3. Add tracker, sample effects, AMAL/Interface/menu families and bounded asset
   readers as their dependencies become explicit.
4. Expand to display internals only after coarse features have proven useful.
   Fine-grained graphics/arithmetic pruning is a later optimization.

Tests must cover both omission and retention. An absence assertion alone is not
proof that a required feature still works. Run the same input/clock replays
against full and minimal builds, compare values, files, audio events and WebGL
frames, and include failures/recovery and Stop/Restart. Add mixed linked-program
cases where a feature occurs only in a later program or callback.

Benchmark module size, complete HTML, gzip size and build time on the existing
four-program corpus, plus linked programs and a dynamic-input case. Compare both
unminified and minified output with identical assets/debug/optimization settings.
Report runtime bytes separately from unchanged game assets, and include the
feature report so savings are attributable. Publish browser tests as indexed
demos alongside the existing shared-runtime example.
