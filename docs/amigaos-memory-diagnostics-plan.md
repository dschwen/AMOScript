# Plan: actionable AmigaOS system-memory diagnostics

Status: runtime detection, structured fatal diagnostics, standalone demos and
the desktop configuration action are implemented in v0.3.1. The optional
compile-time advisory remains planned.

## Outcome

When a program tries to read the ExecBase pointer without a compatibility
profile, explain the access and show how to configure a supported profile.
The user should not need to interpret a generic bank-memory error or know a
particular game's requirements. No program-name checks are involved.

Suggested message:

> This program tried to read the AmigaOS ExecBase pointer at $00000004.
> To support Exec version checks, choose Advanced → AmigaOS compatibility
> in the builder, then build and preview again. Select the AmigaOS version
> expected by your program. This supports version checks only, not AmigaOS
> services or arbitrary system memory.

Show the original AMOS line/byte location too. Do not recommend a specific OS
version just from this read: the address alone cannot identify the version a
program expects, or prove it will only inspect the supported version field.

## 1. Detect at the checked read boundary

Implement in `lib/amos/bankMemory.js`, where numeric reads know the address and
width, rather than matching error strings in the desktop renderer.

- Initially recognize an actual `Leek(4)` with no `systemInfo` profile: the
  conventional, unambiguous ExecBase pointer access.
- Also identify bounded Peek/Deek reads contained wholly in bytes 4..8, but word
  their diagnostic as a possible ExecBase-byte read. Recommend compatibility as
  something to try, rather than claiming this is certainly a version check.
- Keep generic range validation first. Cross-boundary reads, other low addresses,
  unmapped addresses and retired bank pointers retain their ordinary errors.
- An address matching the portable `$2014` version island without a configured
  profile is not evidence of a real AmigaOS address. Do not infer native ExecBase
  values or classify arbitrary pointers from numeric proximity.
- Apply classification to reads only. Never recommend enabling a read-only
  profile for writes. Do not return synthetic values unless a profile was chosen.
- Cover shared bulk read paths only when the complete checked source range lies
  inside the known pointer island; leave destination checks and preflight order
  intact. Keep Bload's low-number bank/address convention unchanged.

Use a stable error code such as `AMOS_SYSTEM_INFO_REQUIRED`, plus a small owned
metadata record: operation, address, width, field (`execBase`), confidence and
suggested setting (`systemInfo`). The original access still fails normally.

## 2. Preserve structured diagnostics

Trace the error through `driver.js`, `gamePageRuntime.js`, `gamePageUI.js` and
`desktop/main.js`. Source-location augmentation must preserve its code/metadata.
Serialize the allowed fields explicitly: Error's custom properties do not
necessarily survive JSON/IPC. Do not pass arbitrary VM objects to the builder.

The standalone page should show a concise explanation even without Debug mode.
Debug mode additionally includes operation, address, source location and the
structured diagnostic. The desktop's existing preview-error bridge should carry
this bounded diagnostic, not attempt to infer a remedy from message substrings.
Existing Trap/On Error recovery keeps its semantics; do not report handled errors
as fatal preview failures. Linked programs and Restart use the same path.

## 3. Make the remedy discoverable

On a matching fatal preview diagnostic, the builder shows the explanation and a
**Configure AmigaOS compatibility** action. Clicking it opens Advanced, focuses
and scrolls to the existing selector, and leaves its current value untouched.
Changing the selector marks the project dirty using the normal project flow.
The user then builds again; do not change a live VM's memory map, silently select
a version, replay execution, or restart automatically.

For exported pages, explain that the project owner must set compatibility and
rebuild. Custom-host documentation gives `systemInfo: {execVersion: ...}`;
project-CLI documentation points to `options.systemInfo`. Keep all copy generic.

If a configured profile later encounters an unsupported field or OS call,
report that limit accurately. Do not keep recommending the same profile as a
universal fix, or weaken bank-memory bounds to continue.

## 4. Optional compile-time advisory, after runtime diagnostics

A build-time AST inspection can flag constant-address `Leek(4)` and the exact
`Deek(Leek(4)+20)` idiom before Play. This is a nonblocking advisory with source
locations, not a requirement: unreachable code may contain these expressions.
Never evaluate user expressions or infer that a program without a literal read
needs no profile; computed addresses still need runtime detection. Keep Parser
free of emission/host-policy side effects. Runtime detection is the first milestone.

## Verification and delivery order

1. Add synthetic memory/VM tests for exact and partial pointer reads, malformed
   and unrelated ranges, stale banks, writes, configured profiles, source locations
   and ordinary error recovery. Verify no extra memory becomes addressable.
2. Add a standalone synthetic browser demo that fails informatively without a
   profile and reads the chosen version after an explicit rebuild. Include it in
   the Markdown demo index with an htmlpreview link, as for other browser tests.
3. Exercise the real Electron preview bridge and configuration action: Advanced
   opens, focus reaches the selector, no version is automatically selected,
   save/reopen retains the choice, and preview/export both execute the version
   check. Run the packaged application smoke test too.
4. Update desktop/system-information documentation from planned to implemented
   only when those paths pass. The optional static advisory can follow separately.

All fixtures are synthetic and repository-owned. No external game sources,
assets or compiled games are needed for these regressions.
