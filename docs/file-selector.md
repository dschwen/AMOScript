# Fsel$ through a prepared synchronous host

All four original token forms are supported: `Fsel$(path$)` and the two/three/four
argument variants with default name, title 1 and title 2. Omitted arguments become
empty strings. The compiler preserves string types and ordinary expression
ordering; the runtime calls a synchronous `files.select(request)` adapter once.
No expression is suspended, retried or replayed by the compiler.

```js
const files = createMemoryFiles(preloadedFiles, ['', 'disk:chosen.LEV']);
const program = create({ files, now, setTimeout, clearTimeout });
```

The frozen request is `{path, defaultName, title1, title2}`. The adapter returns
the chosen complete filename/path unchanged, or `''` for cancellation. It need
not refer to an existing file, because a caller may save a new file. The adapter
owns directory presentation, wildcard matching and path assembly. The runtime
does not append extensions, change case, prepend the request path or silently
substitute the default name. Arguments and results are bounded NUL-free 8-bit
strings of at most 255 bytes. Larger/native string edge cases remain unsupported.

Missing adapters, non-string/thenable results and host errors halt with source
context. Promises are rejected explicitly. This subset **does not implement an
asynchronous modal browser file dialog**, native AMOS requester graphics, stored
directories, disk lists, directory sorting or native input/display side effects.
An asynchronous selector inside arbitrary expressions needs a separate evaluation/
continuation design; ordinary function calls must not be replayed to await input.

`createMemoryFiles(initial, choices)` now offers a queue-backed adapter, plus
`queueSelection(name)` and `selectionRequests()`. A queued cancellation consumes
one entry. An exhausted queue throws rather than returning repeated cancellations
or spinning indefinitely in the caller's retry loop. Requests record consumed
choices; queues and file maps are owned by their adapter instance. A Node/custom
files host may instead supply its own synchronous selection callback.

Browser hosts finish user choice and byte preload **before** executing the
selection expression. The [demo](../demos/file-selector.html) lets users prepare
load/save paths and optionally preload a chosen local file, then executes the
original selector routine. Its load button stays disabled during preload; stale
upload completions are ignored after disposal. Files remain volatile memory
entries. [IndexedDB persistence remains planned](../PLAN.md#browser-persistent-files-planned).

## Original selector and whole-program milestone

The declared fixture joins unchanged Wonderland startup (1–48), load (426–431)
or save (435–437), and the complete `filesel` routine (706–712). A synthetic Wait
Key/End guard separates main code from that routine. Its own Gosub/Return,
Show/Hide and extension-validation Repeat loop all execute. Prepared cancellation,
wrong-extension and valid `.LEV` choices verify retries, case handling and the
subsequent original raw-file statements. No native requester or complete editor
session is claimed.

**The unmodified complete Wonderland.AMOS now compiles** into a standalone
factory: 753 physical lines, all 142 distinct encodings recognized, and 1253
lowered instructions. Unit execution omits require in its sandbox. Independent
factory storage is checked. A finite, one-callback-at-a-time clock avoids draining
the original busy menu's zero-delay cooperative callbacks forever.

With declared joystick port-1 fire input, the program's own title/menu dispatch
enters game 1, level 1. It reads the original Samples, Title, Landscape and Score
Panel files, initializes the map/enemies, and reaches the first gameplay update.
At nominal time 100 ms it fails with `Attached or wide hardware Sprites are not
implemented at line 204, byte 8682`. This is automatic sprite publication at the
Wait Vbl boundary, **not a Sprite statement at line 204**. The measured active
requests are AMOS sprite numbers 1 and 5, both image 25, width 16 and depth 4.
The current AMOS writer rejects depth above two; attached-pair integration is the
next target. The error is retained rather than bypassed or replaced by a fallback.

This proves compilation and bounded game entry, not playable gameplay, sprite
parity, native timing or a complete editor. Existing menu/title/display fixtures
retain their separate evidence. See [the milestone](wonderland.md).

## Source and verification

Pinned [`src/lib/fsel.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/lib/fsel.cpp)
provides the four wrappers, empty defaults, selected-name and cancellation return
paths. The synchronous prepared-input protocol and string bounds are the portable
subset, not a reproduction of the native GUI or unsafe buffer cases.

Six execution groups cover all overloads, string DATA/arrays/procedure results,
once-only expression effects, adapter failures, namespace/queue ownership, the
unchanged selector/file slices and the unmodified whole-program gate. An
independent-byte conformance fixture uses literal original words and declared
host choices. The shared Chromium scenario checks the original routines, optional
preload, new save names and the same whole-program sprite failure. It is a data
inspector with an HTML Preview link in the [gallery](../demos/index.html), not an
image of a running game. No Amiga GUI or execution capture has been added.
