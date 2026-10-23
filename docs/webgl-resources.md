# WebGL2 resource infrastructure

[resources.js](../lib/display/webgl/resources.js) owns GPU storage and debug
readback for ABI v1 snapshots. It is implemented and tested in Chromium/SwiftShader.
The [non-HAM renderer](webgl-renderer.md) now uses it for actual GPU decode/resolve.
The renderer also draws its scale/aspect pass to the canvas. The resource owner
itself does not replace the application host; backend switching, live diff and
remaining mode/parity gates stay open.

CommonJS exports `createResources(canvas, options)` and
`createResourceFactory(snapshotModel)`. The browser script exposes
`AMOS_WEBGL_RESOURCES_FACTORY`; supplying the shared snapshot model produces the
same constructor. GPU code stays in the browser adapter, outside generated AMOS
modules and the instruction scheduler. The constructor requires its own WebGL2
canvas/context. A 2D canvas cannot be converted; creation/capability failure throws
so a future switching host can select its separate CPU surface explicitly.

The owner checks texture/viewport limits, fragment integer precision and sampler
capacity. Integer textures use nearest filtering and clamp addressing. Transfers
use alignment one, typed arrays and no premultiplication or image colour conversion.
The formats follow the [WebGL2 specification](https://registry.khronos.org/webgl/specs/2.0/).
RGBA32UI/RGBA8UI debug framebuffers and R16UI/RGBA8 output framebuffers are checked
for completeness. Shader compile/link and GL errors throw with diagnostics.

## Storage and upload contract

`upload(snapshot)` validates and owns a copy of chip bytes, tables and metadata.
It uploads these textures:

| Name | Format | Size |
| --- | --- | --- |
| `chip` | R8UI | 2048 × chipBytes/2048 |
| `lineRegs` | R32UI | 32 × fieldLines |
| `linePal` | RGBA8 | 256 × fieldLines |
| `lineSprites` | RGBA32UI | 8 × fieldLines |
| `lineEvents` | RGBA32UI | maxEvents × fieldLines |
| `eventOffsets` | R32UI | Linear records, at most 2048 per row |
| `overflowEvents` | RGBA32UI | Linear event records, at most 2048 per row |
| `indexBuf` | R16UI | outputWidth × fieldLines, framebuffer target |
| `colourBuf` | RGBA8 | outputWidth × fieldLines, framebuffer target |

Linear tables pad their final physical row with zeros; debug readback removes
that padding. An empty field allocates one zero storage row but returns zero
logical rows. It does not acquire an extra output line. Chip bytes retain their
big-endian word encoding; numeric Uint32 table values upload as values, independent
of the serialized wire byte order.

The first upload and every restored context transfer all chip rows. Later uploads
compare owned previous/current chip rows and merge adjacent changed rows into
`texSubImage2D` calls. Unchanged/palette-only frames transfer no chip rows; all
frame tables still update. There is no dependency on a reused frame revision or
mutable caller arrays. Separate consumers retain separate caches and cannot
consume each other's changes.

This transitional snapshot path scans chip bytes on the CPU. It does not yet use
ChipMemory revision cursors to avoid that scan or establish a performance budget.
Canonical planar ownership and measured upload optimization remain later work.
The tests compare upload ranges with independent ChipMemory dirty queries and
instrument actual GL calls, alongside counters and byte readback.

`readTexture(name)` runs a fullscreen debug shader into an integer framebuffer,
reads exact components and returns an owned Uint8Array/Uint16Array/Uint32Array.
Table row zero stays row zero through upload/readback. The renderer's presentation shader owns the conversion from this storage
convention to a top-left canvas image.
An output target reads as zero initialization until a render pass writes it.
The resource-only checks do not establish Amiga rendering; the separate
[shader parity suite](webgl-renderer.md) exercises real decode/resolve output.

`getTexture(name)` returns texture/framebuffer handles and geometry for future
passes. `addPass(name, fragmentSource)` retains up to 16 named fullscreen shaders
(up to 65536 source characters each); `runPass` binds an owned framebuffer, input
textures and unsigned scalar uniforms, rejects feedback and counts successful
draws. Registered sources recompile on restoration. Handles belong to one context
generation; callers must query them again
after restoration. The owner changes GL state and does not share its context with
an unrelated rendering library. `stats` returns owned counters and the latest
successful upload's row ranges, full-upload flag and byte counts.

## Context lifecycle

States are `ready`, `lost`, `error` and `disposed`; optional `onStateChange`
receives loss/restoration/disposal notifications. Loss cancels the browser's
default loss behavior, invalidates GPU caches and retains CPU snapshot ownership.
While lost, `upload` retains the newest owned snapshot and returns false without
drawing; readback/handle access reject. Restoration recreates programs, VAO,
textures and framebuffers, then fully uploads that snapshot before reporting
ready. Restoration failure reports error; it is not successful GPU coverage.
This follows [Khronos context-loss guidance](https://wikis.khronos.org/webgl/HandlingContextLost).

`dispose()` removes listeners, unbinds/deletes programs, textures, framebuffers
and VAO, releases retained CPU arrays, and is idempotent. It never runs program
instructions, changes timers or restarts AMOS. Lost-context and rendering fallback
UI still belong to the future switching host.

Chromium tests cover all three chip sizes, every ABI table, signed/high-bit
values, unchanged and three-row dirty uploads, two consumers, palette-only updates,
padded overflow storage, empty fields and exact latest-snapshot restoration.
WEBGL_lose_context forces a real loss/restore cycle. Instrumentation verifies GL
upload calls and that restored textures, framebuffers, programs and VAO are
deleted at disposal. These local infrastructure gates do not establish hardware
captures, GPU display parity, browser-host fallback or performance on target GPUs.
