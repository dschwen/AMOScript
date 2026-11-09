# Original token catalogue

`amos-pro-tokens.json` contains offsets, names and signatures read from assembled
AMOS Professional library tables. These are diagnostic metadata, separate from
the compiler's supported-token table. Source:
[AMOS Professional Official](https://github.com/AOZ-Studio/AMOS-Professional-Official),
revision `7f32e0abe1b6b415c9502b598cd3e4cb131018f8`; license preserved alongside.
The JSON records each input library's size and SHA-256 hash. Reproduce using that
checkout's assembled library directory:

```sh
node tools/import_token_catalog.js /path/to/reference/build > /tmp/amos-pro-tokens.json
```

`tools/audit_program.js` reads bounded physical AMOS lines, handles the known
literal/control-flow/extension payload forms, and reports all token occurrences
and locations before attempting the actual compiler. Unknown encodings and
truncated payloads reject; the scanner does not guess a resynchronization point.
It is an inventory tool for this format subset, not an alternate parser or proof
that a named command has implemented semantics.

## Third-party extension reverse engineering

[Turbo Plus V2.15](../../docs/turbo-plus.md) and
[AMCAF V1.50beta4](../../docs/amcaf.md) have full diagnostic command catalogs,
relocation-aware IRA/binutils listings, restored original example listings and
implementation notes. `turbo_plus.py` and `amcaf.py` reproduce the artifacts from
the supplied distributions; `--check` verifies reproducibility. Original binary
hashes are pinned, and optional independent amostools token images validate the
recovered offsets/names/signatures. These catalogs do not enable runtime support.

## Target extension inventories

`inventory_extensions.py` walks tokenized source with the bounded reference
decoder and resolves commands using explicit `--extension SLOT=CATALOG` mappings.
It does not enable compiler support. The checked-in `ghostlight-extensions.json`
contains only hashes, signatures and call locations; the game remains external.
See the [Ghostlight implementation plan](../../docs/ghostlight-extension-plan.md)
for the reproduction command and acceptance milestones.

`check_packed_picture.py FILE` independently expands packed bitmap runs and
reports dimensions, source/index hashes and selected row hashes. The
`ghostlight-walls.json` report is metadata only; its source atlas remains external.
See [packed storage screens](../../docs/packed-storage-screens.md).
