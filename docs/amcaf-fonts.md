# AMCAF bank fonts and converter utilities

`amcafBankFont.js` reads the native `FONT` signature, relative bitmap/CharLoc/
CharSpace/CharKern offsets and TextFont header. It checks complete table and row
ranges before exposing an owned MSB-first atlas. Character widths and signed
bearings are separate from advances (`CharKern + CharSpace`). Missing codes use
the native extra glyph. Supported fonts are monochrome, 1–128 pixels high/wide,
with bounded bearings/advances; colour fonts are rejected.

Change Bank Font retains the selected bank object's identity, resolves live
bytes for text operations, survives Bank Swap and rejects a retired bank.
Malformed selection leaves the old font selected. Make Bank Font encodes the
selected graphics font completely before replacing its destination bank.
Change Print Font uses a separate live 2,048-byte MSB-first writer font.
New screens reset their selections. Change Font resolves an explicitly
preloaded named font and size; it does not invent a missing OS font library.
List Bank supplies portable bank numbers, lengths and names rather than fake
native addresses.

The original Fonts program uses an AROS-compatible 16-pixel font prepared by
`tools/reference/make_amcaf_fonts.py`; see the asset provenance/license under
`examples/AMCAF/fonts/`. The original Iva bitmap is independently addressed by
`tools/reference/check_amcaf_fonts.py`. The checked expanded bank hash is pinned
in that script. Regeneration takes its path as the first argument. Source-derived
pixels and GPU readback comparisons are distinct from native Amiga captures.

## Other commands exposed by the converters

Peek$ scans checked bank memory with a native 65,472-byte cap and an optional
first-byte delimiter. A delimiter can stop before an inaccessible byte; the
unbounded form preserves NUL bytes. Errors occur before assignment.
Stop raises AMOS error 9; it does not mean the host's resumable Stop button.
Binexp accepts bit indices 0–31 and returns integer bits. Itemstr$ implements
the native separator/index scan, including the first-item/no-separator final
character omission. Uncached extension base tokens accept only their declared
optional overload tails; cached signatures retain exact arities.

Pt Sam Play reads a selected chip sample bank's offset table and 14-byte record
header through checked memory. Its one-argument form claims all four voices;
other forms supply a voice mask and optional frequency. Negative sample numbers
loop the owned PCM. Pt Raw Play negative lengths use the same indefinite lease;
positive leases expire on VBL. Pause freezes leases, and Stop/End release owned
wakes and voices. Automatic negative voice selection remains unsupported.

Native references: AMCAF disassembly routines R08b/R08c/R08d for bank fonts,
R0bf for Itemstr$, R0fa–R0fc for Pt Sam Play, and R177 for raw playback;
AMOS `Lib.s` InStop and FnPeekD2/FnPeekD3. These references are retained under
`tools/reference/amcaf-v1.50beta4/` and the existing source-reference instructions.

The utility page wrapper finishes uploads before execution, replaces prepared
selection queues atomically, and creates downloadable blobs from the files
actually written by the original program. Owned blob URLs are revoked when
replaced or disposed. No source instructions or VM variables are patched.
