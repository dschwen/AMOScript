# Display snapshot ABI and fixture harness

Status: ABI v1 and the fixture/diff harness are implemented. The
[basic reference renderer and physical playfield exporter](planar-display.md)
now consume this ABI; the [bounded copper path](copper-display.md) also emits it.
Advanced modes and GPU rendering remain planned
in [the integrated architecture](display-architecture.md). A fixture passing with
a stub proves the harness, not AMOS rendering compatibility.

## Runtime snapshot

[frameState.js](../lib/display/model/frameState.js) exposes `createSnapshot`,
`validateSnapshot`, `serializeSnapshot` and `deserializeSnapshot` without DOM,
filesystem, crypto or Node dependencies. A snapshot is `{ chip, frame }`.
`createSnapshot` owns copies of every input array and metadata object; publishing
does not retain mutable producer buffers. Metadata objects are frozen. JavaScript
typed arrays cannot be frozen: consumers must treat published arrays as read-only
and producers must publish a new snapshot for changes. Renderers must never mutate
them. The codec factory is embedded in generated programs for playfield export;
the current Canvas host still uses its existing indexed rendering path.

Frame metadata is explicit and required:

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Exactly 1; unsupported versions reject |
| `revision` | Nonnegative safe integer |
| `chipset` | `OCS`, `ECS` or `AGA`; recording a profile does not implement it |
| `samplesPerLowresPixel` | 2 for OCS, 2 or 4 for ECS, 4 for AGA; ECS superhires rendering needs 4 |
| `outputWidth` | Native samples, including the explicit crop/border window |
| `lines` | Current-field line count; `ceil((outputHeight-parity)/2)` when interlaced |
| `outputHeight` | Full output height; equals lines without interlace, may be odd |
| `interlaceField` | `null`, 0 or 1 |
| `maxEvents` | Fast event capacity per line, 1–256 |
| `videoRate` | Positive rational `{ numerator, denominator }`, fields per second |
| `pixelAspect` | Positive rational for native-grid samples after field composition |
| `origin` | Signed `{ x, y }` hardware position of the output window, before native sample scaling |

The schema bounds width/full height to 4096 and field lines to 2048. A one-row
interlaced image has zero rows in field one; other zero-line combinations reject.
This fixes the initial even-only dimension check while preserving the wire layout
and all previously valid fixtures. Chip bytes are exactly
512 KiB, 1 MiB or 2 MiB and retain Amiga big-endian word layout. Profile names,
dimensions and rates describe fixture data; they do not claim new screen modes
are executable in the existing AMOS facade.

All six tables are mandatory, including empty overflow storage:

| Table | Type | Elements / layout |
| --- | --- | --- |
| `lineRegs` | Uint32Array | `lines*32`, columns from the detailed proposal |
| `linePal` | Uint8Array | `lines*256*4`, RGBA bytes |
| `lineSprites` | Uint32Array | `lines*8*4`, physical channel texels |
| `lineEvents` | Uint32Array | `lines*maxEvents*4`, ordered `(signed x bits, register offset, word value, 0)` |
| `eventOffsets` | Uint32Array | `lines+1`, offsets into overflow **event records**, not words/bytes |
| `overflowEvents` | Uint32Array | Full ordered streams for overflowing lines; four words per event |

`lineRegs[line*32+17]` is the total line event count. For an overflowing line,
`eventOffsets[line+1]-eventOffsets[line]` equals that count, and its fast table
contains the exact first `maxEvents` records. Other lines have zero overflow
span. Equal-x events preserve input order. Up to 65536 full-stream overflow
records can be stored per snapshot; exhaustion rejects rather than dropping or
quantizing writes. GPU exact-segment preparation is a future consumer of this
lossless representation; selecting CPU fallback must remain visible in reports.

Sprite starts and event positions store signed native sample coordinates as
Uint32 bits. Sprite flags use bit 31 for activity; x=-1 is not an inactive
sentinel. Register words and DMA flags are bounded; reserved register columns
must be zero. Plane pointers must identify aligned words inside chip memory.
This is structural validation: renderers/interpreters must additionally check
every fetch span and reject unsupported register/mode semantics before rendering.

## Wire format

The codec returns `{ header, chip, tables }`. The JSON header identifies
`format: "amos-display"`, schema version, frame metadata, blob lengths and six
table descriptors. Tables are concatenated in the order above. Descriptors record
`type` (`u32be` or `u8`), byte `offset`, element `length`, and element `stride`.
Numeric tables always use big-endian 32-bit words, irrespective of host order.
Byte tables have no conversion. The decoder validates canonical contiguous spans,
types, strides and exact blob lengths; overlap, truncation and trailing data reject.
The chip blob remains unchanged rather than reinterpreted through host words.

Fixture manifests wrap the codec header, stored in `*.frame.json`, with:

- `fixtureVersion: 1`, a name, and explicit evidence/provenance;
- `snapshot`: the codec header;
- `blobs.chip`, `.tables`, `.golden`: local filename, byteLength and SHA-256.

The chip and table files conventionally end in `.chip.bin` and `.tables.bin`.
`golden` names a canonical PNG. Filenames are simple basenames; traversal and
absolute paths reject. Blob lengths are bounded before reading, and hashes are
checked before decode. These file/hashing operations belong to the Node test
harness, not the host-independent runtime codec.

Evidence kinds are `synthetic`, `source-analysis` and `reference-capture`, with a
description. Captures also require environment and captureProcedure strings.
Required labels do not independently authenticate reference execution; retain
the actual capture procedure/results. CPU/GPU equality is a separate claim.

## Comparison and artifacts

[displayFrames.js](../test/helpers/displayFrames.js) loads a fixture with
`loadFixture(filename)`. `runFixture(filename, renderer, options)` calls
`renderer(chip, frame)`, accepts a synchronous result or Promise, and requires
`options.backend` to label the actual path used. The renderer returns exact
top-left, row-major current-field RGBA bytes of `outputWidth*lines*4` length.
No CSS, aspect, filtering or gamma transformation is applied in comparisons.
Golden dimensions must match that field. Woven-output testing supplies explicit
previous output to [the field composer](display-modes.md#interlace-without-hidden-history).
Empty fields have no zero-height PNG; their behavior is tested through full-output
composition. No history is implicit in the current-field renderer/harness.

`comparePixels` reports exact mismatching pixel/channel counts and the first 16
positions/expected/actual tuples by default (configurable 0–1000). Alpha is
compared too. Diff pixels are opaque magenta for mismatches and black for matches.
With `artifactDirectory`, `runFixture` writes `actual.png`, `diff.png` and
`report.json`; use a distinct directory per fixture to retain a whole suite.
Load/decode/renderer exceptions propagate instead of being counted as parity.

The bounded [PNG helper](../test/helpers/displayPng.js) supports non-interlaced
8-bit RGB/RGBA goldens, all five row filters and CRC verification. It emits RGBA8
PNGs and rejects unsupported indexed/16-bit/interlaced/animated/transparency-key
forms. Import other captures through a documented lossless conversion first.
Ancillary colour metadata does not transform raw comparison bytes. The codec
follows the [W3C PNG specification](https://www.w3.org/TR/png-3/); it is a fixture
utility, not a general image library or runtime asset loader.

`npm run check` exercises independent wire/PNG fixtures, corruption, metadata,
pointer/length checks, signed coordinates, overflow streams, stub pass/fail and
artifact reports. `npm run test:browser` also decodes an emitted PNG through
Chromium independently and writes `webgl-readback.png` and
`webgl-readback-diff.png` under ignored `test/artifacts/`.
