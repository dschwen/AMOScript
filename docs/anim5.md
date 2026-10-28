# ANIM-5 and Logoanim

The unchanged `Logoanim.amos` and `Logoanim.Bak` now compile and finish their
original 18-frame sphere animation, logo-copy sequence and mouse exit. The
[repository demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/anim5.html)
contains both programs and the supplied assets. It checks all 20 stored frames,
including the two loop buffers, and Stop/Resume. This is independent decoder and
browser evidence, not an Amiga capture.

## Language and bank contract

Implemented encodings are `$25e0`, `N=Frame Load(channel To bank,count)`, and
`$25ec`, `F=Frame Play(bankOrAddress,count)`. Both return integers and remain
effectful calls across optimizer boundaries. The two-argument Frame Load and
three-argument Frame Play encodings remain unsupported.

Frame Load uses an existing Open In channel at its current byte cursor. It
validates the selected prefix before replacing the destination or advancing the
cursor. Counts are 1–32767 and bank numbers 1–1023. It returns the actual loaded
count, which may be smaller at end of animation. The cursor advances past the
last selected nested FORM, not automatically past unrequested frames.

The bank is a temporary fast/work generic bank named `Iff     `. Its raw bytes
are the selected original nested ILBM forms followed by the native `AenD`
sentinel; the outer ANIM wrapper is omitted. Start/Length and byte reads expose
this representation. Frame Play accepts the bank number or a checked virtual
address at a frame boundary and returns the next frame address. Reaching AenD
returns its address unchanged; count zero performs no drawing. Counts are
0–32767. Addresses are ordinary per-factory bank-memory addresses, retained
through bank swaps and retired on replacement/erasure.

Decoded metadata belongs to the bank identity. Raw writes and size changes to
these managed banks reject; direct host changes are detected before playback.
Saving generic bytes does not serialize private decoded metadata: reloading an
ABK does not create a playable animation bank. Loading into a raw address,
mutable animation banks and restored-bank playback remain open.

## Decoder and logical display

`lib/amos/anim.js` is a synchronous, owned-byte reader embedded in generated
modules. It accepts FORM ANIM containing one full ILBM followed by operation-5
ANHD/DLTA frames. The initial bitmap uses the existing ILBM/ByteRun1 reader.
Delta offsets are sixteen big-endian longs; each plane stream contains bounded
byte-column skip, repeated-value and literal runs. Every selected frame is
validated before installation. Plane pointers, stream ends, dimensions, run
lengths, duplicate chunks and unsupported flags are checked.

The reader reconstructs canonical full frames using interleave 1 or 2; encoded
zero means two frames back, with frame two based on the first image. `KugelAnim`
contains 20 frames: the last two repeat the initial two for looping. Logoanim
explicitly requests 18. The reader retains both full pixels for verification and
raw delta stores for execution.

Frame Play applies those stores to the **current logical bitmap**. It does not
repair or select history buffers. The caller initializes buffers and owns
Screen Swap, Wait and Wait Vbl. This preserves ordinary drawing in untouched
regions and native live-buffer behavior. The initial full frame copies its
pixels and explicit palette; subsequent deltas preserve other pixels/palette.
Exact bitmap size, depth and supported mode must match before any writes.
Bob/Autoback hooks are bypassed, with no implicit swaps, private wakes or
playback scheduler. Indexed logical pixels remain authoritative; existing
snapshot generation supplies planar chip buffers to Canvas/reference and WebGL.

The subset caps input at 16 MiB, selected frames at 256 and decoded retained
data at 64 MiB. Masked/laced/AMSC initial frames, different delta geometry,
nonzero ANHD flags/masks, delta palette changes and operations other than 5
reject. General ANIM properties, XOR, other compression methods, native timing
and native captures remain open. ANHD delays are metadata; source waits control
these programs.

## Inactive ILBM metadata needed by the logo

The supplied `introroller` is a 320×70, five-plane image with transparent-colour
metadata and an inactive DRNG. Ordinary Load Iff copies transparent-colour
images opaquely, including zero pixels, as the native screen loader does. Actual
mask planes and interlace remain unsupported by Load Iff.

The ILBM reader retains validated DRNG records with flags exactly zero: bounded
cell indices, signed rates, RGB cells and palette-register cells. Records are
frozen metadata and start no palette job. Active/reserved flags reject. This
also removes IconCutter's inactive-DRNG startup blocker without stripping its
original chunk. Animation's initial bitmap retains its stricter masking gate.

## Evidence and reproduction

- `tools/reference/anim5.py` independently decodes ByteRun1, plane-column runs
  and two-buffer history. `test/fixtures/anim5.json` pins all four supplied files
  and all twenty indexed/RGBA frame hashes. Run `python3 tools/reference/anim5.py`
  to regenerate it.
- `test/anim5.test.js` covers stream bounds, banks/cursors, continuation and stale
  addresses, raw logical writes, overload gates, isolation, both complete sources
  and Stop/Resume.
- The shared `anim5` browser scenario checks 1,280,000 independent asset pixels,
  36 original-program sphere frames and 16 actual GPU comparisons. Both source
  exits use host pointer input; there are no VM variable/IP/bank edits.

Semantics follow the pinned AMOS source revision
`7f32e0abe1b6b415c9502b598cd3e4cb131018f8`, notably FnFormLoad3,
IffFormLoad, IffFormPlay, IffDLTA and IffBODY in
[Lib.s](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/%2BLib.s).
The [ANIM format](https://wiki.amigaos.net/wiki/ANIM_IFF_CEL_Animations),
[DRNG format](https://wiki.amigaos.net/wiki/ILBM_IFF_Interleaved_Bitmap#ILBM.DRNG)
and [AMOS animation manual](https://amospromanual.dev/07-05-iff-animation.html)
provide the container/history, inactive-range and public function contracts.
