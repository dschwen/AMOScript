"""Independent exact point-in-polygon and closed-form edge raster oracle.
Portable profile expectations; not an Amiga AreaEnd capture.
"""
from fractions import Fraction
import hashlib
import json
from pathlib import Path
root = Path(__file__).resolve().parents[2]

cases = [
    ('rectangle', [(2, 2), (11, 2), (11, 8), (2, 8)]),
    ('triangle', [(1, 1), (13, 1), (1, 10)]),
    ('reverse triangle', [(1, 10), (13, 1), (1, 1)]),
    ('concave', [(2, 2), (12, 2), (12, 5), (6, 5), (6, 10), (2, 10)]),
    ('crossed', [(2, 1), (13, 10), (2, 10), (13, 1)]),
    ('clipped', [(-4, -3), (9, -3), (9, 7), (-4, 7)]),
    ('clipped triangle', [(-5, 3), (5, -5), (17, 9)]),
    ('collinear', [(1, 2), (7, 5), (13, 8)]),
    ('point', [(6, 4), (6, 4), (6, 4)]),
    ('repeated', [(2, 2), (11, 2), (11, 2), (11, 8), (2, 8), (2, 2)]),
    ('outside', [(-10, -10), (-5, -10), (-5, -5)]),
    ('extreme', [(-32768, 0), (32767, 0), (0, 32767)]),
]
width, height = 16, 12
frames = []
for name, points in cases:
    mask = bytearray(width * height)
    edges = list(zip(points, points[1:] + points[:1]))
    # Classify each pixel separately with exact rational crossings.
    for y in range(height):
        for x in range(width):
            inside = False
            px, py = Fraction(2*x+1, 2), Fraction(2*y+1, 2)
            for (ax, ay), (bx, by) in edges:
                if (ay > py) != (by > py):
                    crossing = ax + (py-ay)*Fraction(bx-ax, by-ay)
                    if px < crossing:
                        inside = not inside
            if inside:
                mask[y*width+x] = 3
    # Boundary uses closed-form rounded major-axis positions, not the runtime
    # error-accumulation loop. Canonical direction is lower Y, then lower X.
    for a, b in edges:
        if (a[1], a[0]) > (b[1], b[0]):
            a, b = b, a
        dx, dy = abs(b[0]-a[0]), b[1]-a[1]
        steps = max(dx, dy)
        sign = 1 if b[0] > a[0] else -1
        for i in range(steps+1):
            x = a[0] + sign * ((2*i*dx+steps)//(2*steps) if steps else 0)
            y = a[1] + ((2*i*dy+steps)//(2*steps) if steps else 0)
            if 0 <= x < width and 0 <= y < height:
                mask[y*width+x] = 3
    frames.append(dict(name=name, points=points, pixelsHex=mask.hex()))
result = dict(evidence='Independent Python Fraction ray classification and closed-form half-up boundary pixels for the declared portable fill profile; no native AreaEnd capture.',
              sourceSha256=hashlib.sha256((root/'examples/Introideen/KugelanimBerech.Bak').read_bytes()).hexdigest(),
              width=width, height=height, frames=frames)
(root/'test/fixtures/polygon.json').write_text(json.dumps(result, indent=2)+'\n')
