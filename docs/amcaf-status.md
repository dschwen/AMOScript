# AMCAF Protracker status and VU queries

[Run the standalone status demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-status.html).
The synthetic compiled program selects extension slot 19 and prints two reports
while music advances on the driver's field clock. Both original Protracker interfaces compile these functions. Protracker2 now
runs; the first version now compiles but its recovered tune needs 9xx/E9x playback effects.

## Native meanings

| Function | Implemented result |
| --- | --- |
| `Pt Cpattern` | Current order-table slot, 0..127; not the physical pattern number selected by that slot. |
| `Pt Cpos` | Next row position, 0..63. Processing a row increments this before the next VM query. |
| `Pt Cinstr(voice)` | High nibble of byte 2 in that voice's current encoded cell. This is the low four instrument bits, not the last retained playing instrument. A cell without an instrument returns zero. |
| `Pt Cnote(voice)` | Integer frequency `floor(3546895 / storedPeriod)`; zero for no period. This reads the base period, not vibrato/arpeggio output, and uses the same native constant in PAL and NTSC profiles. |
| `Pt Vu(voice)` | Read and clear that channel's pending volume byte. This is a latched register intent, not a PCM peak/RMS meter. |
| `Pt Signal` | Read and clear the global signal byte. Natural song completion/backward order jumps set 255; AMCAF effect 8 writes its parameter byte. |

The recovered implementations are R0f0..R0f3 (`$5d2e..$5db6`), R104
(`$607e..$60a2`) and R10c (`$61dc..$61f2`) in the pinned 1.50beta4 disassembly.
The current-cell instrument nibble behavior, including instrument 17 reading as
1, follows that code. It is not silently changed to a full instrument number.

Channels are bounded to 0..3. Native out-of-array byte aliases and Cnote DIVU
overflow are explicitly unsupported. Ordinary note-table values fit the checked
frequency range. Before the first module starts, the portable per-factory query
state returns zero; no native uninitialized-memory behavior is claimed.

## Latches and timing

New instrument cells update VU when their music voice is enabled. Cxx updates
VU only when the same cell also has a note. A new note without an instrument
does not itself refresh VU. Instrument-only Cxx therefore retains the instrument
volume latch even though stored playback volume changes afterward. Masked
register writes leave any unread latch intact. Later writes replace earlier
ones; the latch does not accumulate a maximum. Master-volume changes do not
retroactively rescale an unread byte.

Effect 8 is the AMCAF synchronization byte, not generic tracker panning. It runs
on the row tick, independently of music voice masks. Later channels can replace
an earlier signal in the same row. Backward-jump/end signals can also overwrite
it. Reading a signal does not reset diagnostic song-wrap counts.

Reads use the most recently processed music tick. They do not advance the
player to wall time, poll a browser/device, call the audio host, allocate sample
snapshots, or install their own wake. Instrument/frequency/position queries are
nondestructive. VU/signal reads clear only the corresponding private latch.
Pause freezes the producer; pending values can still be read. Pt Stop and bank
retirement preserve the final owned query state, including consumable latches.
A successful new Pt Play starts fresh state. Failed playback validation leaves
the previous state intact.

## Evidence and remaining work

Unit checks use deliberately reordered patterns and literal expected values,
including next-row position, the low instrument nibble, native frequency units,
base versus vibrato period, instrument-only Cxx, last-write volume semantics,
masked latches, unsigned 255 signals, invalid-channel preflight, and post-Stop
retention. One thousand queries leave ticks and published state unchanged.

The browser demo runs an actual compiled program through two field positions:

```text
order row instrument frequency VU VU-again signal signal-again
0     1   1          8287      32 0        0      0
0     9   2          8287      20 0        0      0
```

These are independent source-derived checks and browser execution, not Amiga
captures. Hex$, Turbo Draw, Blitter Fill and plotting/wait forms now also
support the unchanged Protracker2 interface. The first Protracker version
now compiles unchanged; its recovered tune still needs 9xx/E9x playback effects.
