# Tutorial reference fixtures

`amos-pro-mouse.abk` is the unmodified `bin/+AMOSPro_Mouse.abk` from
[AMOS Professional Official](https://github.com/AOZ-Studio/AMOS-Professional-Official/tree/533b4b1f5acd604814513f78e02c7b4796cb0531),
commit `533b4b1f5acd604814513f78e02c7b4796cb0531` (upstream MIT license).

`+W.s` SPat/SoMouse skips the first four records (three pointer images plus
palette storage) before selecting area patterns. The display runtime embeds the
remaining 35 patterns as plane-major 16-bit row masks. The fixture lets tests
independently compare drawing against the original planar image bytes, including
the final three-plane pattern. Portable font/ellipse/border rasterization is not
an Amiga capture.

`menus6-original.amos` preserves the supplied Menus_6 source before its
documented line179 branch-table correction. The menu integration test requires
the original to fail strict label validation and checks that the corrected
demo changes only eight bytes, preserving every line and procedure offset.
See [the menu notes](../../../docs/menus.md#menus_6-source-correction).
