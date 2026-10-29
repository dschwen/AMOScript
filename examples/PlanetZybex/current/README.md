# Current playable Planet Zybex

`Zybex.AMOS` is a minimal source-level correction of the frozen parent program.
Only physical lines **1494, 1499 and 1506** change. The vertical docking routine
used horizontal source rectangles starting at x=480 on a 320-pixel-wide map,
which native Screen Copy correctly ignores. These calls now use
`Screen Copy 1,0,LOP,320,LOP+160 To Logic(2),0,0`, matching the vertical game loop.
The docking background therefore stays at source row 480 across buffer swaps.

Physical line sizes, code offsets, headers and embedded image/sample banks are
unchanged. The parent `../Zybex.AMOS` remains byte-for-byte frozen. The manifest
pins both source hashes and refers to the existing seven parent asset files;
no assets are duplicated or modified.

To reproduce into a new output file:

```sh
node tools/fix_zybex_docking.js examples/PlanetZybex/Zybex.AMOS /tmp/zybex-fixed.AMOS
```

The patch utility accepts only the pinned upstream hash and writes exclusively.
It is an offline source tool, never part of compilation or runtime execution.
Source tests check the exact changed lines and exercise both the upstream no-op
and corrected logical-buffer copy. See
[vertical docking acceptance](../../../docs/planet-zybex-level2.md).
