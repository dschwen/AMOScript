# Computed named-label branches

`On expression Gosub label1,label2,...` and `On expression Goto label1,label2,...`
now compile through the existing instruction-function dispatcher. The original
On token is `$0316`, followed by two cached verifier words. The bounded decoder
skips those four bytes within the physical source line; parsing and lowering
rebuild the destinations rather than trusting cached addresses or branch counts.

The selector evaluates once and uses the shared AMOS integer conversion. Selection
is one-based. Values below 1 or above the number of labels fall through to the
next statement, including a statement after a colon on the same physical line.
A selected Gosub returns to that continuation using the existing return stack.
A selected Goto changes the instruction pointer without pushing a return address.
Target instruction zero is valid.

Targets are static named labels, scoped exactly like ordinary Goto/Gosub.
Every target must resolve at compile time, including targets a particular selector
will never choose. Selector values can come from typed variables, arrays, DATA,
procedure results, Val or other numeric expressions. String selectors, empty or
malformed lists, numeric/dynamic label destinations and On Proc remain unsupported
and fail with source locations. On Error/Break/Menu are separate forms.

The parser builds an On AST node. The lowerer validates selector typing and local
label resolution and emits one `on_branch` IR operation. Generated code returns
an ordinary `{ call: ip }`, `{ goto: ip }` or empty fallthrough control object.
The scheduler, procedure frames, cooperative budgets and timing are unchanged.
Each factory retains independent language and call-stack state.

## Wonderland fixture

The [browser demo](../demos/computed-branches.html) includes the exact original
physical line 121 and three unchanged initialization routines: initredthing
(575–577), initeye (633–635) and initsnake (649–651). Its synthetic prefix dimensions
and seeds alt/xs/ys arrays, then chooses enemy type 2, 4 or 5. The suffix reports
velocity values and draws an original bank image with a synthetic caption.

Initblob and initgreenthing have explicit End guards because their Rnd-dependent
paths remain unsupported. The fixture also verifies zero/out-of-range dispatch
without entering a routine. These boundaries are deliberate: this demonstrates
original dispatch and three initialization routines, not enemy movement or the
complete game.

## Evidence and checks

The preserved [`+ILib.s` InOn/ROn/OnR/OnG handlers](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/%2BILib.s)
establish the selector bounds, branch form and saved continuation. The
[original verifier](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/verif/loops.cpp)
establishes On's four-byte metadata and destination-list structure. This is source
analysis; no Amiga execution capture has been added.

Seven execution groups cover selector boundaries, backward targets, numeric
conversions, single evaluation, local procedure labels, nested Gosubs, wait and
stop/resume behavior, diagnostics and the declared original routines. An
independent-byte conformance fixture records Gosub/Goto output and same-line
continuation. Standalone factories execute without require. Chromium runs the same
shared demo evaluator and assertions, and the repository gallery exposes every
captured frame through its HTML Preview links.

Full Wonderland compilation now first encounters Screen Copy `$0986` on line 304,
byte 11664. The bounded inventory reports 13 unrecognized encodings appearing
32 times. Recognition counts are not a compatibility percentage; see
[the milestone](wonderland.md).
