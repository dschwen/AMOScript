# Interface dialogue channels

`Dialog Open` ($2720/$2736/$2742), `Dialog Close` ($2750/$2764), `Vdialog`
($27a4), `Vdialog$` ($27b6), and `Edialog` ($2804) now compile into the standalone runtime. Opening prepares a string
program on the selected screen; it does not draw, execute `SetVar`, or activate
buttons. Execution via `Dialog Run` and modal `Dialog Box` is the next stage.

The opening signatures are:

```
Dialog Open channel,script$
Dialog Open channel,script$,nvar
Dialog Open channel,script$,nvar,buffer
Dialog Close channel
Dialog Close
Vdialog(channel,index)=42
Vdialog$(channel,index)="text"
value=Vdialog(channel,index)
text$=Vdialog$(channel,index)
position=Edialog
```

Channels must be positive longwords and cannot replace an existing channel.
The defaults are `nvar=16` (17 initially zero values, indices 0–16) and a 1024-byte
buffer. Buffers round down to an even size after the native greater-than-256
check. This portable subset bounds nvar to 65535, each buffer to 1 MiB, and total
logical channel storage to 16 MiB. Closing releases a channel or all channels;
a missing numbered channel errors. Default also closes channels. Stop/Resume
preserves prepared channels without scheduling input or animation work.

`lib/amos/interface.js` performs a bounded opening verification pass. It retains
instruction and postfix-expression tokens, quoted Latin-1 strings, source offsets,
labels, nested blocks and user-instruction declarations. Lowercase expansions
and comments outside strings are ignored, matching the two-uppercase-letter
language. Duplicate labels, malformed arguments/strings/blocks, unknown expression
tokens, unresolved user instructions and exhausted label buffers fail before a
channel is published. Expressions are not evaluated at opening, so stack/type
checks belong to the future execution stage. The preparation subset additionally
requires balanced blocks, resolves custom instructions and caps nesting at 64.

Syntax failures leave the existing channels and framebuffer intact. `Edialog`
retains the Interface character offset separately from the ordinary AMOS source
line/byte error, and a subsequent valid open clears it. The host inspection method
`program.dialogChannels()` returns frozen metadata snapshots; it does not expose
mutable variables or compiled nodes.

`Vdialog` and `Vdialog$` read and assign the same owned slots. Numeric slots
start at zero; string assignment retains its Latin-1 contents independently of
later AMOS variable assignment. Indices include nvar and are checked before a
store; values convert through the ordinary AMOS integer path. Native string
pointer/integer reinterpretation is explicitly rejected, including reading an
uninitialised numeric slot as a string. Indices above 8191 reject instead of
emulating native signed-word address wrapping. Values are isolated per channel
and program; close releases them with the script.

Only string programs are accepted for now. Numeric resource-bank program
selectors, resource artwork/messages, dialogue execution, Interface `VA` evaluation, AMOS array references and
interactive zones remain unsupported. A selected nonzero Resource bank must
exist when opening; opening records the selection and actual screen identity.
It does not pretend to unpack graphics or run resource programs.

## Original tutorial coverage

Declared prefix fixtures preserve original source through the first open:

| Program | Original lines | Script bytes | Verified nodes |
| --- | --- | --- | --- |
| Communication | 1–37 | 379 | 40 |
| Editing_Zones | 1–42 | 586 | 29 |
| Sliders | 1–50 | 883 | 52 |

A synthetic Wait Key replaces everything after those lines. All three create
channel 1 with the supplied Resource bank and leave the original bitmap black.
The [repository demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/interface-channels.html)
checks 512,000 independent blank pixels, channel ownership/close/Stop/Resume,
a fourth compiled numeric/string transfer fixture, and four Canvas/WebGL frame
comparisons. Its visible inspector text is added
by the harness, not Interface execution or an Amiga capture.

Complete Communication/Editing_Zones now stop at `Dialog Run` ($276c).
Sliders/Full_Example stop at the array-reference function `Array` ($25c0); Full_Example's earlier external
music/sample dependencies are not claimed as executed. The other five Interface
programs still stop at `Dialog Box` ($26e8). Overall Tutorial compilation remains
30/43; preparing a channel is not a completed or playable dialogue tutorial.

Native evidence: `InDialogOpen2/3/4`, `Dia_OpenChannel`, `Dia_Chr`, `Dia_Instr`,
`Dia_NParam`, `Dia_CloseChannel(s)`, `Dia_GetVariable`, `In/FnVDialog(D)` and
`FnEDialog` in
[official +Lib.s, pinned revision 533b4b1](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BLib.s),
plus the [Advanced Control Panels manual](https://amospromanual.dev/09-03-advanced-control-panels.html).
