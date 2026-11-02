# Bounded Interface execution

`Dialog Run` now executes prepared string channels. The cached native tokens
$276c, $277e and $2788 retain their one-, two- and four-argument signatures:

```
result=Dialog Run(channel)
result=Dialog Run(channel,label)
result=Dialog Run(channel,label,x,y)
result=Dialog Run(channel,,x,y)
```

This stage supports finite, noninteractive routines ending in EX. A completed
routine returns zero and leaves its drawings and variables available. It does
not install controls, event handlers, input polling or asynchronous waits.
`Dialog Box` remains unsupported.

## Execution and expressions

`lib/amos/interfaceExecution.js` interprets the immutable tokens prepared by
Dialog Open. It starts at the beginning or after a checked numeric LA label.
Variables, base and size survive repeated runs; XA/YA/XB/YB reset on entry.
Queued text and the last-scancode latch clear before execution and after
ordinary completion/failure, matching Dia_ClearKey. Held keys, joystick masks,
mouse buttons and key-repeat ownership remain intact. Label/owner failures
before execution do not drain input.

Explicit Run coordinates replace the base without alignment; a subsequent BA
command replaces them. EntNul coordinates preserve the existing base.

Supported instructions are EX, LA, SV, SI, BA, XY, IN, SW, SL, GL, GB, GS, GP and
PR. SI rounds X size upward to sixteen; BA rounds X base downward to sixteen.
Numeric variables use the existing checked channel slots. Postfix expressions
support literal numbers/strings, VA, BX/BY/SX/SY, XA/YA/XB/YB, SW/SH, AR/AS,
NE, numeric comparisons, arithmetic, bitwise AND, MI/MA, decimal `#`, string `!`,
and default-font TL/TW/TH/CX. Every expression must produce exactly one value.
Whitespace separates numeric literals: `5 3+` evaluates to eight, rather than
being joined into 53. Digits within a literal are contiguous, matching Dia_ChrC.

Addition/subtraction/negation wrap signed longwords. Native multiplication uses
the signed low words of both operands. Division sign-extends the dividend's low
word and divides by a signed-word divisor; zero divisors reject. Native DIVS
quotient overflow is explicitly gated. Pointer/string comparisons, raw native
string addresses and unsupported expression functions reject.

The existing Array backing is used by real AR/AS execution. Native AS returns
the stored upper bound, and AR excludes that bound; see
[the Array contract](array-references.md). Returned strings retain their owned
contents without pretending JavaScript strings are native memory addresses.

A call runs at most 4096 instructions synchronously, with a 64-value expression
stack. Temporaries and SV-retained strings consume a checked channel-buffer
budget. Interface strings are limited to 255 Latin-1 bytes, rather than silently
wrapping the native byte-sized string length. Persistent channel values remain
owned JavaScript values; native pointer aliasing of reclaimed string buffers is
not emulated. Explicit EX is required; falling off the program is an error.

## Indexed graphics

The channel retains the actual screen object captured at Open. Run rejects a
closed/replaced owner, temporarily selects the owner for drawing, and restores
the caller's screen selection. An interrupted/retired VM cannot perform later
script effects or reactivate an old screen after replacement. Reentrant Run is
rejected, and a channel closed from a host callback cannot continue executing.

`display.interfaceDraw` writes the selected logical bitmap directly. It bypasses
Bob hooks and Autoback replay, so a physical double buffer remains unchanged.
No RGBA overlay is used. The existing snapshot/copper and WebGL paths consume
the resulting indexed pixels. AMOS graphics cursor coordinates remain separate
from the Interface XA/YA/XB/YB registers in this portable profile.

GL/GB/GS apply the base; GB requires increasing endpoints and fills inclusive
bounds. GP preserves the native source's unusual behavior: it omits the base,
sets XA and YA to X, and sets XB and YB to Y+1. This is not silently corrected.
PR uses top-left coordinates and the portable default 8-pixel font. Default
writing is transparent; SW 1 enables an opaque text background. Negative ink
parameters preserve their pens. Graphics inks retain existing AMOS validation.

Drawing requires signed-word coordinates, solid lines/fills, no outline paint,
and no explicit graphics Clip. Custom fonts/styles, stippled lines, patterned
fills, complement/inverse writing and wrapped graphics coordinates remain gated.
This is portable raster evidence, not native font/line-edge capture parity.

## Errors and remaining work

Earlier completed commands remain effective when a later command fails. The
ordinary AMOS error retains the calling line/byte, while Edialog records the
failing Interface token's zero-based character offset. A failed function call
does not assign its result. Screen selection is restored for ordinary failures.
Stop/Resume between completed calls preserves the channel; interruption inside
a synchronous host callback is an explicit error, not a resumable suspended Run.

Resource UN/LI/BO/PO drawing, background SA saves/restoration, active controls,
user instructions, IF/JP/JS/RT control flow, and RU waits remain unsupported.
Encountering an unsupported instruction fails before evaluating its arguments.
The remaining complete-source compile blockers are Dialog ($2796) for
Communication/Sliders/Full_Example, Rdialog$ ($27e6) for Editing_Zones, and Dialog
Box ($26e8) for the other five Interface tutorials. Those full programs still
need resource-backed drawing and controls even after their later tokens compile.
Overall Tutorial compilation remains 30/43.

## Demo and evidence

[Run the Interface execution demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/interface-run.html).
It executes the unchanged BA string at Graphics line 34 and rectangle strings
at lines 71–83 on original startup lines 1–16, followed by declared EX/label/title
routines. Resource boxes, outlines, patterns and surrounding sections are omitted;
this is not the complete Graphics tutorial. A second declared routine renders
Sliders data through actual PR/VA/AR/AS after original setup through line 51.
All visible text is executed Interface PR output, not a host inspector overlay.

Three Canvas/WebGL frames and 240,640 independent rectangle pixels cover these
fixtures. Unit checks cover cached arities, omitted labels, typed DATA/arrays/
procedure results, arithmetic bounds, string/stack/execution budgets, partial
errors, owner replacement, screen selection and host retirement/reentry.

Native source: FnDialogRun1/2/4, Dia_RunProgram, Dia_Loop, Dia_GBox/GSquare/GLine/
GPlot/Text, Dia_Size/Base/SetVar, Dia_Evalue and the Dia_F arithmetic/string
routines in [official +Lib.s, pinned revision 533b4b1](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BLib.s).
The [Interface language manual](https://amospromanual.dev/09-02-interface-language.html)
and [Advanced Control Panels](https://amospromanual.dev/09-03-advanced-control-panels.html)
provide the language/signature context. This evidence is source-derived; no
Amiga execution capture is claimed.
