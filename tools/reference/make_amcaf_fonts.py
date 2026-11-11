#!/usr/bin/env python3
"""Prepare an explicitly supplied AROS topaz-compatible 16-pixel host font."""
import base64, hashlib, json, re
from pathlib import Path
root = Path(__file__).resolve().parents[2]
source = (Path(__file__).parent / 'aros-topaz/default_font.c').read_text()
# AROS defines the ISO-8859-15 Euro form in its first preprocessor branch.
euro = {f'A4_{n}': int(re.search(rf'#define A4_{n} (0x[0-9A-Fa-f]+)', source)[1], 16) for n in range(8)}
def array(name):
    body = re.search(rf'{name}\[\].*?\{{(.*?)\}};', source, re.S)[1]
    body = re.sub(r'/\*.*?\*/', '', body, flags=re.S)
    return [euro[value] if value in euro else int(value, 16) for value in re.findall(r'0x[0-9a-fA-F]+|A4_[0-7]', body)]
bitmap = array('topaz8_chardata')
locations = array('topaz8_charloc')
assert len(bitmap) == 1536 and len(locations) == 225
atlas = bytearray(256 * 16 * 2)
for code in range(256):
    location = locations[code - 32 if code >= 32 else 224]
    start, width = location >> 16, location & 65535
    assert width == 8
    for y in range(16):
        for x in range(16):
            bit = start + x // 2
            if bitmap[(y // 2) * 192 + bit // 8] & (128 >> (bit % 8)):
                atlas[(code * 16 + y) * 2 + x // 8] |= 128 >> (x % 8)
font = dict(name='topaz.font', width=16, height=16, baseline=12,
            provenance='AROS topaz 8, revision 8335ca3e13c6c388fa861e2929a2c45ad22d35f7, nearest-neighbour 2x bitmap scaling; APL 1.1.',
            data=base64.b64encode(atlas).decode(), sha256=hashlib.sha256(atlas).hexdigest())
(root / 'examples/AMCAF/fonts/topaz-16.json').write_text(json.dumps(font, indent=2) + '\n')
