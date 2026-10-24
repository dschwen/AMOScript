# Numeric compatibility

AMOScript distinguishes signed 32-bit integers, floating values, and the numeric
type returned at runtime by Val. JavaScript numbers store the underlying values;
explicit runtime helpers implement the supported AMOS conversion rules.

## Integer-to-float promotion

AMOS's evaluator calls SPFlt when an integer is stored in a float variable or
combined with a float operand. FFP has a normalized 24-bit mantissa. Promotion
therefore rounds the integer's magnitude to 24 significant binary digits, with
ties rounded up in magnitude, then restores the sign. Zero remains positive.

Examples: 16777217 becomes 16777218; -16777217 becomes -16777218.
16777219 becomes 16777220. A rounding carry renormalizes the value:
2147483647 becomes 2147483648. Converting that value back to an integer
destination saturates to 2147483647.

The `float(number, sourceType)` runtime helper applies this conversion only to
integer sources. Already floating sources retain their value. Val boxes retain
their integer/float tag until promotion, conversion or output requires it.

| Path | Current conversion behavior |
| --- | --- |
| Float scalar and array assignment | Lowerer.convert uses the same promotion helper |
| Float procedure parameter | Argument conversion uses the destination parameter type |
| DATA into a float destination | readData promotes according to the entry's static or dynamic type |
| Mixed arithmetic/comparison | Integer operands are promoted before the operation/comparison |
| Power | Both integer operands are promoted to floats before evaluation |
| Min/Max | Both numeric operands use the common type before comparison and selection |
| Sin/Cos/Tan/Ln/Exp arguments | Integer arguments are promoted before the shared FFP helper |
| Log arguments | Integer arguments are promoted before the remaining JavaScript call |
| Abs/Int | Preserve the argument's type, including runtime Val tags |
| Sgn | Accept either numeric type and return an integer |
| Procedure return | Retains its expression type in the matching Param slot; subsequent typed storage converts |
| For bounds/start/step | Convert to the loop variable's type when captured |

Integer-only expressions retain their existing integer behavior. For example,
`16777217=16777218` is false, while `16777217=16777218.0` is true after promotion.
The [.AMOS execution tests](../test/float-promotion.test.js) cover these paths in
standalone generated modules without importing a runtime.

## Float-to-integer conversion

Integer destinations truncate floating values toward zero and saturate outside
[-2147483648, 2147483647]. Exactly -2147483648 is retained. Fractional values
between -1 and 1 return positive zero. This applies to scalar/array assignment,
procedure arguments, DATA, file input and numeric arguments requiring integers.
Static and Val-derived bitwise/Mod expressions use the same conversion.

Conversion and arithmetic have different overflow rules: storing a large float
in X returns a signed limit, but `X+1` still raises integer overflow when X is
2147483647. The runtime separates `integer` conversion from `checkedInteger`
arithmetic validation. Neither non-finite host values nor NaN are accepted as
valid FFP conversion inputs.

AMOS [FlToInt1/2](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BILib.s)
call SPFix without checking its overflow flag. The preserved Motorola
[FFPFPI routine](https://github.com/bayerf42/MotoFFP/blob/main/FFPFPI.asm)
specifies truncation and signed saturation, including its separate exact
negative-limit path. This source model is the implemented contract; equivalence
to the selected Kickstart library still needs captured execution. AROS SPFix
has different edge paths and is not used as the algorithm for these boundaries.

The [independent-byte fixture](../test/fixtures/conformance/ffp-integer-conversion.json)
covers both integer limits and their neighboring FFP values.
[Standalone tests](../test/float-to-integer.test.js) additionally exercise Val,
storage boundaries, file input, bitwise/Mod conversion and arithmetic errors.

## Floating addition and subtraction

Static float expressions and Val-derived arithmetic use the same `floatAdd`
helper. Floating For/Next increments also use it. Operands are normalized to
24-bit mantissas before addition. Results follow the preserved Motorola
[FFPADD/FFPSUB routine](https://github.com/bayerf42/MotoFFP/blob/main/FFPADD.asm):

- Exponent gaps of 24 or more return the stronger operand unchanged.
- Like-sign addition inserts its rounding byte before normalizing a carry.
- Unlike-sign addition aligns the smaller magnitude, biases unequal exponents,
  and discards cancellation residue before normalization.
- Overflow saturates to the largest finite magnitude with the result's sign.
  Underflow returns positive zero. Positive results need exponent 1 or higher;
  negative results can retain exponent 0, matching the routine's sign/exponent
  byte checks. Exact cancellation returns positive zero.

These rules differ from simply rounding an exact sum to IEEE single precision.
For example, `1.0 + 2^-24` returns 1.0 because of the exponent-gap shortcut.
The source's biased cancellation path makes
`1.0 - 0.999999940395355224609375` return 2^-23 when the second operand is
supplied as the exact FFP literal 0xffffff40. The
[independent-byte fixture](../test/fixtures/conformance/ffp-addition.json)
records that distinction explicitly; emulator comparison remains outstanding.

## Floating multiplication and division

Static and Val-derived expressions now use `floatMultiply` and `floatDivide`.
They normalize operands, operate on mantissas, and return finite FFP results.
Integer-only multiplication and division retain their separate integer rules.

Multiplication follows the preserved
[FFPMUL2 routine](https://github.com/bayerf42/MotoFFP/blob/main/FFPMUL2.asm).
The product of two 24-bit mantissas fits exactly in JavaScript's integer
precision. The helper retains its upper product bits, rounds in magnitude and
normalizes a carry. Exponent guards run before product normalization. For
example, the source saturates `FFP($8000007f)*1.0` to the maximum finite value
at that initial guard, even though the mathematical product is representable.
The [independent multiplication fixture](../test/fixtures/conformance/ffp-multiplication.json)
records this behavior. FFPMUL2 is the higher-accuracy variant; the intended
Kickstart library's multiply variant has not yet been identified.

Division follows the preserved
[FFPDIV routine](https://github.com/bayerf42/MotoFFP/blob/main/FFPDIV.asm).
It estimates the high quotient using the divisor's high word, corrects once,
then estimates the low quotient from the wrapped remainder and high word.
It handles the rare normalization branch and rounds the assembled quotient.
Exponent guards run before those estimates. Zero divisors raise a source-located
error; zero dividends and underflow return positive zero. Overflow saturates
with the result's sign.

The second 16-bit DIVU can overflow for difficult mantissas. The
[CPU reference](https://www.nxp.com/docs/en/reference-manual/M68000PM.pdf)
specifies that overflow leaves operands unchanged. Because the routine clears
the dividend's low word before DIVU, that branch contributes a zero low
quotient. The [independent division fixture](../test/fixtures/conformance/ffp-division.json)
checks this boundary and a case where a single correction leaves a wrapped
remainder. These quotients can differ from a correctly rounded mathematical
division and remain provisional until checked on the selected AMOS library.

## Decimal text and Val

Val and numeric file input share a typed scanner. It follows the evaluator's
[ValRout, declong, hexalong and binlong routines](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BILib.s):

- Decimal digits and binary input skip ASCII spaces. Hex input stops at a space;
  tabs and other whitespace are not interchangeable with spaces.
- A decimal point, or an exponent followed by a sign/digit, selects a float.
  `Val("1e")/2` is integer division and returns 0;
  `Val("1e+")/2` retains float type and returns 0.5.
- Decimal integers check the positive magnitude before applying the sign.
  `Val("-2147483648")` returns 0. `Val("$80000000")` supplies INT_MIN.
  Hex input rejects more than eight digits. The binary scanner's branch into
  decimal accumulation after its 33rd bit is retained and tested.

Floating text is copied into a bounded 33-byte conversion string. The
[a2ffp converter and private helpers](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BLib.s)
accumulate mantissa digits through FFP multiply/add, build a power-of-ten scale
through repeated FFP multiplication or division, then multiply the two values.
The exponent and fractional-digit adjustment use signed 16-bit arithmetic.
Sign is applied after conversion. The portable implementation returns canonical
zero for underflow and does not emulate stack corruption from the original
converter's fixed local buffers.

Conversion therefore includes intermediate rounding and range effects.
`Val("3.141")` returns the same value as FFP literal 0xc9062442.
`Val("16777217.0")` returns 16777216, while integer `Val("16777217")` promoted
into a float becomes 16777218. `Val("1000000e-20")` returns zero because its
decimal scale underflows before the final multiplication. Large scales
saturate, and exponent text can wrap: `Val("1e65536")` returns 1.

File input uses the same scanner, then converts to the destination type. DATA
and procedure results retain Val's converted value and type. These behaviors
have standalone execution tests and an
[independent-byte fixture](../test/fixtures/conformance/decimal-input.json);
they remain source analysis pending reference AMOS execution.

## Natural log, exponential, power and Pi

Ln, Exp and power use shared FFP helpers for static and runtime-typed operands.
They no longer call JavaScript log/exp/pow. The implementations follow the
preserved Motorola [FFPLOG](https://github.com/bayerf42/MotoFFP/blob/main/FFPLOG.asm),
[FFPEXP](https://github.com/bayerf42/MotoFFP/blob/main/FFPEXP.asm) and
[FFPPWR](https://github.com/bayerf42/MotoFFP/blob/main/FFPPWR.asm) routines:

- Ln reduces the mantissa through `(x-1)/(x+1)`, accumulates the fixed-point
  hyperbolic rotations, then adds the binary exponent times the stored ln(2).
- Exp reduces its argument by ln(2), performs signed 32-bit hyperbolic rotations
  with repeated shifts at 4 and 13, then restores the binary exponent.
- Power composes FFP log, multiplication and exp. Negative bases use their
  absolute magnitude, matching the preserved routine's result when AMOS ignores
  the library's overflow flag. It does not restore an odd-power negative sign.
- Ln rejects negative arguments, including a negative zero sign, through the
  AMOS FnLn/FlPos contract. Ln(0) returns the largest negative finite value.
  Exp underflow returns zero and overflow saturates positively.
- Power's composition makes `0^0` return 1, `0^positive` return 0, and
  `0^negative` saturate positively.

Power is approximate even when its mathematical result is an integer.
For example, the source model returns about 27.000006 for `3^3`. Tests26/27
check ordered results at six-digit precision, rather than requiring JavaScript's
exact integer-valued powers. Larger Exp arguments lose accuracy in the FFP
range-reduction product. An [independent-byte fixture](../test/fixtures/conformance/ffp-transcendental.json)
records selected model results; this remains source analysis pending execution
on the target AMOS/Kickstart mathtrans library.

Pi# now uses the actual single-precision value initialized by AMOS
Open_MathLibraries: FFP word 0xc90fd942, or 3.141592264175415. It does not use
JavaScript's Math.PI. Double-precision mode remains unsupported.

## Circular functions and angle modes

Sin, Cos and Tan share the preserved Motorola
[circular CORDIC routine](https://github.com/bayerf42/MotoFFP/blob/main/FFPSIN.asm)
and [inverse tangent table](https://github.com/bayerf42/MotoFFP/blob/main/FFPTHETA.asm).
Arguments first undergo fixed-point range reduction, then 24 signed 32-bit
rotations produce sine and cosine. Tangent divides the normalized results
through the shared FFP divider. A zero cosine returns the largest positive
finite tangent, including at a negative pole.

Sin/Tan return small arguments directly when the FFP exponent is at most 56;
this includes the complete exponent bucket below 2^-8. Cos still evaluates the
CORDIC path. Near-zero outputs are flushed according to FSFLOAT's working-value
threshold: positive values through 255 and negative values through -256 become
zero before normalization. Larger arguments use FFP multiply/subtract reduction
by multiples of 2*pi, so precision decreases as magnitude grows.

Radian is the default. Degree/Radian affect subsequent Sin/Cos/Tan calls,
including calls inside procedures and read-time DATA expressions. Each factory
instance has its own mode. Degree conversion follows AMOS FFAngle: divide by
180 using FFP, then multiply by the stored AMOS Pi constant. The library's
internal Pi constant differs slightly from AMOS Pi#, so exact real-number
quadrant identities are not generally guaranteed.

The preserved routine's excessive-input branch raises its overflow flag after
doubling the exponent byte. Its instructions return that altered byte, although
the prologue describes unchanged input. AMOS's math wrapper does not inspect the
flag. This source model follows the instructions: Sin/Cos/Tan at 2^20 return
-2^-23. The [independent-byte fixture](../test/fixtures/conformance/ffp-trigonometry.json)
records this discrepancy pending comparison with the selected Kickstart library.
Unit tests cover state isolation, small angles, poles and reduction boundaries;
Chromium executes a standalone trigonometric program and checks its Canvas pixels.

## Absolute value, sign and floor

`Abs` and `Int` preserve integer/float type, including when the argument comes
from `Val`. `Int(3)/2` therefore returns 1, while `Int(3.5)/2` returns 1.5.
Floating `Int` rounds toward negative infinity, so `Int(-3.5)` is -4. Its float
result can exceed the signed 32-bit integer range; converting that result into
an integer variable is a separate operation. `Sgn` always returns integer
-1, 0 or 1, so `Sgn(3.5)/2` returns integer zero.

The original [FnAbs/FnInt/FnSgn handlers](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BLib.s)
distinguish integer and floating implementations. Integer Abs uses unchecked
32-bit negation, retaining -2147483648 for `Abs($80000000)`. Floating Abs and
Int dispatch SPAbs/SPFloor through Float_Fonction, which retains float type;
floating Sgn uses SPTst followed by Ret_Int. The
[manual](https://amospromanual.dev/05-03-maths.html) specifies floor for Int.
The runtime's negative-zero Sgn branch follows the sign-first
[AROS SPTst implementation](https://github.com/aros-development-team/AROS/blob/master/workbench/libs/mathffp/sptst.c);
noncanonical zero behavior remains provisional for the selected target library.

Standalone execution tests cover nested Val results, scalar/array conversions,
DATA and procedure return slots. An
[independent-byte fixture](../test/fixtures/conformance/number-functions.json)
records source-derived expectations; these are not captured AMOS execution.

## Evidence and limits

The original evaluator's [Compat, IntToFl1 and IntToFl2 routines](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BILib.s)
establish where integer promotion occurs. The [AmigaOS math library documentation](https://wiki.amigaos.net/wiki/Math_Libraries)
defines the normalized FFP representation and SPFlt interface.
The preserved Motorola [FFPIFP routine](https://github.com/bayerf42/MotoFFP/blob/main/FFPIFP.asm)
rounds using the first discarded mantissa bit and explicitly renormalizes a
rounding carry. This also corroborates the non-carry rounding step originally
checked against AROS SPFlt. The independent-byte
[promotion fixture](../test/fixtures/conformance/integer-ffp-promotion.json)
tests non-carry cases; execution tests also cover normalization carries. These
expectations are source analysis, pending capture on the intended AMOS/mathffp
version. The Motorola preservation repository includes platform adaptations;
its behavior is not proof of equivalence to every Amiga mathffp version.
The AMOS converter's private multiply/divide code at L2858A/L28518 corroborates
the preserved FFPMUL2/FFPDIV paths. External mathffp library-version equivalence
still needs verification.

This is not yet a complete FFP arithmetic implementation. Base-10 Log still
uses a JavaScript function. Its domain/range and precision rules, additional
functions and inverse trigonometry need implementation. Basic arithmetic
normalizes those host-derived values on entry.
NaN reaching those helpers raises a source-located invalid-value error.
Remaining floating operations need
their own result rounding and range rules, alongside transcendental behavior,
exact floating number formatting and double-precision support. Bounded
[Print Using integer fields](print-using.md) now avoid host decimal conversion
and preserve signed 32-bit digits, padding and overflow truncation.
Float-to-integer conversion uses the preserved FFPFPI truncation/saturation
contract; comparison against the selected AMOS/Kickstart version remains open.
