"""Independent Roller II level header oracle; no AMOScript imports.

Run from any directory to print the checked-in source/asset-derived fixture.
This is not an Amiga execution capture.
"""
import hashlib
import json
from pathlib import Path
import struct

root = Path(__file__).resolve().parents[2]
levels = []
for path in sorted((root / 'examples/Roller2/levl').iterdir(), key=lambda path: int(path.name)):
    raw = path.read_bytes()
    assert raw[:4] == b'AmBk' and len(raw) == 510
    number, memory, length = struct.unpack_from('>HHI', raw, 4)
    assert (number, memory, length, raw[12:20]) == (10, 1, 498, b'Work    ')
    levels.append({'level': path.name, 'sha256': hashlib.sha256(raw).hexdigest(),
                   'x': raw[20 + 482], 'y': raw[20 + 483], 'colour': raw[20 + 484],
                   'time': struct.unpack_from('>H', raw, 20 + 486)[0]})
print(json.dumps({'evidence': 'Independent Python struct/byte extraction from pinned 20-byte AmBk headers plus original payload offsets 482/483/484/486; no AMOScript bank reader. Source/asset-derived, not an Amiga capture.', 'levels': levels}, indent=2))
