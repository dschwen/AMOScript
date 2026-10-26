# Tunneltest animation

`Tunneltest.amos` is a byte-for-byte copy of the user-supplied
`RII/Tunneltest.amos` (15,774 bytes, 26 physical lines). Its SHA-256 is recorded in
`test/fixtures/tunnel/frames.json`. It embeds an AmIc bank with 27 five-plane icons.

The original source requests `df1:intrtunic.abk` and `df1:intrtunnel`, neither of
which was supplied. The [browser preview](../../demos/tunnel.html) runs the entire
unchanged program with an explicit prepared file adapter: it supplies the embedded
icon-bank bytes for the former and a generated black ILBM for the latter. An IFF
picker lets you provide a background before restarting execution. Uploaded data
stays in page memory. This is not a capture of the missing original background.

The source uses eight-argument rectangular Screen Copy `$09a8` to restore a
95×30 region, then masked icon drawing, rotating wheel images, Screen Swap and
Wait Vbl. The independent Python oracle in `tools/reference/tunnel.py` decodes
bank bits directly and models 48 frames across both original ten-frame branches.
See [the rectangle contract](../../docs/screen-copy.md).
