# AMCAF raw sound effects

The explicitly selected `amcaf-1.50beta4` profile implements:

- `Pt Raw Play mask,address,length,frequency` at `$1412`.
- `Pt Sam Bank bankOrAddress` at `$142a`.

These finish the 18 extension encodings used by the supplied Ghostlight source.
The complete unchanged file compiles. [Interlaced Unpack Screen](interlaced-unpack.md)
now creates its original atlas and the private WebGL page reaches level 1 with
music. A bounded second-fire check uses a match without an error; sustained
gameplay and completion remain unverified.

## Raw playback and channel ownership

The source evidence is R0f8/R177 (`$5eb0`, `$86d2..$87fa`) and the VBL callback
at `$1da0..$1e14` in the [recovered disassembly](../tools/reference/amcaf-v1.50beta4/disassembly.txt).
For positive explicit channel selectors the low four bits select voices 0–3.
A zero signed voice word or zero length is a no-op. Other zero low-four-bit masks
also do nothing in this portable subset.

Lengths are rounded down to whole words. This subset requires 2..131070 bytes
after rounding, avoiding Paula's special zero-word fetch and 16-bit length wrap.
The complete range must belong to one live generic chip-memory bank, at an even
virtual address. Reads use the existing checked bank-memory resolver; no native
machine pointer or display-memory alias is introduced. Validation precedes
channel changes. Samples are copied into owned PCM, so later bank writes or
retirement do not change an effect already playing. This is an explicit portable
snapshot policy; live mutable DMA and exact Paula word prefetch remain open.

Frequency uses its signed low word, clamped to 400..30000 Hz. The hardware period
is `floor(3579545 / frequency)`, including on PAL: that constant is in the AMCAF
routine. Actual PCM stepping uses the selected PAL/NTSC Paula clock. Raw volume
starts at 64, independently of the music master volume.

Selected channels stop their current DMA fetch, start the raw sample, then fetch
silence after its end. Music continues to advance its sequencer, but its register,
trigger and repeat writes cannot replace the raw channel during ownership. The
source-derived lease is `floor(wordLength * 100 / frequency) + 1` VBLs. Each VBL
decrements it, regardless of CIA music tempo. Expiry disables that DMA channel
and returns it to music control; a subsequent music note can restart it.
`Pt Sam Stop` releases selected effects immediately. This is not permanent music
masking or replay of missed notes.

The playback controller schedules both music interrupts and lease VBLs, renders
PCM up to each boundary, and freezes effects and counters during host Stop.
Resume preserves sample phase and opens a new host timeline. A coincident VBL
release precedes the music tick in this portable scheduling policy; no exact
Amiga interrupt ordering is claimed. With no MOD active, the same controller
runs raw effects without creating a synthetic song and owns only selected voices.
After the last lease expires it has no pending wake, though the installed
controller remains available until Pt Stop or replacement. Ordinary Music/Track
Play mixing, negative automatic voice selection and negative looping lengths
remain explicitly gated. The latter needs particular care: the recovered raw
entry negates D7 rather than its D0 length register, unlike Pt Sam Play.

## Sample-bank selection

R0f9 (`$5ec4..$5ed6`) resolves a bank or address and stores the resulting pointer.
It does not verify a Samples header. The implementation similarly resolves a
checked virtual address and records it in `state.audio.ptSampleBank`, separate
from the standard AMOS Sam Bank setting. Generic banks containing on-disk ABK
bytes are valid selections. Selection does not read a sample, change sound or
make Pt Sam Play supported. Pt Raw Play uses its own explicit address.

## Evidence and demo

Unit tests cover standalone compiled dispatch, raw-only execution, owned bytes,
word/frequency arithmetic, bounds and preflight failures, independent channels,
register suppression, VBL release and pause/resume. Synthetic PAL/NTSC PCM vectors
check signed byte scaling and pitch. The [compiled AMCAF demo](../demos/amcaf-vm.html)
uses only synthetic assets: press Q to stop voice 1, Q again to play a raw effect,
and Q again to end. Its browser checks compare 4,000 raw waveform samples through
an OfflineAudioContext, exercise real page input and retain Stop/Resume/Restart
coverage. Source-derived expectations and browser graph checks are not native
Amiga captures. Ghostlight source, assets, modules and HTML stay in the separate
private project outside this repository.
