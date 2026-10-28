# Introideen source fixtures

`Kugel.amos` is a byte-for-byte copy of the supplied `introideen/Kugel.amos`:
662 bytes, SHA-256
`881ef539bb8f9bd0db7cd87915ad2ec74fe4e5a02f021a5874fb4515ca947d0e`.
Its 18 original lines shade a sphere with Sin, Cos and Sqr. It has no external
assets or embedded banks. The original untracked directory is left untouched.

The program now compiles, but does not finish drawing: at GX=89/GY=42 its integer
P becomes -1, and the first Plot on line 14 rejects that colour (byte 520).
This follows the original negative-colour guard; no clamp or source edit is
applied. The [Sqr demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/sqr.html)
retains the partially drawn frame and explains the stop.

`RollerIIIntroIdee.amos` and `R.abk` are also unchanged copies from `introideen/`.
SHA-256 hashes are recorded in `test/fixtures/zoom.json` and verified by the
original-program regression. The 49-line intro loads `df1:r.abk`, builds 16
icons using Zoom/Get Icon, animates nine letters through 29 Screen Swaps and ends
after its final key prompt. No source fixes or prepared VM state are used.
Its [browser demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/zoom.html)
embeds the source/asset and independently checked captured frames.

`KugelanimBerech.amos` is an unchanged copy of the supplied current generator;
its hash is pinned in `test/fixtures/save-iff.json`. Unlike Kugel, this source
explicitly clamps negative P to zero. It renders one sphere, waits for a key,
saves the literal filename `rollerball` and ends. The browser
[Save Iff demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/save-iff.html)
checks saved pixels and offers the file through its Debug download menu.

`KugelanimBerech.Bak` is also unchanged; its hash is pinned in
`test/fixtures/polygon.json`. Its solid polygons now render eight sphere images,
saved as `df1:kugel010` through `df1:kugel017`. The
[Polygon demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/polygon.html)
checks the portable raster profile, rendered/exported pixels and GPU frames,
and offers all eight files through Debug downloads. Native AreaEnd pixel parity
remains a separate capture gate.

See [Sqr semantics and evidence](../../docs/sqr.md),
[Polygon semantics and evidence](../../docs/polygon.md),
[Save Iff semantics and evidence](../../docs/save-iff.md),
[Zoom semantics and evidence](../../docs/zoom.md) and the
[remaining Introideen plan](../../docs/introideen.md). Other supplied sources
and assets will be pinned with their own implementation slices.

`Logoanim.amos`, `Logoanim.Bak`, `KugelAnim` and `introroller` are unchanged
copies pinned in `test/fixtures/anim5.json`. Both intros load eighteen frames,
play through their original double buffers/waits, copy the logo and finish on
mouse input. The [ANIM-5 demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/anim5.html)
also checks all twenty asset frames and loop buffers. See [the contract and
independent evidence](../../docs/anim5.md); native captures remain open.

`ASCIIPC.Bak`, `LetterQualityProcs.amos` and `LetterQualityProcs.Bak` are unchanged
copies pinned in `test/fixtures/open-port.json`. Their complete parallel output
matches independently transcribed streams (2,409 / 178 / 3,074 bytes). The
[Open Port demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/open-port.html)
offers exact raw `.prn` downloads and hexadecimal inspection. See [the adapter
contract](../../docs/open-port.md); physical printing and PCL rendering are open.

`RolIntrIdee2.amos`, `RolIntrIdee2.Bak`, `rolIntr` and `RolIntrSam.abk` are unchanged
copies pinned in `test/fixtures/screen-slide.json`. Both slide screens from above
and below the display, reveal the image and finish after a key. The newer source
also clears strip regions and plays two samples; the backup preserves the image
strips and is silent. The [live sliding-screen demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/screen-slide.html)
includes both versions, sound, pause/resume and fullscreen. See [the clipping
contract and independent evidence](../../docs/screen-slide.md).
