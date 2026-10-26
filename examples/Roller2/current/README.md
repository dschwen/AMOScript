# Current supplied Roller II assets

The playable `roller2-game` demo uses this manifest. It records all 34 source/data
files by byte length and SHA-256. Files changed in the latest supplied `RII/`
directory are copied here; unchanged entries refer to the earlier pinned files
with `../` paths. Assets are supplied files, not generated artwork. The current AMOS source has
the documented [movement edge-check fix](movement-edge-fix.md).

The restored input was byte-identical to the earlier working 65,808-byte source.
The playable file is now 65,966 bytes after moving its existing board-edge check
before the next-cell reads; only physical lines 642 and 645 change. The refresh changes Highscores, Roller_HELP, the title image and levels
1, 7, 16 and 17, and adds `iffp/roller hi` and `iffp/roller bounce`.

The earlier `examples/Roller2/manifest.json` and its assets stay frozen for the
existing bounded renderer, gameplay and missing-resource regression fixtures.
`test/helpers/roller2CurrentAssets.js` prepares the current byte-string filesystem
for the complete-source demo. It does not load files from the untracked `RII/`
directory at browser runtime.

Current level 1 has six collectible tiles and a warp tile. The input/lifecycle
replay follows that path into level 3, collects the bottom-right time bonus and
stops safely at the edge, reaches game-over music, exits
through the restored score image and score scroll, reloads title MOD music and
starts a fresh game. This does not establish completion of every level or editor.
See [the live-game contract](../../../docs/roller2-game.md).
