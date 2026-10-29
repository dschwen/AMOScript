"""Independent shipped interpreter profile and portable noise-reset vectors.
Transcribed +Interpreter_Config.s / extensions/+Music.s, pinned upstream
533b4b1f5acd604814513f78e02c7b4796cb0531. No runtime imports or Amiga captures.
"""
import hashlib,json
from pathlib import Path
palette=[0x000,0xa40,0xfff,0x000,0xf00,0x0f0,0x00f,0x666,0x555,0x333,0x733,0x373,0x773,0x337,0x737,0x377]+[0]*16
flash=[0x000,0x440,0x880,0xbb0,0xdd0,0xee0,0xff2,0xff8,0xffc,0xfff,0xaaf,0x88c,0x66a,0x226,0x004,0x001]
seed=0;beam=0x101

def wave():
    global seed
    result=bytearray()
    for _ in range(255):
        seed=(((seed+beam)&65535)*0x3171>>8)&65535
        result.extend(seed.to_bytes(2,'big'))
    return dict(seed=seed,sha256=hashlib.sha256(result).hexdigest())
first=wave()
for _ in range(16):seed=(((seed+beam)&65535)*0x3171>>8)&65535
second=wave()
(root:=Path(__file__).resolve().parents[2]).joinpath('test/fixtures/defaults.json').write_text(json.dumps(dict(palette=palette,flash=flash,speed=2,initialRgba=[170,68,0,255],initialSha256=hashlib.sha256(bytes([170,68,0,255])*320*200).hexdigest(),noiseFirst=first,noiseAfterTwoFieldsAndReset=second),indent=2)+'\n')
