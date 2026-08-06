#!/usr/bin/env python3
"""Inspect one ORGT binary tile."""
from __future__ import annotations
import argparse
import struct
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('tile')
    args = parser.parse_args()
    data = Path(args.tile).read_bytes()
    header = struct.unpack_from('<4sBBBBHHhh', data, 0)
    print({
        'magic': header[0].decode('ascii'), 'version': header[1], 'resolution': header[2],
        'level': header[3], 'faceIndex': header[4], 'x': header[5], 'y': header[6],
        'minimumElevationMeters': header[7], 'maximumElevationMeters': header[8],
        'bytes': len(data),
    })


if __name__ == '__main__':
    main()
