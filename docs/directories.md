# Current directories and existence queries

Dir$ (`$175a`, V2) is a string-valued query and assignment. The directory is owned
by each program, initially the explicit empty prefix, and never changes the
process or browser working directory. Assignment requires a string expression,
resolves relative to the existing prefix, appends `/` for a non-volume directory,
then calls `files.isDirectory(resolvedPath)` once. The adapter must return a
synchronous boolean. False, exceptions, missing methods and asynchronous/nonboolean
returns fail before changing the current directory. A volume root such as `RII:`
retains its colon; `Dir$="music"` under it becomes `RII:music/`.

Exist (`$174e`) takes a string and returns integer -1 or zero. Nonempty queries
call `files.exists(resolvedPath)` once, with the same strict synchronous boolean
contract. Directories may exist too. Empty input returns zero without a host call.
The runtime never reads file contents to answer metadata queries and never
silently converts adapter errors into missing files.

The bounded path subset supports ordinary relative children and explicit volume
paths. With Dir$ set, Bload/Bsave, Load/Save banks, Track Load, Load Iff and file
channel Open/Append use the same prefix. Explicit volume paths bypass it. Resolved
write names are captured before host callbacks, so a callback changing Dir$ cannot
retarget the second Bsave/Save write. Open channels keep their resolved names
through later directory changes. With no directory set, legacy names pass through
unchanged, including existing Node absolute paths.

Assignment and prefixed operations reject NULs, leading `/` parent/absolute forms,
leading `:` current-volume shorthand, `.`/`..` components, doubled `/` and multiple
colons. AMOS parent navigation, volume aliases/assigns, native lock identity and
native filename-length/overflow behavior remain open. Fsel$ retains its existing
literal request metadata and complete-path return contract; no picker is opened
by Dir$/Exist. Case normalization and volume mapping belong to the adapter.

## Supplied adapters

`createMemoryFiles(initial, choices, directories)` now supplies `exists` and
`isDirectory`. It infers directories from file or explicit directory prefixes;
the optional third array names empty directories. Names stay case-sensitive and
contents remain synchronous in-memory byte strings. This is not persistent
browser storage; IndexedDB remains planned.

`createNodeFiles(base)` uses stat queries relative to its fixed base. Missing or
non-directory path components yield false; other host errors propagate. It does
not change `process.cwd()` or interpret AMOS volume syntax/case folding. The
Roller II browser fixture uses an explicitly prepared, case-insensitive `RII:`
mapping of owned assets rather than changing global adapter semantics.

Tests cover string arguments, scalar/array/DATA/procedure expression integration,
existence booleans, per-factory isolation, metadata failures, memory/Node adapters,
all existing transfer families and fixed channel/write destinations. The unchanged
first 17 Roller II lines exercise the original `Dir$="RII:"` startup. They do not
execute the first title-image request on line 18.

Source-derived rules follow the pinned original
[`src/lib/dos.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/lib/dos.cpp)
(`path_it`/`name_disc`) and
[`src/lib/files.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/lib/files.cpp)
(`lib_in_dir`/`lib_fn_dir`/`lib_fn_exist`). No new Amiga capture is claimed.
