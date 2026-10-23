# AMOS conformance fixtures

These fixtures compare standalone generated programs against explicit expected
values. Run them with `npm test`. The test name reports the evidence category.
Currently the fixtures are **source-analysis**, not captured AMOS execution.

Each JSON fixture includes:

- `name` and `source`: a readable program description.
- `programHex`: the full tokenized file bytes, including the header and trailer.
  Do not generate golden encodings from the production token table. Record the
  encoding's provenance under `encoding`; independent bytes and AMOS exports
  should remain distinguishable. The readable source need not be a byte-exact
  export when the encoding notes explain the difference.
- `evidence.kind`: `source-analysis` or `reference-execution`.
- `evidence.url`, `symbols` where applicable, and `notes`: the primary source
  supporting the result and its limits. Source analysis remains provisional
  until checked against the intended AMOS version.
- For `reference-execution`, also record `implementation`, `version`,
  `environment` (machine/emulator and settings), `command` (reproduction steps),
  and `recordedDate`. Preserve the actual output capture beside the fixture and
  link it in the notes. Do not relabel inferred results as runtime observations.
- `expected.values`: ordered argument arrays received by the numeric/string
  print host. `expected.halted` records termination.
- Optional `files`: filename-to-hex byte strings supplied through the memory file
  host, for external-input fixtures. Preserve independent format provenance.

The harness runs with no runtime import and a finite instruction budget. These
initial cases exercise numeric values, not exact AMOS print formatting or waits.
Add separate output/state checks when a feature requires them. Capture paired
source and binary directly from AMOS when reference execution becomes available.

The integer division, multiplication and modulo expectations are interpretations
of `Op_Div`, `Op_Mult` and `Op_Modulo` in the original AMOS Professional evaluator.
Multiplication's quick path wraps when both operand magnitudes are below 65536;
the slow path checks the positive magnitude before restoring sign. MOD
uses an unsigned dividend and a sign-normalized divisor; MOD by zero preserves
the dividend in that implementation. These unusual cases intentionally remain
visible for future emulator comparison.

The Bob collision fixture reuses the independently specified bank bytes from
`../image-banks.hex`. Its source-analysis expectations distinguish one-pixel
mask contact from transparent bounding-box overlap and verify replacement of
the Col result table. It also remains pending AMOS execution comparison.

The integer-to-FFP promotion fixture encodes mixed comparisons and arithmetic
with exact FFP literals. It checks that integer operands lose precision before
the operation, using 24-bit magnitude rounding with ties up. Its evidence is the
AMOS evaluator's Compat/SPFlt calls, the documented FFP layout and the AROS
SPFlt rounding step; it does not claim captured Amiga execution or complete
floating arithmetic fidelity. See `docs/numbers.md` for the remaining paths.

The FFP addition fixture uses exact raw floating literals to check exponent-gap
shortcuts, rounding before carry normalization, biased cancellation, saturation
and underflow. Its expectations follow the preserved Motorola FFPADD/FFPSUB
routine, with the AMOS evaluator establishing the mathffp call path. It is source
analysis rather than execution captured on a particular AMOS/Kickstart version;
the preservation repository's platform adaptations are recorded as a limitation.

The FFP multiplication/division fixtures check rounding carries, recurring
quotients, early exponent guards and source-specific DIVU estimate boundaries.
Multiplication currently follows FFPMUL2, the higher-accuracy preserved variant;
the target Kickstart library variant is not yet identified. Division includes
16-bit DIVU overflow and wrapped-remainder cases, using the CPU reference's
unchanged-operand overflow rule. Both fixtures remain source analysis pending
reference AMOS execution, rather than claims of exact library-version fidelity.

The decimal-input fixture uses AMOS ValRout and the a2ffp converter actually
embedded in +Lib.s, rather than assuming JavaScript or standalone Motorola
decimal parsing. It distinguishes intermediate rounding, scale underflow,
runtime integer/float selection, signed exponent wrapping and the decimal
integer magnitude check. Arithmetic tests use hexadecimal $80000000 when they
need INT_MIN through Val; decimal -2147483648 is separately tested to return
zero. These source-derived conversion cases still require AMOS captures.

The transcendental fixture records the preserved CORDIC log/exp and
log-multiply-exp power composition, the finite Ln(0) limit, power overflow and
the AMOS Pi constant. It includes a non-integer-valued result for an integer
power, rather than assuming JavaScript's exact integer-valued result. These
are source-model regressions, not captures from an AMOS/Kickstart installation.

The circular trigonometry fixture includes Degree/Radian conversion, a tangent
pole and the preserved routine's excessive-input path. Its instruction sequence
leaves the doubled exponent byte in the result, contrary to its prologue's
unchanged-input description. That discrepancy is explicitly recorded pending
reference-library execution; it is not claimed as observed Amiga behavior.

The number-functions fixture encodes Abs/Sgn/Int independently, checking integer
Abs overflow, type-preserving integer identity/float floor, and Sgn's integer
result. Original handlers and the documented mathffp contracts establish these
expectations; target-library execution remains outstanding.

The float-to-integer fixture checks truncation, signed saturation and the exact
negative limit using independently specified FFP payloads. AMOS FlToInt1/2 retain
SPFix results without checking overflow; preserved FFPFPI supplies the boundary
algorithm. The AROS implementation has different edge paths and is not the
selected model. Reference execution is still needed to establish target-version
equivalence.

The substring-assignment fixture uses independent original token offsets for
Left$/Right$ and both Mid$ arities. It checks bounded overwrites, suffix alignment,
unchanged length, shared/self-replacement, zero offsets, past-end negative-count
handling and embedded zero/high bytes. Expectations follow RInMid/RInMid2 and the
individual handlers; captured AMOS execution remains outstanding.

The string-boundaries fixture records RFnMid's offset-before-count checks,
RString's word result lengths, String$'s empty-source shortcut and Op_Plus's
nonempty String_Max guard. A raw zero/high-byte literal also checks ASCII-only
case conversion. Large RString counts require heap allocation on AMOS; this
fixture models logical returns when allocation succeeds, not AMOS memory limits.

The external-bank-load fixture provides independent AmSp bytes through the files
host and checks original Load token offsets, replacement, empty-slot-aware image
appending and pasted pixels. Source/manual expectations remain provisional until
reference AMOS captures are available.

The bank-lifecycle fixture independently encodes all four Reserve forms,
single/temp/all erasure and Length. Embedded image slots survive Erase Temp;
work data does not. Byte and image-slot counts are source-derived, with physical
memory allocation and reference AMOS execution still outside this evidence.
