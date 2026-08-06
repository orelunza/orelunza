#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import struct
from pathlib import Path

FACES = ['positive-x', 'negative-x', 'positive-y', 'negative-y', 'positive-z', 'negative-z']


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('pack')
    args = parser.parse_args()
    root = Path(args.pack)
    manifest = json.loads((root / 'manifest.json').read_text())
    resolution = int(manifest['tileResolution'])
    expected_size = 16 + resolution * resolution * 3
    count = 0
    minimum = 32767
    maximum = -32768
    for level in range(int(manifest['minimumLevel']), int(manifest['maximumLevel']) + 1):
        side = 2 ** level
        for face_index, face in enumerate(FACES):
            for x in range(side):
                for y in range(side):
                    path = root / 'tiles' / face / str(level) / str(x) / f'{y}.orgt'
                    data = path.read_bytes()
                    if len(data) != expected_size:
                        raise SystemExit(f'Bad size: {path}')
                    magic, version, tile_resolution, tile_level, tile_face, tile_x, tile_y, low, high = \
                        struct.unpack_from('<4sBBBBHHhh', data, 0)
                    if (magic, version, tile_resolution, tile_level, tile_face, tile_x, tile_y) != \
                       (b'ORGT', 1, resolution, level, face_index, x, y):
                        raise SystemExit(f'Bad header: {path}')
                    minimum = min(minimum, low)
                    maximum = max(maximum, high)
                    count += 1
    print(f'OK: {count} tiles, elevation range {minimum}..{maximum} m')


if __name__ == '__main__':
    main()
