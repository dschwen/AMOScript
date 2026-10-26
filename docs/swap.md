# Swap and Roller II paired high-score sorting

`Swap first,second` (`$00a6`) exchanges two variables or array elements of the
same static type: integer, float or string. Scalar/element mixtures and aliases
are accepted. Constants, expressions, whole arrays, string indices and mixed
integer/float/string target types reject explicitly. This command is separate
from Bank Swap and Screen Swap.

The parser builds a pure two-lvalue AST. Lowering checks types/scopes and emits
one `swap` IR instruction. Generated code resolves the first destination, then
the second, evaluates each array index once in order and validates both complete
array addresses before storing. Missing-array/rank checks precede index evaluation;
each subscript is checked before evaluating the next. It captures array objects/linear offsets and
procedure-local owners, so evaluating the second target cannot redirect the first.
It then reads the latest values and writes second then first, matching the source.
No numeric promotion, float rounding or string copying is introduced. Aliasing
the same cell preserves its value; sparse array defaults participate normally.

A failed lookup/index callback performs no Swap stores; independent side effects
inside an adapter callback retain their usual behavior. Errors halt with source
context and ordinary timer cleanup. The instruction returns normal fallthrough,
using the existing function-table runner, procedure stack, variables and arrays.
Per-factory state, Global/Shared declarations and procedure parameters retain
existing ownership. Native double-float storage/reference captures remain open;
this swaps values in the runtime's established integer/single-float/string profile.

Source evidence is pinned to AMOS-Professional-Official revision
`efddf2c9a09bf61a45b7b096a9be84630853c2b1`: `src/verif/handlers.cpp` `swap`
requires two variables with equal types; `src/interp/vars.cpp` `swap` resolves both
addresses before exchanging stored payloads. The original assembled token offset
is `$00a6`. Source-derived reasoning and portable host-injection tests are
separate from an external AMOS execution capture.

The [browser demo](../demos/roller2-swap.html) keeps unchanged Roller II array/
default setup 32–43, insertion 1066–1067 and sorting 1069–1076. Source line 1073
swaps integer scores and then string names at the same two indices. Original
strict-max selection order, including its initial maximum zero, is retained.
The fixture accepts a prepared entry through a synchronous file adapter and uses
a declared Print Using table with Wait Key gates to show defaults, insertion and
sorting of all eleven pairs. Name entry, loaded-highscore branch, original score
screen, scoresave and subsequent menu return are excluded. No persistent file is
written, and the two separate Swap statements do not form a joint transaction.

`tools/reference/roller2_swap.py` independently transcribes the strict-max pair
exchange and rasterizes the preview with pinned upstream public-domain font8x8
glyphs. Five prepared entries cover middle rank, ties, zero, signed maximum and a
negative score. Their exact pair ordering and fifteen indexed/RGBA hashes/PNGs
are checked. These font/format previews are not native Topaz or score-screen
captures. The glyph reference is independent of the production font factory.

Six headless groups cover original opcode/AST/IR, integer/string payloads, portable
float transfer, scalar/array/multidimensional/default/alias targets, once-only
resolution, captured references/offsets, current values after callbacks, rejected
forms and atomic lookup failures, DATA/scopes/factory isolation, and all five
original sorting cases. The shared browser scenario checks fifteen independent
Canvas images and three actual GPU frames with CPU presentation disabled during
GPU rendering. Live controls offer prepared score/name inputs, stepping,
fullscreen and Restart; the gallery supplies an HTML Preview link.

The previous milestone mislabeled the first remaining token. `$0670` at original
line 956, byte 53096, is **Edit**, not Swap. Edit now has a separate [terminal host boundary](edit.md). Full-source compilation
now stops at slot-1 Music `$0058`, original line 992, byte 54202. Three encodings
remain unrecognized: Music, Mvolume and Music Off. The high-score slice remains
separate from editor UI, persistent scores and end-state music.
