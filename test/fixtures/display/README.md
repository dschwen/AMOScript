# Display foundation fixtures

All files here are **synthetic**, not AMOS or emulator captures.

`basic-planar.frame.json` describes a two-line, one-plane OCS field. Its full
512 KiB chip blob starts with words `$A050,$F00F`, then zeros. Row pointers are
0 and 2; BPLCON0 is `$1000`; horizontal window is 0–4 native samples, at two
samples per lowres pixel. Palette zero is black and one is red. Reading the first
two high bits of each word gives source pixels `[1,0]` then `[1,1]`, so the golden
rows are red/red/black/black and red/red/red/red. Origin 128/50 and square native
aspect are synthetic metadata, not calibrated Amiga capture geometry.

Tables were independently encoded using Python `struct.pack('>I', value)`,
palette bytes and zero-filled sprite/event arrays, without the production codec.
The golden PNG was constructed independently with Python `struct`, `zlib` and
`binascii.crc32`. The manifest includes exact blob sizes and SHA-256 hashes.

`filters-rgb.png` and `filters-rgba.png` are independent Python-encoded 2×5 PNGs.
Their row filter numbers are 0, 1, 2, 3, 4 respectively. Each unfiltered sample
has value `(y*41+x*17+channel*29)&255`; RGB decoding adds opaque alpha. RGBA
includes nonopaque alpha and therefore checks preservation before presentation.
The Python encoder subtracts the PNG filter predictor modulo 256, compresses
with zlib and computes chunk CRCs with binascii. The runtime/test PNG encoder did
not generate these files. Tests compare decoded bytes to the formula, not to
round-tripped production output.

These fixtures validate the ABI and harness. A stub returning the golden cannot
establish bitplane decode semantics. P1's renderer must separately match these
hand-derived bit patterns, odd-width/stride/plane-order cases and capture gates.

The basic reference renderer now separately passes the hand-derived ABI fixture.
`ilbm-fixtures.json` lists independent raw/ByteRun1 IFF files and PNG goldens at
2/4/8/16/32 colours, with SHA-256 hashes and synthetic provenance. Each source
image is 33×3, with colour index `(x+3*y) % colours`; palette RGB is
`[(index&15)*17, ((index>>4)&1)*255, ((index*3)&15)*17]`. Golden rows duplicate each
source pixel twice on the native lowres grid. BMHD records position -3/4 and
aspect 10/11. Row bytes are padded to six, with unused bits set to one so a decoder
cannot mistake padding for additional visible pixels. BODY rows are interleaved
by plane. Compressed files use independent Python repeat/literal packets and
NOPs; the odd-sized JUNK chunk exercises IFF padding. PNG chunks, zlib and CRCs
were constructed with Python, independently of the production PNG encoder.

`ehb-fixtures.json` describes independent raw/ByteRun1 EHB pictures and a PNG
golden. The source is 67×2: index is `x%64` on row zero and `(63-x)&63` on row one.
Base palette nibbles are `[i&15,(3*i+1)&15,(5*i+7)&15]`; index bit 5 halves each
nibble before multiplying by 17. This distinguishes four-bit halving from
eight-bit division and tests all 64 indices plus padding bits set to one.

`laced-fixtures.json` lists even/odd-height, hires and EHB interlaced pictures
with raw/ByteRun1 versions and full-output PNGs. Each is 33 pixels wide; index is
`(x+5*y) % (1<<depth)`. Palette nibbles are `[i&15,(3*i+1)&15,(7*i+2)&15]` for
the base registers. Heights are four or five, with CAMG LACE set. Goldens use
all source rows directly, while the production reader selects alternate rows
and the composer weaves them. Both field orders must match those independent
PNGs. Headers use aspect 20/11, and row padding is filled with ones. Python
struct/zlib/binascii created these files; production codecs did not generate
the IFFs, PNGs or expected row selection. These remain synthetic, not captures.

`ham-fixtures.json` lists ten six-plane HAM images (seeds 0–9), a five-plane
image (10) and a laced six-plane image (11), each with raw/ByteRun1 IFF and PNG
SHA-256 hashes. Widths are 17,33,47,64,79,95,113,129,161,257,97,67; heights are
`2+seed%3`, except the laced image's five rows. Palette nibbles are
`[(i+seed)&15,(3*i+2*seed+1)&15,(5*i+3*seed+2)&15]` for 16 registers.
Command data is `(7*x+5*y+3*seed)&15`; control is `(x+y+seed)%4` except seed 9's
modify-only `1+(x+y)%3` and seed 10's `(x+y)&1`. Seeds 6,7,8,11 begin each row
with control `1+y%3`. The independent Python reference updates RGB tuples from
COLOR00 per row and duplicates source pixels; production uses packed colour
words. Source padding bits are ones. Python struct/zlib/binascii encode the
IFF/PNG files; ByteRun1 uses literal packets and NOPs. These fixtures do not
provide external AMOS execution or hardware captures.
