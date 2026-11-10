#!/usr/bin/env python3
"""Independent pattern/order timing audit of the supplied decoded Hawkeye MOD.
Input must match the pinned expanded IMP! digest. No JS player or decoder imports.
This audits the encoded tune, not native playback or analog audio.
"""
import hashlib,json,sys
from pathlib import Path

def inspect(data):
    digest=hashlib.sha256(data).hexdigest()
    if digest!='847b4017191e92ab5140d447d4edf218186237d10f9ed96e277ed285cf45013a':
        raise ValueError('Expected the supplied expanded mod.hawkeye')
    if data[1080:1084]!=b'M.K.':raise ValueError('Expected M.K.')
    orders=data[952:952+data[950]]
    # Native first row waits six ticks; a row F01..1f supplies the delay
    # until the following row. Hawkeye has no order/row jumps or pattern loops.
    delay=6;ticks=triggers=filters=fine_rows=0
    for index,pattern in enumerate(orders):
        for row in range(64):
            ticks+=delay;next_delay=delay;filter_cells=0
            for voice in range(4):
                at=1084+pattern*1024+row*16+voice*4
                a,b,c,p=data[at:at+4]
                effect=c&15;period=(a&15)*256+b
                if effect in [11,13] or effect==14 and p>>4==6:raise ValueError('Unsupported order flow in audit')
                if period and effect not in [3,5]:triggers+=1
                if effect==15 and 0<p<32:next_delay=p
                if effect==14:
                    if p>>4==0:filter_cells+=1
                    if p>>4 in [10,11]:fine_rows+=1
            # The final row's intervening ticks occur after the first wrap.
            filters+=filter_cells*(1 if index==len(orders)-1 and row==63 else next_delay)
            delay=next_delay
    return dict(evidence='Independent Python order/cell audit of pinned decoded bytes; not native execution.',
      decodedSha256=digest,decodedBytes=len(data),orders=len(orders),rows=len(orders)*64,
      ticks=ticks,triggers=triggers,filterWrites=filters,fineVolumeCells=fine_rows)

if __name__=='__main__':print(json.dumps(inspect(Path(sys.argv[1]).read_bytes()),indent=2))
