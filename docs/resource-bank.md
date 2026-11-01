# Resource Bank ($28ca)

`Resource Bank n` selects the Interface resource bank for subsequent resource
consumers. The compiler accepts one numeric expression and emits the ordinary
runtime operation; parsing has no bank or display side effects.

The runtime converts the expression to an AMOS integer, rejects negative
selectors before changing state, and stores the full nonnegative longword.
A fresh program starts at zero, meaning system resources. Selection is local
to each program factory instance. `program.resourceBank()` exposes the stored
number for host inspection; it is not an AMOS expression or a bank lookup.

The native `InResourceBank` routine only stores `IDia_BankPuzzle`. Bank existence
and the Resource header are checked later by `Dia_GetPuzzle`. Selecting an
unloaded bank is therefore valid: the original Sliders tutorial selects bank16
before its Load statement. Replacement, swap and erasure retain the numeric
selector rather than pinning a bank object. Selecting zero likewise does not
attempt to read system resources immediately.

`test/resource-bank.test.js` checks the exact token, numeric conversion, failure
locations, independent VMs, bank lifecycle and Stop/Resume. Eight declared
startup fixtures retain the original first twelve source lines and append a
Wait Key guard before Resource Screen Open. They load the supplied Resource
bank and verify the original selection order, including Sliders. The ninth
program, Full_Example, has earlier external music/sample dependencies and is
checked for compilation diagnostics rather than claiming its startup ran.

All nine complete Interface tutorials now reach unsupported token `$28ee`,
Resource Screen Open. Resource graphics, default system-resource data, dialogue
execution and resource queries remain separate work. This selector support
does not make the Interface programs playable yet.

Native references: `InResourceBank`, `Dia_WarmInit`, `Dia_GetPuzzle` and
`Dia_GetDefault` in
[the pinned official +Lib.s](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BLib.s).
