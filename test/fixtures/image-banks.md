# Independent image-bank bytes

`image-banks.hex` is hand-specified, independent of the token and image encoders.
It is not an AMOS export. The program has an empty code section and two banks:
AmSp (two slots, the second empty) and AmIc (one image).

Each nonempty image is 16 by 2 pixels and two planes deep. Plane zero contains
words A000,4000; plane one contains 6000,8000. Thus the first row begins with
indices 1,2,3,0 and the second with 2,1,0,0. The stored X hotspot C001 checks
that the loader clears flipping flags; Y FFFF represents -1. Both palettes
start with black, red, green, blue; the remaining entries are black.

The layout follows the [manual's Appendix E](https://amospromanual.dev/99-appendix-e-memory-bank-structures.html)
and the original [+Lib.s loader](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/master/%2BLib.s),
specifically Bnk.Load/LB_FIcons. These are source/manual-derived expectations,
pending AMOS execution comparison. No upstream code or bitmap assets were copied.
