# AMCAF Pt Sam Stop

`Pt Sam Stop mask` is registered at offset `$1400` in the explicitly selected
`amcaf-1.50beta4` compilation profile. It evaluates one numeric expression and
uses its low four integer bits: 1, 2, 4 and 8 select Paula voices 0–3. Negative
values follow the same bit selection; -1 selects all four.

The recovered R0f7 routine at `$5e70..$5eb0` sets each selected tracker ownership
byte at offsets 14–17 to `$ff`, clears its DMACON bit and writes zero to its
volume register. The ISR at `$8b90` derives enabled music channels from the
ownership bytes; later note triggers write the DMA enable mask. This means
cancellation releases the voice to music rather than permanently excluding it.
Source evidence is in the [recovered disassembly](../tools/reference/amcaf-v1.50beta4/disassembly.txt)
and [manual](../tools/reference/amcaf-v1.50beta4/manual.md).

The portable PCM renderer deactivates selected fetches and zeroes their volume.
It retains the song's sequencer state and channel mask. Subsequent tick register
writes may restore volume, but only a new DMA trigger makes a voice active again.
An instrument-only repeat-pointer change or portamento does not restart it.
The playback controller advances and flushes elapsed fractional-field PCM before
cancellation. The audio adapter receives an ordinary mask-specific stop, which
cancels queued nodes for those voices. Paused playback preserves its frozen clock.
With no active AMCAF tracker, cancellation uses the shared sample controller.
Mixing this command with AMOS Music or Track Play remains explicitly unsupported.

Tests cover compiled dispatch, low-bit masks, continuing driver wakes, active
bank write protection, pause/resume, unaffected channels, and retrigger after an
instrument-only change and portamento. The existing [compiled AMCAF demo](../demos/amcaf-vm.html)
now accepts Q to stop voice 1 and another Q to end music. Its browser check also
uses a separate native OfflineAudioContext to verify selected-channel silence
and continuing opposite-channel output. These are source-derived semantics and
browser audio evidence, not an Amiga hardware capture. Pt Raw Play/Pt Sam Bank,
raw sample ownership, and exact DMA timing are still open.
