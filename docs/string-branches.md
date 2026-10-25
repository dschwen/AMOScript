# String-selected named branches

Main-program `Goto stringExpression` and `Gosub stringExpression` now resolve an
ASCII main label at execution. Strings may come from literals, DATA, arrays,
procedure results or other string expressions. The expression evaluates once.
Lookup folds only ASCII A–Z, preserves whitespace, and accepts lengths 1–31.
Unknown/empty/oversized/non-ASCII names halt with the branch's source context.
No JavaScript evaluation or function-name lookup occurs.

The native source (`src/interp/control.cpp`, GetLabel/GLb3 and
`find_label_named`, revision `efddf2c9a09bf61a45b7b096a9be84630853c2b1`)
looks up an evaluated string after ASCII case folding, with the same length
bound. Its wider label-table visibility, non-ASCII bytes and numeric-expression
forms are not implemented here. This bounded implementation accepts string
branches only in the main program and exposes only main-program user labels.
Procedure-local/cross-procedure string branches and numeric targets remain gated.
Static named branches retain their existing scoped resolution.

The parser distinguishes a cached/static label reference or standalone integer
identifier from an expression operand. Lowering validates string type and the
supported scope, records user labels separately from internal control labels and
emits `string_branch`. Each generated factory owns a frozen lookup built from
entries, including safe own properties for names such as `__proto__`. All
instruction addresses come from lowering. Dynamic names are checked at runtime;
static named destinations continue to be checked at compilation.

A generated string branch returns an ordinary `{goto: ip}` or `{call: ip}`.
Instruction zero is valid. Gosub uses the normal call stack and Return resumes
the following instruction. No new dispatcher, native call-stack shortcut or
mutable label-address cache is introduced.

Four standalone headless groups check DATA/arrays/procedure results, case folding,
expression evaluation once through a synchronous host callback, instruction zero,
prototype-like names, invalid names/types/scopes, factory independence and Gosub
return. The [movement demo](roller2-movement.md) runs the original
`Goto SAS$(HD)` at 646: uppercase strings produced by original SASINIT select
lowercase compiler labels and reach the original floor/stop routines or explicit
handler guards. This is source-derived behavior, not an Amiga execution capture.
