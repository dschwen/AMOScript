# Print Using fields

Original Using `$04a6` now supports bounded integer and string fields in Print
and Print #. Syntax is `Using format$;value` at any item position. The semicolon
between format and value is required and does not become an output separator.
Each Using formats exactly one item; a following item needs its own Using.

```text
Print Using "######";123       -> "   123"
Print Using "#";123            -> "3"
Print Using "+##";-7           -> "- 7"
Print Using "[~~~]";"a"        -> "[a  ]"
```

## Supported formatting

Integer fields consume signed 32-bit decimal digits backwards. Each `#` takes
one digit, or a space after the digits are exhausted. Overflow discards leading
digits; it does not produce stars or a wider field. A minus sign encountered by
`#` also becomes a space. Explicit `-` fields copy a negative sign or a positive
space; `+` fields always emit a sign. Other supported bytes are literal. This
preserves the source's LongToAsc sign prefix, including the signed minimum integer.

String fields replace each `~` with the next character, then spaces. Unused input
characters are discarded, and other format bytes are literal. Numeric markers
are therefore literal when the value is a string. Empty formats produce empty
fields. Embedded NUL terminates the effective format or string, following the
source buffer scans.

Formats must be byte strings shorter than 120 bytes, measured before NUL
termination. Formatted strings are limited to 121 bytes; the original multi-piece
long-string behavior is not implemented. Numeric formats containing `.`, `;` or
`^` reject until decimal/exponent formatting is implemented. Static float fields
reject during lowering; dynamically tagged float values reject at runtime,
including mathematically integral floats. Val-derived integers remain supported.
There is no conversion through JavaScript's float-to-string formatting for these
fields. Full float/Str$/unformatted-number compatibility remains open.

## Compiler and output contracts

The parser stores an optional format AST expression beside each print value.
Lowering validates the format type and emits a pure formatting call inside the
existing print IR. The runtime validates format bytes/length before evaluating
its value thunk. Both expressions evaluate once. Static typing, arrays, DATA,
procedure results and Val tags retain their existing storage/conversion rules.
No hidden format state is retained across items, statements or factories.

The shared formatter returns a string to the existing screen/file path. Screen
comma tab stops, file tab bytes, semicolon suppression, newline rules and cursor
updates retain their established contracts. Print hosts receive formatted strings
for those fields and ordinary values for unformatted items. Errors halt with
source context. The existing emitter evaluates a statement's item array before
writing it; interpreter-style partial output before a later item fails remains
an open streaming-Print difference.

## Wonderland fixture and evidence

The [browser demo](../demos/print-using.html) copies original Screen/Paper/Pen line
360, level statement 285 or 323, and score statement 655 unchanged. Synthetic
level/score inputs, the panel load/crop and Wait Key/End guards expose just those
fields. It does not execute setupmap, score awards or gameplay. Five cases cover
normal values, padding, overflow and signed edges. The live integer sandbox reads
its inputs through a synchronous files adapter and executes compiled Print Using.

Panel expectations start with the independently decoded Score_Panel PNG. A
separate rasterizer patches expected field strings using literal public-domain
font8x8 input rows and original CMAP pen/paper colours. It does not call the
production formatter, font factory or drawing code. This verifies the current
runtime font; it is not an Amiga Topaz/font capture or a claim of native text parity.
Canvas and the shared copper/CPU snapshot match the expected pixels.

Semantics follow pinned
[`src/interp/print.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/interp/print.cpp),
[`src/lib/convert.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/lib/convert.cpp)
and [`src/verif/handlers.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/verif/handlers.cpp).
These are source-derived expectations, not reference AMOS execution.

Eight execution groups cover signed fields, item lifetime, screen/file output,
typed storage, bounded strings/NUL, evaluation order, diagnostics, independent
factories and panel pixels. An independent-byte conformance case fixes original
words and expected field strings. Chromium runs the shared panel evaluator and
the live sandbox, including unsupported-format errors. The gallery includes its
standalone page and HTML Preview link.

Full Wonderland compilation now first encounters Flash Off `$0D34` on line 361,
byte 13748 (`Flash Off`). Ten encodings remain unrecognized,
appearing 26 times. See [the milestone](wonderland.md).
