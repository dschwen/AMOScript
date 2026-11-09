#!/usr/bin/env python3
"""Independent packed-screen run expansion; report metadata/hashes, never asset bytes."""
import argparse
import hashlib
import json
import struct
from pathlib import Path


def inspect(filename):
    file = Path(filename).read_bytes()
    raw = file[20:] if file[:4] == b'AmBk' and file[12:20] == b'Pac.Pic.' else file
    if raw[:4] != bytes.fromhex('12031990') or raw[90:94] != bytes.fromhex('06071963'):
        raise ValueError('Expected full packed screen')
    width, height = struct.unpack_from('>HH', raw, 4)
    columns, bands, square, planes = struct.unpack_from('>4H', raw, 98)
    if not width or not height or width != columns * 8 or height != bands * square or not 1 <= planes <= 6 or width * height > 1024 * 1023:
        raise ValueError('Invalid bitmap traversal dimensions')
    flags_at = 90 + struct.unpack_from('>I', raw, 106)[0]
    pointers_at = 90 + struct.unpack_from('>I', raw, 110)[0]
    if not 114 < pointers_at < flags_at < len(raw):
        raise ValueError('Invalid stream boundaries')
    literals, flags = iter(raw[114:pointers_at]), iter(raw[flags_at:])
    bits = [(byte >> bit) & 1 for byte in raw[pointers_at:flags_at] for bit in range(7, -1, -1)]
    last_flag, last_byte = next(flags), next(literals)
    expanded = bytearray()
    count = columns * height * planes
    for group in range((count + 7) // 8):
        if bits[group]:
            last_flag = next(flags)
        for bit in range(7, -1, -1):
            if len(expanded) == count:
                break
            if last_flag & (1 << bit):
                last_byte = next(literals)
            expanded.append(last_byte)
    planar = [bytearray(columns * height) for _ in range(planes)]
    traversal = iter(expanded)
    for plane in planar:
        for band in range(bands):
            for column in range(columns):
                for dy in range(square):
                    plane[(band * square + dy) * columns + column] = next(traversal)
    pixels = bytes(sum(((planar[p][y * columns + x // 8] >> (7 - x % 8)) & 1) << p for p in range(planes)) for y in range(height) for x in range(width))
    return dict(bytes=len(file), sourceSha256=hashlib.sha256(file).hexdigest(), width=width, height=height,
                depth=planes, control=f'{struct.unpack_from(">H", raw, 20)[0]:04x}',
                indexedSha256=hashlib.sha256(pixels).hexdigest(),
                rowSha256={str(y):hashlib.sha256(pixels[y*width:(y+1)*width]).hexdigest() for y in (0, height//2, height-1)})


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file')
    print(json.dumps(inspect(parser.parse_args().file), indent=2))
