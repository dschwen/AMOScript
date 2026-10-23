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
