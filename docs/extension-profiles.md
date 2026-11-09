# Compile-time extension mappings

Tokenized AMOS programs encode an extension slot, cached verifier reference and
command-table offset. They do not establish which third-party library/version
occupied that slot. Supply that mapping when compiling:

```sh
node bin/amoscript --extension 8=amcaf-1.50beta4 \
  --extension 12=turbo-plus-2.15 Main.AMOS game.js

node tools/build_game_page.js Main.AMOS game.html \
  --extension 8=amcaf-1.50beta4 --extension 12=turbo-plus-2.15
```

Repeat `--extension` for distinct slots. The available third-party version IDs
are `amcaf-1.50beta4` and `turbo-plus-2.15`, corresponding to the pinned binary
hashes in [AMCAF](amcaf.md) and [Turbo Plus](turbo-plus.md). This identifies the
supported ABI; no original extension library is loaded or executed at compile
time. A profile does not imply support for every command in that library.

The JavaScript API accepts `new Transpiler(bytes, { extensions: {8:
'amcaf-1.50beta4', 12: 'turbo-plus-2.15'} })`. Profiles are copied and frozen per
compilation; slots may be reassigned. Existing official built-in extension
behavior remains the default on slots without an explicit third-party mapping.
An explicit mapping replaces that slot completely: unknown offsets never fall
back to a different library. Invalid slots, versions and duplicate CLI mappings
reject. Unsupported commands identify the slot, offset, selected library and
original physical source location. Cached reference bytes are retained as
metadata, not used to guess another overload or library.

In Builder's **Advanced** section, enter comma-separated mappings such as
`8=amcaf-1.50beta4, 12=turbo-plus-2.15`. Saved version-1 projects retain the map in
`options.extensions`; old projects default to an empty map. The project CLI,
desktop preview/export and page builder use the same compiler options, including
linked programs. The emitted game has no dependency on catalogs, Python, the
extension binaries or a runtime slot-selection step.

## Currently implemented subset

| Library | Commands |
|---|---|
| AMCAF | Bank Temporary; Odd; Even; Vclip; Vin; Chr.w$; Chr.l$; Asc.w; Asc.l; Flush Libs; Audio Lock |
| Turbo Plus | Word Hunt |

Function signatures retain their exact types and internal separators. Vclip/Vin
use `(value, lower To upper)`; Word Hunt uses `(start To end, action, lower To
upper)`. Operands evaluate left-to-right once. Functions carry explicit result
types through assignments, expressions and procedures; string returns are not
inferred solely from command spelling. Statement/function misuse rejects.

Odd/Even return AMOS -1/0 from bit zero. Vclip applies the upper bound before the
lower bound, so reversed bounds produce the lower bound. Vin includes both
endpoints. Chr.w$/Chr.l$ return two/four big-endian bytes, including NUL; Asc.w/
Asc.l require at least that many bytes and return unsigned word/signed long bits.
Numeric operands use the existing AMOS integer conversion rules.

Bank Temporary clears the existing bank's permanent flag without replacing its
payload, address or identity. Missing banks reject. Per-factory bank ownership
and ordinary Erase Temp behavior are retained.

Word Hunt follows Turbo R09f: round both addresses down to even, sort them,
compare signed words and return the first matching address or zero. Action zero
tests equality with the low word of the lower value; negative searches outside
the inclusive range, positive searches inside. Values are not reordered. The end
is normally exclusive, but equal aligned addresses still read one word. The
portable subset preflights the complete range, snapshots its bytes and caps reads
at 1 MiB; even an early match cannot hide an invalid later range. Only existing
checked memory regions are accessible; native low system addresses remain gated.

The implementation uses library-specific token descriptors, separate extension
AST nodes and ordinary instruction-function IR. Production tables contain only
implemented semantics; the much larger reverse-engineering catalogs remain
diagnostic. No mutable process-global command registration is involved.

## Evidence and remaining work

Synthetic tokenized tests execute emitted modules in a sandbox without require,
exercise remapped/wrong/missing profiles, typed strings/integers, native separator
grammar, memory boundaries and factory/address isolation. CLI/page/project tests
cover option propagation; the Electron smoke saves and reopens the form mappings.
Expectations derive from the recovered routines, not native Amiga captures.

The [system-information contract](system-information.md) adds explicit read-only
Exec version metadata and portable startup command notifications. Ghostlight's
bounded original PREPARE routine completes with this opt-in host setting.
Ghostlight still rejects at `Pt Play`, slot 8 `$108e`, line 43, byte 2084.
No complete Ghostlight build or gameplay has passed. Continue with the
[Ghostlight milestone plan](ghostlight-extension-plan.md): boot/system-information
contracts, graphics/masked blocks, and AMCAF music/SFX/timing remain open.
