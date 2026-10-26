# Current supplied Roller II assets

The playable `roller2-game` demo uses this manifest. It records all 34 source/data
files by byte length and SHA-256. Files changed in the latest supplied `RII/`
directory are copied here; unchanged entries refer to the earlier pinned files
with `../` paths. Every entry is a literal supplied file, not generated artwork.

The restored `Roller II.AMOS` is byte-identical to the earlier working 65,808-byte
source. The refresh changes Highscores, Roller_HELP, the title image and levels
1, 7, 16 and 17, and adds `iffp/roller hi` and `iffp/roller bounce`.

The earlier `examples/Roller2/manifest.json` and its assets stay frozen for the
existing bounded renderer, gameplay and missing-resource regression fixtures.
`test/helpers/roller2CurrentAssets.js` prepares the current byte-string filesystem
for the complete-source demo. It does not load files from the untracked `RII/`
directory at browser runtime.

Current level 1 has six collectible tiles and a warp tile. The input/lifecycle
replay follows that original path into level 3, reaches game-over music, exits
through the restored score image and score scroll, reloads title MOD music and
starts a fresh game. This does not establish completion of every level or editor.
See [the live-game contract](../../../docs/roller2-game.md).
