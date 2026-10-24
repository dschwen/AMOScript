# Non-HAM WebGL2 renderer

[renderer.js](../lib/display/webgl/renderer.js) implements actual GPU bitplane
decode and colour/sprite resolve for the current CPU snapshot subset. Chromium
passes 179 GPU/CPU frame comparisons, including Wonderland's executed original
title setup, four unmodified first-level game frames, three death-fade entries,
game-over/fresh-game frames, an independent attached-image
publication fixture, a PAL-wrap AMOS rainbow, eight independent lowres/hires scrolling
window patterns with different panel palettes, four independent palette-fade states,
the baseline planar fixture, 28 independent
ILBM image fields, 22 mode/sprite/copper matrices and 100 fixed-seed frames.
These are local SwiftShader results, not Amiga captures or hardware performance.

CommonJS exports `createRenderer(canvas, options)` and
`createRendererFactory(snapshotModel, spriteModel, createResources, createShaderSources, presentationLayout)`.
The browser script exposes `AMOS_WEBGL_RENDERER_FACTORY`. Factories take the same
dependency-free CPU model and [resource owner](webgl-resources.md) used by the
test harness. Generated AMOS modules retain their headless CPU runtime; GPU code
belongs to the browser adapter.

`render(snapshot)` validates the immutable ABI v1 input, owns/uploads its bytes,
and performs two fullscreen shader draws. Successful nonempty results report
`{ backend: 'gpu', passes: 2, revision, width, lines }`. Empty fields report
`gpu-empty` with no draws or logical pixels. `readPixels()` returns an owned
Uint8ClampedArray of current-field RGBA in canonical top-left row order. It reads
the colour framebuffer directly; CPU colour conversion and CPU fallback do not
produce those pixels. Normal drawing does not require readback.

## Canvas presentation

`present({ width, height, pixelAspect, integerScale })` draws `colourBuf` directly
to the WebGL canvas in a third shader pass; no CPU readback or Canvas 2D upload
is involved. Width/height default to the canvas drawing-buffer dimensions. The
shared [layout helper](../lib/display/presentation/layout.js) applies frame pixel
aspect (or a rational override), centers the image and fills unused space with
opaque black. Sampling uses nearest source-pixel centers and explicitly converts
storage rows to top-left canvas orientation.

Integer scaling is preferred on the reduced rational aspect grid. For example,
640×200 native samples with aspect 1/2 form a 640×400 integer cell grid; a
1280×900 viewport displays 1280×800 with 50-pixel top/bottom borders.
`integerScale: false` instead fits the largest contained rectangle. Undersized
viewports use nearest downsampling; returned `layout.integerScale` reports that
the actual factor is fractional. Layout and aspect results are owned/frozen;
viewport sizes are bounded to 16384 and the context capability limits.

The method returns backend/pass/layout diagnostics and preserves the native
framebuffer. Empty fields clear the canvas without inventing rows or draws.
This presents one current field; full interlace weaving remains separate. The
last requested viewport/options survive context loss, and restoration rerenders
and presents the latest owned frame before notifying the host. Calls never run
VM instructions or advance language time. The current application still uses its
Canvas host; backend switching/input integration remains open.

## Shader passes

[shaders.js](../lib/display/webgl/shaders.js) supplies GLSL ES 3.00 sources:

1. Decode reads R8UI chip bytes and R32UI line registers. Unsigned address math,
   MSB-first bits, per-plane pointers, odd/even scroll delays and signed fetch
   offsets produce the raw index in R16UI `indexBuf`. Bit 8 records an inactive
   window sample. Negative source bits are blank; negative window starts retain
   their sampling phase. CPU preflight checks the maximum visible fetch for each
   plane before drawing, preventing out-of-bounds GPU reads or address wrapping.
2. Resolve reads indices, line registers, palette and physical sprite rows. It
   writes RGBA8 `colourBuf`: normal lowres/hires, EHB four-bit halving, DPF odd/even
   splitting and PF2PRI, then eight-channel sprite priority/attachment. Each
   nonzero playfield can mask a sprite independently; sprite output is armed
   independently of DMA status. Sprites do not alter stored playfield indices.

The operations use integer texel coordinates and bitwise unsigned arithmetic
from the [GLSL ES specification](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf).
Palette bytes expand/resolve exactly, with blending and dithering disabled.
Storage row zero is semantic field row zero; the canvas presentation pass
performs its own Y conversion. No interpolation, scaling or CRT filtering is
part of the native decode/resolve comparisons.

Supported profiles match normal CPU OCS/ECS grids of two/four native samples per
lowres pixel, lowres up to six planes and hires up to four. Zero-plane lines,
borders, disabled playfield DMA, per-line resolution/palette changes and explicit
interlaced-field pointers are supported. GPU field presentation/weaving remains
separate; the existing explicit CPU field composer is unchanged. HAM, AGA,
superhires extended registers and mid-line events reject before uploading/drawing.
Planned modes and unfinished AMOS commands do not become implemented merely
because their data could fit these textures.

## Ownership and lifecycle

The resource owner now accepts named fullscreen passes through `addPass` and
`runPass`. It retains bounded shader source descriptions, rejects texture feedback,
recompiles passes after loss and deletes programs on disposal. A null pass target
selects the canvas drawing buffer; texture targets remain owned framebuffers. Inputs are texture
bindings plus unsigned scalar uniforms; output is an owned framebuffer target.
Custom passes share the owner's GL state and are not a separate scheduler.

During loss, rendering retains the latest valid snapshot and reports
`backend: 'unavailable'`, with no CPU fallback counted as GPU execution.
Restoration fully uploads owned data, recompiles both passes and rerenders the
latest field before reporting ready. Readback rejects lost/error/disposed state.
Rendering errors throw and invalidate the output result; invalid input leaves
the previous successful frame intact. `dispose()` releases all GPU/CPU resources.
`stats` records actual pass draws, successful GPU frames and the last result.

## Verification and remaining gates

The browser suite checks exact RGBA against both the CPU renderer and independent
PNG references. Sparse decode traces compare raw indices and window flags too.
Named matrices cover all 256 scroll-byte combinations at both resolutions and
positive/negative fetch offsets, all DPF depths/priorities, every documented
sprite/playfield priority combination, attachments, signed clipping, native grids,
mixed-resolution copper stacks, sprite DMA/reuse, signed modulos, palette changes,
texture-row boundaries and final chip bytes. The seed corpus varies valid modes,
pointers, palettes, windows, delays and sprites across all three chip capacities.
Unsupported mode/bounds tests verify no GPU draws; forced context restoration
checks actual rerendered pixels. Six additional presentation checks cover
integer/aspect/fractional/downsample layouts, orientation/borders, empty fields
and latest-viewport restoration. Hand-defined four-colour rectangles are compared
against actual drawing-buffer readback, and those outputs appear in the demo. `test/artifacts/gpu-copper-stack.png` records a
native GPU image.

Reproducible mismatches are reduced to a row and fewer planes/sprites where the
failure persists. The harness saves actual/diff PNGs and an automatically replayed
fixture in `test/fixtures/display/gpu-regressions/`, with CPU-reference expectations
explicitly labelled synthetic. A deliberate readback perturbation verifies this
reduction/replay path without inventing a real GPU failure.

Browser backend switching/live diff, HAM, mid-line
events, full interlace presentation, remaining ECS modes and target-device timing
budgets remain open. The full M7 gate still includes modes/captures that earlier
milestones have not supplied; current-subset parity does not close those gates.
