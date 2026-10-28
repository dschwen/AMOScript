# Polygon

`$0eba` implements the explicit-start, solid-fill form:

```basic
Polygon x1,y1 To x2,y2 To x3,y3
```

The signature-driven parser builds a coordinate-list AST without emitting code.
Lowering evaluates every coordinate left-to-right, once each, using the shared
numeric-to-integer conversion. Typed scalars/arrays, DATA, procedure results and
boxed Val values follow the same path. The command remains one ordinary display
instruction, with source-located errors and no scalar optimization batching.

The supported list has 3–16 coordinate pairs, each in signed-word range. An
implicit closing vertex counts toward the 16-point area buffer: an explicit
16-point list must finish at its first point. Polygon To, two-point forms,
wrapped coordinates, fill patterns and outline modes remain unsupported. The
whole numeric list is validated before pixel mutation. The compiler rejects
malformed lists and strings; unsupported runtime geometry halts normally.

## Portable raster profile

The initial solid profile fills pixel-centre interiors using even/odd crossings
and includes the closed boundary as canonical lower-Y-first Bresenham segments.
Horizontal segments run left to right. The boundary is solid, independent of
Set Line. Repeated vertices are accepted; collinear/point degeneracies paint
their boundary. Winding reversal does not change these rules. The logical bitmap
clips writes; its displayed window is not the drawing boundary. Signed-word
endpoints bound edge walks, and scanlines are restricted to visible bitmap rows.

This is a declared portable raster profile, not a claim of exact Amiga AreaEnd
pixel parity. The original AMOS handler delegates filling to graphics.library;
native tie rules, degeneracy and clipping differences require reference captures.

The original InPolygon calls AreaMove/AreaDraw/AreaEnd directly instead of the
GfxFunc drawing wrapper. Accordingly Polygon writes only the selected logical
buffer and bypasses Bob restore/redraw and Autoback replay, including Autoback 2.
Saved Bob backgrounds keep their existing buffer owners. Cursor positions,
Set Line phase, palette, selected screen and buffer identities are preserved.
Screen Swap publishes the result separately. Pattern/border state is not silently
inferred from Ink background/border parameters; its activating commands are gated.

## Evidence and original program

The assembled catalogue pins `$0eba`. Original
[InPolygon](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/%2BILib.s)
and [GetRas/GfxFunc](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/%2BLib.s)
establish the area calls and absence of drawing replay. The native Equ.s defines
AAreaSize as 16. The [manual](https://amospromanual.dev/06-04-graphics.html)
documents filled polygons and the optional cursor-start form, which remains gated
here. For external-library evidence,
[AROS AreaEnd](https://github.com/aros-development-team/AROS/blob/59b6c2433bc92d1d449b76bc8ce27373465d5157/rom/graphics/areaend.c)
preserves the graphics cursor and notes raster-direction edge issues. It is
another implementation, not a native Amiga oracle.

`python3 tools/reference/polygon.py` regenerates the independent matrices in
`test/fixtures/polygon.json`. Python Fraction classifies pixels individually;
closed-form rounded major-axis positions provide boundaries independently of
the runtime scanline/error-step loops. Cases include rectangles, triangles,
concavity, crossing edges, winding reversal, repeated vertices, clipping,
degeneracies and signed-word extremes. Tests also cover typed expressions,
ordered callbacks, validation, buffer ownership and all Autoback modes.

The pinned unchanged KugelanimBerech.Bak executes all eight original iterations,
finishing after 191,160 instructions and writing `df1:kugel010` through
`df1:kugel017`. An independent IFF decoder checks every saved pixel against
the rendered logical bitmap. This validates saving the rendered output, not an
independent whole-sphere golden or native picture capture. No source rewrites,
VM variable/IP edits or prepared bank state are used.

The [browser demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/polygon.html)
checks 2,304 independent matrix pixels, 512,000 saved-frame pixels, 12 actual GPU
comparisons and all eight exact-byte Debug downloads. CPU presentation is blocked
during GPU rendering. Session files remain volatile; downloads export copies.
