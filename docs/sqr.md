# Sqr

`$0768` accepts one numeric expression and returns a float, including for integer
arguments. Thus `Sqr(9)/2` is 1.5. Integer arguments use the existing FFP promotion;
`Val` integer/float tags, typed scalars/arrays, DATA and procedure return slots use
the same helper. The argument is evaluated once. Optimized emission leaves the
function call at an ordinary instruction boundary.

Negative inputs raise `Illegal function call: Sqr` with the executing instruction's
line and byte. Zero returns zero. Failed assignments retain the old target value
and halt normally. The helper also rejects negative zero when passed directly;
noncanonical signed-zero token fidelity remains outside the current frontend,
which canonicalizes such zero literals during emission. Double precision remains
unsupported.

## Source and numeric profile

The assembled-library catalogue records `$0768` as `sqr`, signature `11`.
AMOS Professional's FnSqr calls FlPos before Math_Fonction/SPSqrt. FlPos tests the
sign bit and raises the ordinary function-call error before entering the library.
This differs from the preserved Motorola routine's negative-input fallback.
The original handlers are in
[+Lib.s](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/%2BLib.s)
and
[+ILib.s](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/%2BILib.s).

The runtime follows the restoring mantissa recurrence in preserved
[FFPSQRT](https://github.com/bayerf42/MotoFFP/blob/e3737f328cf1c9bae91469cce4686611ab7d56e7/FFPSQRT.asm),
SHA-256 `2515ab3d820d844aa1ad0adba6f25ed3841b88c06689235c360f867e92c1ee95`.
Odd exponents shift the input mantissa, 24 result bits are generated, and the
remaining test rounds up without overflowing an all-ones mantissa. The result
exponent is ceil(inputExponent/2)+32 in the FFP encoding. Normalized positive
FFP inputs cannot overflow or underflow this square-root operation.

This is a source-derived arithmetic profile. The preservation repository and
AMOS source are not a capture of the selected Kickstart mathtrans library;
library-version equivalence and native timing remain open.

## Independent checks and original program

`python3 tools/reference/sqr.py` regenerates
[345 exact vectors](../test/fixtures/conformance/sqr.json). Python's integer square
root and an exact midpoint comparison derive rounded mantissas independently of
the production restoring recurrence, without host floating square roots. Cases
span zero, both exponent parities, range extremes, near-boundary mantissas and a
fixed pseudorandom sample. Numeric unit tests execute standalone modules without
require and cover promotion, type boundaries, errors and optimization.

The pinned [Kugel source](../examples/Introideen/README.md) now compiles unchanged.
After 240,132 successful instructions it stops on line 14, byte 520 with
`Invalid colour index`: GX=89, GY=42 and P=-1. Its expression is
`15-Sqr((LX-GX)^2+(LY-GY)^2)/8.5`, with integer P and LX=-20/LY=-40.
The independent Euclidean calculation also truncates to -1 at this point.
The original InPlot3 handler checks for a negative colour before SetAPen, so
keeping this error is intentional. There is no compiler clamp or source fix.

The shared [browser demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/sqr.html)
checks 4,096 independent grayscale pixels generated from exact squared integers,
then runs Kugel to the source error and retains the partial sphere. Both frames
have actual WebGL/CPU comparisons, with the CPU presentation callback blocked
during GPU rendering. Independent grayscale checks do not establish an independent
full-sphere golden, completed source execution or an Amiga capture.
