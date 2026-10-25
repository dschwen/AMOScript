# Integer Add

Original tokens `0x0458` and `0x0462` implement `Add target,delta` and
`Add target,delta,low To high`. The base token also accepts a supplied range,
as native verification rewrites it to the ranged token. An explicit ranged token
requires all bounds. Targets must be integer scalars or array elements; strings
and float targets reject. Delta and bounds use shared numeric integer conversion,
including float/Val operands. Bounds are inclusive.

The sum wraps as a signed 32-bit long before comparisons. The ranged form snaps
below-low sums to high, and above-high sums to low; it is not modulo arithmetic
and does not preserve overshoot. Exact endpoints remain unchanged. Reversed
bounds retain the native ordered comparison (below low first), without swapping.
The lvalue/array indices are captured and validated first. Delta, low and high
then evaluate once, left to right; the current target value is read for the final
update. A failed operand does not store a partial Add result.

These are source-derived rules from `src/verif/handlers.cpp` add and
`src/interp/vars.cpp` add/add_range at AMOS-Professional-Official revision
`efddf2c9a09bf61a45b7b096a9be84630853c2b1`. The verifier requires integer
variables, resolves two/four-operand forms and converts numeric operands. The
interpreter's ranged helper explicitly collects operands before reading/storing
the signed sum. This is source analysis, not an external AMOS capture.

The parser builds one pure Add AST with optional bounds. Lowering validates
integer target storage and emits `add_integer`; generated instruction functions
capture an array reference/indices, evaluate operands and call the shared integer
helper. They perform the store and return ordinary fallthrough. The runner,
procedure stack, array representation and host adapters are retained.

Four headless groups use literal opcode bytes, independent overflow/overshoot/
reversed-range vectors, typed DATA/arrays/procedure locals, Val conversion,
synchronous callback evaluation order, preflight errors and unchanged storage on
operand failure. The [movement demo](roller2-movement.md) executes original ranged
voice cycling through 0–3 on wall bumps, distinguishing sample bank commands from
continuing MOD triggers. Wider Add forms remain unsupported.
