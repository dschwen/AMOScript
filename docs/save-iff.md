# Save Iff

`$0afc` implements `Save Iff filename$`. The filename expression evaluates once
through ordinary signature lowering. The command resolves Dir$ once, serializes
the selected logical bitmap completely and calls synchronous `files.write` once
with an owned byte string. Unsupported state rejects before that callback, so
validation cannot truncate an existing destination. Adapter errors/Promises halt
with the source location; adapters own their transaction behavior after the call.

## File profile

The pure `lib/display/model/ilbmWriter.js` writer embeds in standalone factories
without imports. It writes FORM ILBM with BMHD, CAMG, AMSC, CMAP and BODY, in that
order. Supported modes follow the current model: normal lowres, hires up to four
planes, EHB and HAM6. Full bitmap rows are retained, with word padding and zero
right bits. Hardware sprite/rainbow output is not part of the bitmap.

InSaveIff1 establishes default compression 1. ByteRun1 packets are limited to
128 bytes and never cross planar rows. Packet selection is deterministic and safe,
not a byte-for-byte reproduction of the native compressor's heuristics/lookahead.
Chunk lengths exclude external odd-byte padding; FORM includes it. Native writer
quirks are not substituted for canonical IFF boundaries.

BMHD stores opaque/no-mask pixels, zero origin/transparent index, aspect 20:22 in
lowres or 10:22 in hires, and the model's live window dimensions as page size.
CAMG records resolution/HAM/EHB; CMAP records all 32 palette registers with native
four-bit channels in each byte's high nibble. AMSC stores hardware position,
hardware-width window size, height, offsets and hidden flag `$8000`. Pending native
requested-versus-committed page-size timing remains unverified.

Saving reads raw logical pixels/base palette without changing selection, buffer
identity, drawing/Bob/Autoback state or running palette jobs. Flash/Fade jobs and
display composition are not serialized. Double-buffered/cloned screens are gated
under the manual's bounded usage restriction. Dual-playfield/interlaced screens
remain outside the current command model. The two-argument token `$0b0c` remains
unsupported; low-level writer compression 0 exists for serialization tests, not
as another accepted language form. Encoded output is capped at 16 MiB.

Export supports more metadata than current explicit-screen Load Iff placement:
the ILBM reader can inspect the file, but Load Iff still rejects unsupported
hidden/offset/hires AMSC restoration. Its bounds are unchanged. The original
generator's default lowres geometry does reload.

## Evidence and original generator

The original [InSaveIff1/2 and IffSaveScreen handlers](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/%2BLib.s)
establish compression, logical planes and chunks. The
[manual](https://amospromanual.dev/06-01-setting-up-screens.html) documents usage
and buffering limits. Canonical boundaries follow the
[ILBM specification](https://wiki.amigaos.net/wiki/ILBM_IFF_Interleaved_Bitmap).
These are source/format-derived expectations, not Amiga execution captures.

`python3 tools/reference/save_iff.py` regenerates independent full-byte fixtures:
a 17-pixel-wide multicolour bitmap and a compressed literal with odd BODY length.
A separate test decoder imports no production codec. Tests cover packet limits,
modes, metadata/palette, prefix retention across callbacks, validation before
writes, typed filenames, factory isolation and source-located host errors.

The pinned unchanged KugelanimBerech program renders with its original shading,
Rnd calls and explicit negative-colour clamp. It waits at line 32, writes
`rollerball` and ends. Independently decoded file pixels equal the rendered
bitmap, and a separate Load Iff preview reloads them. No VM/bank edits are used.
This verifies serialization, not an independent sphere-image golden.

The [browser demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/save-iff.html)
uses a real Canvas key, checks 128,000 Canvas pixels and two actual GPU comparisons,
and verifies exact Debug-download bytes. The shared Debug menu owns/revokes its
Blob URLs. Files remain in session memory; IndexedDB persistence is still planned.
