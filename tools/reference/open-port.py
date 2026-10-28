"""Independent transcription of the supplied printer programs' byte streams.
No production compiler/runtime imports; escape commands are literal source data.
"""
import base64
import hashlib
import json
from pathlib import Path
root = Path(__file__).resolve().parents[2]
e = b'\x1b'
def commands(parts):
    return b''.join(e + part.encode('ascii') for part in parts)
init = commands(['&k1W', '&s0C', '&l26A', '&l5D', '&l0O', '&l6600P', '&l0L', '&l1E', '&6200F', '9', '&a5L', '$a80M', '&k5W', '(10U', '(s0P', '(s10H', '(s12V', '(s0S', '(s0B', '(s3T', '(s2Q']) + b'\r\n'
line = b'the quick brown fox eats his balls\r\n'
portrait = lambda font: commands(['&l0O', '(10U', font])
current = init + commands(['&l1O', '(10U', '(s0p10h24v0s0b3t2Q']) + line
backup = init + line + (portrait('(s0p12h12v0s0b6t2Q') + line + portrait('(s1p12v0s0b4101t2Q') + line + portrait('(s0p10h12v0s0b3t2Q') + line) * 15
ascii_init = commands(['&k1W', '&s0C', '&l3A', '&l6D', '&l0O', '&l66P', '&l0L', '&l1E', '&62F', '9', '&a5L', '$a80M', '(s1Q', '(0U', '(s1P', '(s6H', '(s50V', '(s0S', '(s0B', '(s4101T', '&a0R', '&k0G'])
ascii_table = ascii_init + b'\r\n' + b' '*50 + b'ASCII-Code Tabelle\r\n\n\r\n' + b'                 gewidmet: Cord dem ZENTISPASTAMOEBENHIRN !!!!!!!!!!!!!\r\n\n\t\n\r\n'
for row in range(32):
    for column in range(8):
        number = column * 32 + row
        ascii_table += f'{number:03}'.encode('ascii') + (b' ' + bytes([number]) + b'  ' if number > 27 else b'    ') + b'\t'
    ascii_table += b'\r\r\n'
result = {}
for name, data in [('ASCIIPC.Bak', ascii_table), ('LetterQualityProcs.amos', current), ('LetterQualityProcs.Bak', backup)]:
    result[name] = dict(sourceSha256=hashlib.sha256((root/'examples/Introideen'/name).read_bytes()).hexdigest(), byteLength=len(data), sha256=hashlib.sha256(data).hexdigest(), base64=base64.b64encode(data).decode('ascii'))
(root/'test/fixtures/open-port.json').write_text(json.dumps(result, indent=2)+'\n')
