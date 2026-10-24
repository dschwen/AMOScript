# Source-derived Rnd and Randomize

`Rnd(bound)` (`$0686`) returns an integer. `Randomize seed` (`$0690`) writes the
per-program 32-bit seed using shared numeric conversion. Each factory owns its
seed and previous result; neither Math.random nor a browser animation clock is
used. Typed scalars, arrays, DATA, procedure results and Val arguments use the
existing numeric/function path.

## Sequence and bounds

The source updates its seed with `Mulu32(seed,$BB40E62D)+1`, modulo 32 bits,
then takes the upper 24 bits as a candidate. Mulu32 swaps the whole cross
products of 16-bit words, rather than merely shifting them. Their upper halves
therefore contribute to the low word. Ordinary JavaScript multiplication,
Math.imul or a conventional linear-congruential generator would change the stream.

For a nonzero bound, the magnitude selects the source's smallest covering bit
mask, capped at 24 bits. Candidates are masked and values above the magnitude
are rejected. Small bounds include both zero and the endpoint. Large bounds,
including INT_MIN's magnitude, retain the source's 24-bit candidate ceiling;
results never exceed `$FFFFFF`. No uniformity or cryptographic property is claimed.

A negative bound skips beam mixing and uses the deterministic seeded sequence.
A positive bound mixes a beam word into the candidate's low 16 bits, without
carrying into its high byte, before masking/rejection. The optional synchronous
host `readRandomBeam()` supplies a word 0–65535 for each positive candidate,
including rejected candidates. Invalid values, thenables or host errors halt with
source context. Negative and zero calls do not invoke the host reader.

`Rnd(0)` returns the last accepted result without changing the seed or consulting
the host. Randomize changes only the seed: it does not clear that cached result.
Stop/Resume, Timer assignment and VM waits leave the stream intact. The exposed
`state.random` diagnostic is a frozen `{seed,last}` snapshot, not language state
that can be reassigned through AMOS variables.

## Portable choices and limits

The default seed and cached result are zero. The default beam word is also zero.
These are explicit portable replay choices; native unseeded startup and real
Amiga beam timing have not been established. Positive-bound output is therefore
not claimed to match native execution unless its seed and beam inputs are known.
A host may inject a captured/control word sequence; a constant test word is not
an Amiga capture or an implementation of a live beam register.

One call allows at most 4096 candidates. Exhausting that rejection budget throws
instead of blocking a cooperative VM instruction forever under an adversarial
host. Consumed seed transitions remain consumed and the last accepted result is
retained. Ordinary source-derived fixtures complete well within this bound.
Exact target-library/runtime captures, hardware mixing and native startup seeding
remain acceptance gates.

## Wonderland fixtures and verification

The declared fixture joins unchanged startup lines 1–48 with blob initialization
560–563 or green-jump statements 607–613. Synthetic enemy index/positions and
Repeat/Wait Key guards supply repeatable calls. Green cases exercise both sides
of the player. No complete movement, Bob rendering, game loop or enclosing Return
executes. Seed/beam inputs are declared test controls.

Five fixed PRNG vectors and eighteen enemy streams (three initializer cases,
three seeds and two constant beam words) come from independent Python arbitrary-
precision word arithmetic. They are reproducible from the repository root with:

```sh
python3 tools/random_vectors.py
```

The source is pinned [`src/lib/system.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/lib/system.cpp),
including `mulu32`, `next_random`, `lib_fn_rnd` and `lib_in_randomize`.
Eight execution groups cover these vectors, cached/reseeded results, beam wrap,
integer routing, inclusive/large bounds, factory/lifecycle state, malformed host
results and bounded rejection. An independent-byte conformance fixture specifies
original tokens and literal expected sequences.

The [self-contained browser data inspector](../demos/random.html) checks all five
vectors and 216 original initializer steps, then exposes seed/beam selection,
step/reset and cached-read controls. It shares its evaluator/assertions with
Playwright and has an HTML Preview link in the [gallery](../demos/index.html).
These are source-derived/injected checks; no native execution or Amiga capture
has been added.

The unmodified Wonderland source now compiles completely. Controlled game entry
reaches the attached-sprite publication gate at Wait Vbl line 204; see
[the milestone](wonderland.md) and [selector/whole-program evidence](file-selector.md).
