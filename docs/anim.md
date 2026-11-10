# AMOS Anim sprite sequences

`Anim channel,"(image,duration)..."` now installs the native STOS-compatible
animation record. This is a core AMOS feature; it is independent of the `Anim`
instruction inside an AMAL string.

[Play the drum harness](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-drums.html)
cycles the six original Protracker1 drum strings with its untouched embedded
sprite bank, using a declared synthetic three-phase scheduler. It uses the normal
WebGL application harness, including Play, Stop/Resume, Restart and fullscreen.
It is silent and does not claim to run the original music interface.
[Run browser checks](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-anim.html)
exposes sixteen Canvas/GPU frame pairs and 333 independent field/image checks.

## Syntax and bounds

| Token | Command |
| --- | --- |
| `$1f52` | `Anim channel,string` |
| `$1f22` / `$1f30` | `Anim On` / `Anim On channel` |
| `$1f0a` / `$1f1a` | `Anim Off` / `Anim Off channel` |
| `$1f38` / `$1f4a` | `Anim Freeze` / `Anim Freeze channel` |

Cached tokens retain their exact arity. Legacy Basic base-token operands use
the existing legacy parser policy. The numeric/bank/explicit-object overload at
`$1f60` remains unsupported.

Strings contain 1–256 `(image,duration)` literal pairs, optionally followed by
`L` or `Loop` for unlimited repetition. Decimal and `$` hexadecimal literals
accept 0–32767, with ASCII spaces around punctuation/literals. The string is
bounded to 32766 non-NUL Latin-1 bytes. Wider word wrapping, negative image
sentinels, expressions, native bank sources and other trailing syntax remain
gated. The parser verifies the complete string before replacing any record.

Channels share the existing captured `Channel` bindings. Automatic scheduling
allows 0–15; `Synchro Off` allows 0–63. Changing a binding does not retarget an
installed record. Bob/rainbow targets use the same existing resolver and
retirement rules as AMAL; the visual fixture exercises sprites 0, 2 and 6.

## Timing and lifecycle

Installing a record leaves it disabled. `Anim On` enables it, with its first
image written on the next animation field. Duration is measured in VBL fields:
`(2,2)(3,3)` writes image 2 at field 1, image 3 at field 3, and finishes at field
6. The last image remains displayed. A zero duration writes its image and ends
immediately, even if the list has a loop suffix. A completed record stays
installed; On does not rewind it. Replacement starts a fresh disabled record.

`Anim Freeze` preserves the frame index and remaining duration; On resumes it.
Off deletes the selected record or all Anim records. These commands operate
only on Anim records. `Amal On/Off/Freeze` operate only on AMAL records: notably,
`Amal Off` does **not** delete an independent Anim record. Inline AMAL animation
remains part of its AMAL record and keeps its existing controls.

Records execute in native channel/type order: AMAL channel 0, Anim channel 0,
AMAL channel 1, Anim channel 1, and so on. An Anim write due on the same field
therefore follows the same channel's AMAL write. Both share the driver-owned
VBL wake, manual Synchro and sprite/Bob publication path; rendering does not
advance either record. Snapshot diagnostics remain separate as `amalSnapshot()`
and `animSnapshot()`.

Host Stop freezes timers and held input, while Resume rebases the next field.
Sprite/Bob retirement removes affected records; Default, End/Edit and fatal
errors release both kinds and their wakes. Finishing the last active animation
cancels its wake while retaining its final image and diagnostic record.

## Native evidence and verification

The pinned official sources in
[`+Lib.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BLib.s)
and [`+W.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BW.s) provide the token forms,
`InAnim2`, `InAnimOn/Off/Freeze`, `AniStos`, `AmAnim`, `StAni`, `CreAMAL` and
`MvOAMAL`. Native record IDs are `channel*4+type`, with type 0 for AMAL and type
1 for Anim. Control masks are 1 and 2 respectively. `StAni` starts with counter
1, writes an image before its duration, ends on duration zero or sentinel -1,
and loops on sentinel -2. The bounded implementation emits no native memory
records and does not pretend to emulate DMA cycle timing.

`tools/reference/check_anim.py` independently generates cumulative interval
vectors for all six drum literals and pins the original source hash. Unit tests
cover those intervals, looping/zero duration, syntax preflight, replacement,
shared-channel execution order, independent controls, PAL/NTSC clocks,
Stop/Resume, manual synchronization, Default and sprite retirement. Browser
checks compare actual WebGL output with the CPU snapshot renderer, with the CPU
canvas-frame path disabled during GPU rendering. These are source-derived and
browser comparisons, not native Amiga captures.

## Original Protracker1 status

The complete original `Protracker.AMOS` compiles and runs with the recovered
`Data/mod.4spirits` loaded into a chip Work bank. Playback includes 9xx sample
offsets and E9x retriggers. The interface's voice toggles, volume/tempo arrow
controls, Stop/Resume and Mouse Key exit have browser coverage.

The recovered Modland file has no AMCAF effect-8 synchronization cells, so the
original text/drum callbacks remain inactive. The live drum harness cycles all
six original animation lists using its synthetic scheduler.
