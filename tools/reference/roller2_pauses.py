"""Original PAUSE/IPause source/asset oracle; no production-runtime imports.
Uses portable font and raster origin, not native AMOS captures.
"""
import runpy
import struct
import zlib
import json
import hashlib
from pathlib import Path
here = Path(__file__).resolve().parent
base = runpy.run_path(str(here / 'roller2_progression.py'))
root, panel, assets = base['root'], base['panel'], base['assets']
frames = []
for name, score_text, time_text, popup in [
    ('pause-paid.png', 'Score(Paused):225 ', 'Time   :29 ', False),
    ('pause-screen.png', 'Score  :225', 'Time   :29 ', True),
    ('pause-resumed.png', 'Score  :225', 'Time   :30 ', False)]:
    pixels = base['pixels'][:]
    for row, message in [(25,score_text),(27,time_text)]:
        pixels[row*8*320:(row+1)*8*320] = bytes(8*320)
        for column, char in enumerate(message):
            for y, bits in enumerate(panel['glyphs'][char]):
                for x in range(8):
                    if bits & (1<<x):
                        pixels[(row*8+y)*320+column*8+x] = 1
    foreground = bytearray(320*32)
    if popup:
        image = assets['images'][78]
        for y in range(image['height']):
            for x in range(image['width']):
                at = y*image['width']+x
                if image['mask'][at]:
                    foreground[(y+5)*320+x+100] = image['pixels'][at]
    palette, rgba = base['palette'], bytearray()
    for at, value in enumerate(pixels):
        x, y = at%320, at//320
        rgb = 0 if popup else palette[value&31]
        channels = [rgb>>shift&15 for shift in (8,4,0)]
        if value&32:
            channels = [c//2 for c in channels]
        if not popup and base['bx']<=x<base['bx']+16 and base['by']<=y<base['by']+base['ball']['height']:
            code = base['ball']['pixels'][(y-base['by'])*16+x-base['bx']]&15
            if code:
                rgb = palette[16+code]
                channels = [rgb>>shift&15 for shift in (8,4,0)]
        if value==1 and 200<=y<242:
            rgb = panel['rainbow'][y-200]
            channels = [rgb>>shift&15 for shift in (8,4,0)]
        if popup and 90<=y<122:
            value = foreground[(y-90)*320+x]
            rgb = palette[value&31]
            channels = [rgb>>shift&15 for shift in (8,4,0)]
            if value&32:
                channels = [c//2 for c in channels]
        rgba.extend([c*17 for c in channels]+[255])
    scan = b''.join(b'\0'+rgba[y*1280:(y+1)*1280] for y in range(250))
    chunk = assets['chunk']
    png = b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',320,250,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b'')
    (root / 'test/fixtures/roller2' / name).write_bytes(png)
    frames.append(dict(png=name,rgbaSha256=hashlib.sha256(rgba).hexdigest()))
(root / 'test/fixtures/roller2/pauses.json').write_text(json.dumps(dict(evidence='Independent raw assets and original 966–984; portable font/origin, injected clock, not native execution.',frames=frames),indent=2)+'\n')
