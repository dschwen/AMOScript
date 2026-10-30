# AMOS 3D: first supported profile

AMOScript now supports twelve commands from the original AMOS 3D extension and
plays the car/hero portion of Gru1's `Anim.AMOS`. This is an initial portable
renderer, not complete AMOS 3D compatibility.

[Play the 3D excerpt](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amos-3d.html)
([local page](../demos/amos-3d.html)). The page has live playback, pause/resume,
restart and fullscreen above its collapsed browser checks. The default mode adds
an explicitly labelled AMOS turntable loop after the source's car sequence, so
the hero keeps rotating. The original source ends immediately after drawing the
hero once; choose **Original excerpt — static hero ending** to see that behavior.
The added loop changes only the demo harness, not the original AMOS file or the
compiler/runtime.

## References and token table

- [Original AMOS 3D manual](https://manuals.plus/m/33c969440df68044f7635ada25002946427cb4ce1cbae12942feb9bcce6a426d.pdf),
  especially the programming section and file-structure appendix.
- [Official MIT-licensed extension source, +3d.s](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/AMOSPro%20Sources/%2B3d.s).
  The corresponding `c3d.lib` binary is in the same source directory; the C engine
  source is absent. The wrapper identifies the default extension slot as 4.
- [Assembled V1.02AP token table](https://github.com/kyz/amostools/blob/master/extensions/AMOSPro_3d.Lib-V1.02AP),
  maintained with the AMOS file tools. All 82 non-dummy offsets, raw names and
  signatures match the source-derived catalogue. Its call words are placeholders,
  so this table is not an executable extension.

The complete catalogue, hashes and assembled-table verification metadata are in
[amos-3d-tokens.json](../tools/reference/amos-3d-tokens.json). Compiler support is
registered separately in [ExtensionTable.js](../lib/ExtensionTable.js); discovering
a token never makes it an ignored statement. Programs configured with a different
extension in slot 4, or AMOS 3D in another slot, need explicit slot configuration
support before compilation.

## Supported commands

| Offset | Statement | Behavior |
| --- | --- | --- |
| `$0016` | `Td Load name$` | Load a definition and its template/surface dependencies |
| `$0024` | `Td Clear All` | Remove instances and definitions, retaining pixels |
| `$0036` | `Td Object n,name$,x,y,z,a,b,c` | Create an unused instance 1–20 |
| `$0054` | `Td Screen Height h` | Select 1–256 top bitmap rows, initially 200 |
| `$0090` | `Td Kill n` | Remove an instance, retaining its definition/pixels |
| `$00d4` | `Td Move Rel n,x,y,z` | Add world-coordinate deltas |
| `$00ec` | `Td Move n,x,y,z` | Set world coordinates; object 0 is the camera |
| `$018c` | `Td Angle Rel n,a,b,c` | Add wrapped angle deltas |
| `$01a6` | `Td Angle n,a,b,c` | Set wrapped angles; object 0 is the camera |
| `$0318` | `Td Redraw` | Render the scene to the selected logical bitmap |
| `$04d6` | `Td Dir path$` | Set the object dependency directory |
| `$053c` | `Td Cls` | Clear the first four bitplanes in the chosen top region |

Scene state is private to each program factory. Coordinates are checked integers
within ±8,388,607; angles retain their low word. Definitions and instance poses
are separate. Redraw happens only when requested by the program; Wait Vbl and
Screen Swap retain their normal driver/display semantics.

## Assets and loading

The five original files in [examples/Amos3D](../examples/Amos3D/manifest.json) are
pinned without modification. Loading uses the existing synchronous byte-string
`files.read` adapter, also available in browser pages built with an asset manifest.
A bare object name gets `.3DO`; dependencies get `.3DT` or `.3DS`. Case/volume
mapping belongs to the adapter. Each load captures its resolved asset directory
before callbacks. It installs a definition only after all referenced data passes
validation, with no partial scene changes on failure.

All three formats begin with an ASCII parenthesized payload length. Object tails
contain typed offset/name references. Saved machine pointers are never followed:
the loader rebuilds relationships from checked offsets and matching references.
The current profile accepts up to 32 sequential eight-vertex blocks using the
six-quad P8 template layout, up to 64 loaded definitions and twenty instances.
Other template geometries, instance layouts and reference targets reject.

The `.3DS` assets contain vector subdivision and contour records. They are not
bitmap textures. Their four anchor vertices select projected screen points;
ordered midpoint records construct further points. The supported closed contours
toggle the first block colour plane inside their even/odd interiors. Invalid
references, subdivision order, stroke flags and open contours reject. The native
engine's general clipped-surface path is still unsupported: a partially near-clipped
detail surface reports an error before any frame pixels are committed.

## Indexed rendering and its limits

`lib/amos/threeD.js` is pure JavaScript and is embedded in standalone modules.
The optional controller initializes on the first 3D call; the legacy script host
can load `lib/amos/threeD.js` separately when needed. It draws into the selected screen's canonical indexed logical bitmap, bypassing
Bob/Autoback drawing hooks. Screen identity, buffer addresses, palette, text and
graphics cursors, line pattern/phase and unrelated upper bitplanes are preserved.
There is no RGBA overlay and no new browser-specific graphics backend.
Existing physical snapshots and chip-memory uploads carry these pixels into the
ordinary Canvas, copper and WebGL paths. Double-buffered output becomes visible
through the program's ordinary Screen Swap.

The screen must be lowres, 320 pixels wide, normal indexed/EHB with at least four
planes, large enough for the configured drawing height, and not a dual playfield.
Redraw preserves original pixels whose bit 3 is already set. Upper planes survive
both Redraw and Td Cls; rows below the configured height survive too. A second
redraw without clearing consequently preserves previously occupied 3D pixels.

The portable projection uses a 256-pixel focal length, centered horizontally and
within the configured height, with +Y upwards and +Z away. Local X, Y, Z rotations
are composed in that order, using JavaScript trigonometry; camera transformation
uses the inverse orientation. Near clipping uses Z=16. Quads split into triangles
and rasterize at pixel centers with interpolated inverse depth. Whole objects
are ordered by camera-space center Z; internal visibility uses a per-object
depth buffer. Block plane selectors and template face classes choose the indexed
colours, and surface details subdivide projected positions.

This implements a deterministic **portable profile**. Native fixed-point angle
composition/rounding, precomputed block precedence, blitter fill/boundary rules,
clipped surface details, coordinate scaling limits and pathological/interleaving
geometry need further native verification. The source-derived model/colour
interpretation and independent Python agreement do not establish Amiga parity.
No claim of support is made for arbitrary modeller objects.

## Evidence and next steps

`test/helpers/amos3DProgram.js` declares its setup and excerpt precisely: original
Gru1 Anim lines 1–5 and 36–55, preceded by a prepared double-buffered screen 1,
black background and disabled Autoback, followed by a key guard. The original
AMOS file remains unchanged. This executes 104 VBL frames, removes the car and
creates the hero. The preceding IFF scrolling and sprite sequence is excluded.

`tools/reference/amos-3d.py` independently decodes the supplied geometry and
computes six complete images with ray/plane intersections, rather than using the
runtime triangle barycentric interpolation. All 384,000 indexed pixels match.
Eleven unit tests cover asset hashes, token signatures, bad data, atomic failures,
relative motion, camera translation, buffer/mask ownership and original execution.
The browser scenario checks six real GPU frames against copper/CPU output,
checks Canvas output, and offers live playback with lifecycle/fullscreen controls.
These are portable/source-derived expectations, not native captures.

The complete Anim/Anim.Bak files now get beyond their 3D tokens. Their first
remaining compile error is `Move Y` (`$1ea6`, physical line 19); `Move X`,
`Move On`, `Anim` and `Anim On` also occur in that earlier sprite sequence.
They are distinct from AMAL. Supporting those commands is the next step toward
running the entire supplied intro, along with pinning its IFF, sprite and music
assets and testing the connected sequence.

Remaining AMOS 3D work includes other templates; position/attitude/visibility and
coordinate queries; Forward/Face/Bearing; animation strings and surface changes;
zones/collisions; backgrounds; loading/keep/priority options; and native rendering
verification. Unimplemented tokens continue to fail with their source locations.
