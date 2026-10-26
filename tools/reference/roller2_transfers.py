"""Independent raw-asset expectations for original editor Fill/Copy statements.
No AMOScript imports, editor execution or Amiga captures.
"""
import hashlib
import json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
levels=[]
for path in sorted((root/'examples/Roller2/levl').iterdir(),key=lambda p:int(p.name)):
    raw=path.read_bytes()
    assert raw[:4]==b'AmBk' and len(raw)==510
    payload=raw[20:]
    cleared=bytes([1])*240+bytes(240)+payload[480:]
    levels.append(dict(level=path.name,payloadSha256=hashlib.sha256(payload).hexdigest(),clearedSha256=hashlib.sha256(cleared).hexdigest(),metadataHex=payload[480:].hex()))
(root/'test/fixtures/roller2/transfers.json').write_text(json.dumps(dict(evidence=__doc__,levels=levels),indent=2)+'\n')
