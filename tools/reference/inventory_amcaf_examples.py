#!/usr/bin/env python3
"""Static AMCAF collection inventory; no production registrations or asset exports."""
import hashlib,json,sys
from pathlib import Path
sys.dont_write_bytecode=True
from turbo_plus import scan_program
root=Path(__file__).resolve().parents[2]
core=json.loads((Path(__file__).parent/'amos-pro-tokens.json').read_text())['main']
names={t['offset']:t['name'] for t in json.loads((Path(__file__).parent/'amcaf-v1.50beta4/catalog.json').read_text())['tokens']}
rows=[]
for p in sorted((root/'examples/AMCAF/AMCAF_Examples').glob('*.AMOS')):
    raw=p.read_bytes();row=dict(source=p.name,sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw))
    try:
        result=scan_program(raw,{},core,extension_slot=-1);calls={}
        for c in result['occurrences']:calls.setdefault((c['slot'],c['offset']),[]).append(c['line'])
        row['extensions']=[dict(slot=slot,offset=hex(offset),name=names.get(offset) if slot==8 else None,lines=lines) for (slot,offset),lines in sorted(calls.items())]
    except ValueError as error:row['inventoryError']=str(error)
    rows.append(row)
print(json.dumps(rows,indent=2))
