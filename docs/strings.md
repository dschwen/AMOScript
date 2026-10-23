# String behavior

AMOScript stores byte strings as JavaScript strings with character codes 0..255.
Length-prefixed literals retain embedded zero bytes; identifier payloads strip
their zero terminator/padding. Upper$/Lower$ change ASCII letters only; all other
bytes remain unchanged. Asc returns an unsigned first byte, or zero for an empty
string; Chr$ accepts codes 0..255. Flip$ reverses bytes. Tests cover all 256 byte
values through storage, reversal and case conversion.

## Retrieval and construction

Left$/Right$/Mid$ retrieval uses the original RFnMid validation order: reject
negative offsets, then return an empty result for offsets beyond the source,
then check a negative count. Offsets 0 and 1 both mean the first byte. Thus
`Left$("",-1)` and `Mid$("abc",4,-1)` return empty strings, while
`Right$("",-1)` raises an error because FnRight checks its count first.
Counts larger than the remaining source are clipped. Both two-argument Mid$
and the common FnRight path use a maximum count of 65535.

Space$ and String$ follow RString's 16-bit result length and loop counter.
Nonnegative counts retain their low 16 bits: 65535 gives 65535 bytes, 65536 gives
an empty string and 65537 gives one byte. String$ repeats the first source byte;
an empty source substitutes count zero even for a negative count. Other negative
counts are errors. Numeric arguments use the shared integer conversion.

The original RString requests heap space using the full count before writing the
word-sized result. AMOS heap size, garbage collection, allocation timing and
out-of-memory errors are not modeled by this JavaScript runtime. The word-length
rules describe logical return values when that allocation succeeds; large-count
compatibility still requires target execution with its memory configuration.

## Concatenation limits

Concatenating two nonempty strings rejects a combined length of 65472 or greater,
using String_Max=$ffc0. A result of 65471 bytes is allowed. If either operand is
empty, Op_Plus returns the other directly without checking String_Max. This
permits an existing 65535-byte constructed string to pass through `S$+""`.

The limit is operation-specific rather than a global variable-size check.
Arrays, procedure arguments/results and DATA retain string values; concatenation
inside any of those contexts uses the same checked helper. DATA expressions run
at Read time, so execution errors are reported at the Read site.

These rules follow [RFnMid and Op_Plus](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BILib.s),
[RString/FnString/FnUpper/FnLower](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BLib.s),
and [String_Max](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BEqu.s).
The [boundary fixture](../test/fixtures/conformance/string-boundaries.json) and
[execution tests](../test/string-boundaries.test.js) record source analysis;
reference AMOS execution remains outstanding.

## Substring assignment

The binary frontend supports these forms for string scalar or array variables:

```basic
Left$(S$,count)=replacement$
Right$(S$,count)=replacement$
Mid$(S$,offset,count)=replacement$
Mid$(S$,offset)=replacement$
```

These overwrite characters while retaining destination length. Copying stops at
the requested count, end of the destination, or end of the replacement, whichever
comes first. Remaining characters stay intact. No form extends a destination.

| Original | Assignment | Result |
| --- | --- | --- |
| abcdef | Left$(S$,4)="XY" | XYcdef |
| abcdef | Right$(S$,4)="XY" | abXYef |
| abcdef | Mid$(S$,3,2)="WXYZ" | abWXef |
| abcdef | Mid$(S$,3)="WXYZ" | abWXYZ |

Offsets 0 and 1 both select the first byte. Right$ selects the start of its
requested suffix; oversized counts select the whole string. A zero count or
empty replacement leaves the value unchanged. Two-argument Mid$ uses a maximum
count of 65535.

The target and its array indices are resolved before bounds and replacement
expressions. Each expression evaluates once. The target's original value is
retained for self-replacement, and changing a string leaves other variables
holding its former value unchanged. Procedure local/Shared rules apply normally.

Negative offsets are errors. Right$ rejects a negative count before evaluating
the replacement. Other forms evaluate the replacement before validating their
offset/count. An offset beyond the destination returns before the count check,
so `Mid$(S$,99,-1)="X"` leaves a short string unchanged. `Left$(S$,-1)="X"`
similarly leaves an empty destination unchanged, while Right$ still rejects a
negative count. Bounds use the common numeric-to-integer conversion.

These rules follow the original [InLeft/InRight/InMid2/InMid3 and RInMid/RInMid2
handlers](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BILib.s).
The [manual](https://amospromanual.dev/05-02-string-functions.html) documents the
assignment interfaces. Expectations remain source analysis pending AMOS execution
capture. The [independent-byte fixture](../test/fixtures/conformance/substring-assignment.json)
checks copy bounds, sharing, self-replacement and embedded bytes, while
[execution tests](../test/substring-assignment.test.js) also cover scopes,
multidimensional arrays, evaluation order, errors and inline conditionals.

Remaining work includes AMOS memory limits, extreme Instr offsets that depend
on raw address/word behavior, other string-producing commands and numeric text
formatting, which currently uses JavaScript conversion.
