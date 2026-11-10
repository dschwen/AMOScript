#!/usr/bin/env python3
"""Audit the recovered MOD's DMA fetches using native register transitions.
LAB_048C applies 9xx before and after a new note. LAB_04AC retriggers on
counter multiples, with a separate row-note guard. Input is pinned raw MOD.
"""
import hashlib,json,struct
from pathlib import Path
root=Path(__file__).resolve().parents[2]
data=(root/'examples/AMCAF/AMCAF_Examples/Data/mod.4spirits').read_bytes()
digest=hashlib.sha256(data).hexdigest()
assert digest=='77d3535bcbf378a2e9c06faea48bc114de2ea96bb379c98c6501c93f1a557ffd'
word=lambda at:int.from_bytes(data[at:at+2],'big')
headers=[dict(length=word(20+i*30+22)*2,repeat=word(20+i*30+26)*2,repeat_length=word(20+i*30+28)*2) for i in range(31)]
voices=[dict(sample=0,start=0,length=0,offset=0) for _ in range(4)]
orders=data[952:952+data[950]]
tick=0;delay=6;order=0;row=0;rows=0;triggers=[];row_trace=bytearray();offset_cells=0;e9_cells=0;retriggers=[]
def apply_offset(voice,param):
    if param:voice['offset']=param
    words=voice['length']//2
    if words>=32768:words-=65536
    offset_words=voice['offset']*128
    if offset_words>=words:voice['length']=2
    else:voice['start']+=offset_words*2;voice['length']-=offset_words*2

def trigger(at,channel,retrigger=False):
    voice=voices[channel];sample=voice['sample'];header=headers[sample-1] if sample else None
    start=voice['start'] if header and header['length'] else 0
    length=voice['length'] if header and header['length'] else 0
    assert start+length<=(header['length'] if header else 0)
    event=[at,channel,sample,start,length]
    triggers.append(event)
    if retrigger:retriggers.append(event)

while order<len(orders):
    tick+=delay;rows+=1;cells=[];next_delay=delay;next_order=order;next_row=row+1
    row_trace.extend(struct.pack('>IBB',tick,order,row))
    for channel in range(4):
        at=1084+orders[order]*1024+row*16+channel*4
        a,b,c,param=data[at:at+4];sample=(a&240)|(c>>4);note=((a&15)<<8)|b;effect=c&15
        voice=voices[channel];cells.append((effect,param))
        if sample:
            header=headers[sample-1];voice['sample']=sample;voice['start']=0
            voice['length']=header['repeat']+header['repeat_length'] if header['repeat'] else header['length']
        if effect==9:offset_cells+=1
        if note and effect not in (3,5):
            if effect==9:apply_offset(voice,param)
            trigger(tick,channel)
        if effect==9:apply_offset(voice,param)
        if effect==14 and param>>4==9:
            e9_cells+=1
            if param&15 and not note:trigger(tick,channel,True)
        if effect==15 and 0<param<32:next_delay=param
        assert effect!=11
        if effect==13:
            next_order=order+1;next_row=(param>>4)*10+(param&15)
            if next_row>63:next_row=0
    if next_row>=64:next_order=order+1;next_row=0
    if next_order>=len(orders):break
    for sub_tick in range(1,next_delay):
        for channel,(effect,param) in enumerate(cells):
            if effect==14 and param>>4==9 and param&15 and sub_tick%(param&15)==0:trigger(tick+sub_tick,channel,True)
    delay=next_delay;order=next_order;row=next_row
packed=b''.join(struct.pack('>IBBII',*event) for event in triggers)
result=dict(evidence='Independent Python native register/order audit of pinned recovered MOD.',sha256=digest,ticks=tick,rows=rows,triggers=len(triggers),offsetTriggers=sum(bool(t[3]) for t in triggers),offsetCells=offset_cells,retriggerCells=e9_cells,retriggers=retriggers,dmaSha256=hashlib.sha256(packed).hexdigest(),rowsSha256=hashlib.sha256(row_trace).hexdigest(),firstOffsets=[t for t in triggers if t[3]][:12])
(root/'test/fixtures/amcaf/spirits.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
