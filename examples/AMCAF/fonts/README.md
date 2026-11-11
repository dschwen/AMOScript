# Font supplied to the Fonts example

The Fonts browser page preloads an AROS topaz-compatible 16-pixel font for the
original `Change Font "topaz",16` request. Its bitmap is the AROS topaz 8 glyph
set scaled twofold in each dimension, with baseline 12. This choice is declared
on the page and in its catalogue. The original 50-pixel Iva bank and 8×8 Print
bank remain embedded in the unchanged AMOS program.

AROS source revision 8335ca3e13c6c388fa861e2929a2c45ad22d35f7 is pinned under
[tools/reference/aros-topaz](../../../tools/reference/aros-topaz/default_font.c).
Copyright (C) 1995–2026, The AROS Development Team. All rights reserved.
The source and derived font use the [AROS Public License 1.1](../../../tools/reference/aros-topaz/LICENSE.AROS).
The upstream source is [rom/graphics/default_font.c](https://github.com/aros-development-team/AROS/blob/8335ca3e13c6c388fa861e2929a2c45ad22d35f7/rom/graphics/default_font.c).

Regenerate the atlas with `python3 tools/reference/make_amcaf_fonts.py`.
