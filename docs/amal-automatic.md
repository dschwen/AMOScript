# Automatic AMAL and GALAX play startup

GALAX installs its enemy, shot and ship AMAL programs without `Synchro Off`.
Automatic mode is the default in AMOS. The runtime now supports it without
changing the original source. The [game page](../demos/compiler-example-galax-galax.html)
and [regression demo](../demos/galax-play.html) include the new runtime.

## Clock and ownership

Enabled programs advance once per PAL/NTSC VBL field on the injected VM clock,
including while Basic is sleeping or waiting for a key. A driver-owned timeout
runs independently of rendering. The normal instruction path reconciles due
fields too, and optimized blocks yield to ordinary dispatch while AMAL is active.
There is no immediate interpreter pass at installation or `Amal On`: the first
pass belongs to the next field. Explicit `Synchro` does nothing in automatic mode.

Each field runs the existing ordered Autotest/main/Anim lanes, then ordinary
automatic Bob/Sprite publication. `Update Off` retains logical-only movement
until an explicit Update. Rendering never advances AMAL. `Synchro Off` cancels
the automatic wake; explicit Synchro retains the manual behavior. `Synchro On`
restores clocked operation with the existing program state. Automatic installations
use channels 0–15, matching native MvA3's interrupt limit; manual mode retains
channels 0–63. Switching to automatic mode with higher installed channels rejects.
BC remains manual-only and reports a source-located error in automatic mode.

Stop cancels the owned wake and preserves interpreter state. Resume starts from
the next current field, without replaying the stopped interval. Freeze disables
programs while retaining them; On continues them. Off, target retirement,
replacement, Default and terminal End/Edit/failure retire their owned work.
Invalidated timeout tokens make late callbacks inert even if a timer host cannot
cancel them. Runtime failures retain the AMAL channel, character and installation
source location. Catch-up is bounded to 250 fields; larger gaps fail explicitly.
Page speed multipliers affect Basic waits, not this clock or sound pitch.

## Recorded PLay movement

GALAX also needs `PLay expression` inside its enemy programs. This is recorded
coordinate movement, separate from tracker/sample/music playback. It uses the
checked `Amal    ` data bank at slot 4. The bank has a big-endian recording count
and word-offset table after its initial long; each nonempty record supplies a
field speed and separate X/Y byte streams. The initial long belongs to banked
AMAL source strings, which are not implemented here.

Positive bytes contain signed seven-bit deltas; negative bytes hold that axis for
the low seven bits plus one step. Zero terminates movement. X is processed first,
so a terminal X byte skips Y, while a terminal Y retains that pass's X update.
PLay suspends the main lane until completion while Anim continues. Following
AMAL instructions run in the same terminating pass. Selectors
zero, absent entries and out-of-table selectors fall through, as native AmPli does.

The supported profile checks at most 1,024 table entries, signed native index
offsets, forward streams and speeds 1–32,767. Both stream terminators and complete
header ranges validate before the first coordinate write. Active raw-memory writes
reject through the shared bank-memory guard; replacement/erase/swap/shrink is detected
before the next PLay step and fails with source context. Stop preserves the bank
and stream counters. Missing movement banks reject at installation. Autotest PLay,
reverse recorded playback, live bank editing and banked AMAL strings remain gated.

## Evidence

`tools/reference/galax-movement.py` independently expands both axes before combining
them, producing 4,444 positions for all fifteen original recordings. Unit checks
cover every position, PAL/NTSC clocked playback, signed deltas, wait-byte and speed
boundaries, malformed banks, active writes, mode changes, Stop/Resume, frozen and
retired channels, delayed/late wakes and asynchronous cleanup. Existing manual
Zybex fixtures remain required.

The shared browser probe checks all fifteen paths and 36 actual GPU/reference
frames. Its separate complete-source replay selects game `1` at the original
menu, moves right and left, fires, loses one life to a natural collision and
starts the next life with all sixteen channels. It changes only input and time;
no source slices, variable/IP edits or bank patches are used. The default memory
metadata chooses GALAX's silent music branch. The probe's isolated recording
previews use declared Sprite/AMAL setup, independently of the connected game.

This covers playable startup and one death/restart, not all three stages, victory,
the map editor, music or native timing fidelity. Native source references are W.s
SyncO/Sync, the VBL Animeur call, AmPlay/AmPli/AmPl0/AmPWx/AmPWy, and Lib.s MvA3
at official revision `533b4b1f5acd604814513f78e02c7b4796cb0531`. These are source and
portable-browser checks, not Amiga captures.
