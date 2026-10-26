# Tunneltest animation

The program and both external assets are byte-for-byte copies from the supplied
`RII/` directory:

- `Tunneltest.amos`: 15,774 bytes, 26 physical lines, embedded AmIc icon bank.
- `intrtunic.abk`: the external 27-icon bank loaded by the original source.
- `intrtunnel`: the original ILBM/ByteRun1 background.

SHA-256 hashes are recorded in `test/fixtures/tunnel/frames.json`. The
[browser demo](../../demos/tunnel.html) embeds these supplied files and runs the
entire unchanged source. Its synchronous adapter maps the original `df1:` paths
to those bytes. There are no default asset substitutes. An optional IFF picker
lets you try a custom background before restarting; **Use original background**
restores the supplied IFF. Uploads stay in page memory.

The source uses rectangular Screen Copy `$09a8` to restore a 95×30 region from
the original background, then masked icon drawing, rotating wheel images,
Screen Swap and Wait Vbl. `tools/reference/tunnel.py` independently decodes both
external file formats and models 48 frames across both ten-frame branches and
all 24 wheel images. Expected pixels are source/asset-derived, not Amiga captures.
The old blank IFF remains only a custom-upload test fixture.
See [the rectangle contract](../../docs/screen-copy.md).
