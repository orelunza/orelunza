#!/usr/bin/env python3
"""Build Orelunza OREC cube-sphere ecology tiles from WorldCover-compatible rasters."""
from __future__ import annotations
import argparse
import math
import struct
from pathlib import Path
import rasterio
from rasterio.warp import transform

FACES = ['positive-x', 'negative-x', 'positive-y', 'negative-y', 'positive-z', 'negative-z']
WORLD_COVER_TO_ORELUNZA = {
    10: 1,   # tree cover
    20: 2,   # shrubland
    30: 3,   # grassland
    40: 4,   # cropland
    50: 5,   # built-up
    60: 6,   # bare / sparse
    70: 7,   # snow / ice
    80: 8,   # permanent water
    90: 9,   # herbaceous wetland
    95: 10,  # mangrove
    100: 11, # moss / lichen
}


def direction(face: str, u: float, v: float) -> tuple[float, float, float]:
    s = max(0.0, min(1.0, u)) * 2.0 - 1.0
    t = max(0.0, min(1.0, v)) * 2.0 - 1.0
    values = {
        'positive-x': (1.0, t, -s),
        'negative-x': (-1.0, t, s),
        'positive-y': (s, 1.0, -t),
        'negative-y': (s, -1.0, t),
        'positive-z': (s, t, 1.0),
        'negative-z': (-s, t, -1.0),
    }[face]
    length = math.sqrt(sum(value * value for value in values))
    return tuple(value / length for value in values)


def latlon(face: str, u: float, v: float) -> tuple[float, float]:
    x, y, z = direction(face, u, v)
    return math.degrees(math.asin(y)), math.degrees(math.atan2(-z, x))


def write_tile(path: Path, face_index: int, level: int, x: int, y: int,
               resolution: int, land_cover: list[int], tree_cover: list[int],
               confidence: list[int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    count = resolution * resolution
    header = struct.pack('<4sBBBBHHHHII', b'OREC', 1, face_index, level, 0,
                         x, y, resolution, 0, 0, count)
    path.write_bytes(header + bytes(land_cover) + bytes(tree_cover) + bytes(confidence))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--land-cover', required=True, help='ESA WorldCover/LCFM categorical raster')
    parser.add_argument('--tree-cover', help='Optional 0-100 tree-cover-density raster')
    parser.add_argument('--confidence', help='Optional 0-100 confidence raster')
    parser.add_argument('--output', required=True)
    parser.add_argument('--maximum-level', type=int, default=6)
    parser.add_argument('--resolution', type=int, default=33)
    args = parser.parse_args()

    output = Path(args.output)
    with rasterio.open(args.land_cover) as land_raster:
        tree_raster = rasterio.open(args.tree_cover) if args.tree_cover else None
        confidence_raster = rasterio.open(args.confidence) if args.confidence else None
        try:
            for level in range(args.maximum_level + 1):
                side = 2 ** level
                for face_index, face in enumerate(FACES):
                    for tile_y in range(side):
                        for tile_x in range(side):
                            latitudes, longitudes = [], []
                            for row in range(args.resolution):
                                for column in range(args.resolution):
                                    latitude, longitude = latlon(
                                        face,
                                        (tile_x + column / (args.resolution - 1)) / side,
                                        (tile_y + row / (args.resolution - 1)) / side,
                                    )
                                    latitudes.append(latitude)
                                    longitudes.append(longitude)
                            source_x, source_y = transform('EPSG:4326', land_raster.crs, longitudes, latitudes)
                            source_points = list(zip(source_x, source_y))
                            raw_cover = [int(value[0]) for value in land_raster.sample(source_points)]
                            land_cover = [WORLD_COVER_TO_ORELUNZA.get(value, 0) for value in raw_cover]
                            if tree_raster:
                                tx, ty = transform('EPSG:4326', tree_raster.crs, longitudes, latitudes)
                                tree_cover = [max(0, min(100, int(round(value[0])))) for value in tree_raster.sample(zip(tx, ty))]
                            else:
                                tree_cover = [75 if value == 1 else 0 for value in land_cover]
                            if confidence_raster:
                                cx, cy = transform('EPSG:4326', confidence_raster.crs, longitudes, latitudes)
                                confidence = [max(0, min(255, int(round(value[0] * 2.55)))) for value in confidence_raster.sample(zip(cx, cy))]
                            else:
                                confidence = [220] * len(land_cover)
                            write_tile(
                                output / 'ecology-tiles' / face / str(level) / str(tile_x) / f'{tile_y}.orec',
                                face_index, level, tile_x, tile_y, args.resolution,
                                land_cover, tree_cover, confidence,
                            )
        finally:
            if tree_raster:
                tree_raster.close()
            if confidence_raster:
                confidence_raster.close()
    print(f'Wrote ecology tiles to {output}')


if __name__ == '__main__':
    main()
