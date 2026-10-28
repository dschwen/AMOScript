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

See [Sqr semantics and evidence](../../docs/sqr.md) and the
[remaining Introideen plan](../../docs/introideen.md). Other supplied sources
and assets will be pinned with their own implementation slices.
