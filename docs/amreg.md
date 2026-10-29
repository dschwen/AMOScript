# Global AMAL registers

`Amreg(index)` ($1fa2) reads or writes one of 26 global AMAL registers, RA–RZ.
Each program factory owns a fresh zeroed **signed 16-bit** register array. Stores
retain the low word; reads sign-extend and have integer expression typing. Index
0–25 is checked, source expressions evaluate through ordinary numeric lowering
and failures retain their line/byte locations. Register values remain inspectable
after End; no interpreter, wake or channel is created by a register access.

The [manual AMAL controller](amal.md) shares this storage; it does not acquire
a separate shadow set of globals.
[Channel routing](channels.md) now has separate checked selector storage.
The two-argument Amreg overload remains unsupported. Installed AMAL programs
now have private locals and bounded manual execution; see [AMAL](amal.md).

Planet Zybex's original `clear_amal` now executes in a declared fixture retaining
its Global/array setup and complete procedure. With inputs RJ=1234 and RU=4, it
saves score/bullet count, zeroes all globals, marks RB–RI as 100, then restores
RJ/RU. All 26 results are checked in unit and browser scenarios. This is an
isolated communication test, not the game's main loop. Other tests cover signed
word wrapping, integer division, factory isolation, type/bounds failures and the
unsupported two-argument encoding.

The native implementation explicitly stores `move.w` and returns a sign-extended
word in IAmR/FAmR/AmRR in
[+Lib.s](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BLib.s).
The one-argument form addresses globals; the other encoding addresses a channel's
local registers. No native startup-memory or full AMAL compatibility is claimed.
See [the Planet Zybex milestone](planet-zybex.md).
