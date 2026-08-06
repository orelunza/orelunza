#!/usr/bin/env python3
"""Build Orelunza cube-sphere geography tiles from WGS84 vector/raster data.

The input relief raster must contain signed elevation in metres: positive on land,
negative below mean sea level. GEBCO NetCDF may be converted to GeoTIFF first,
or read by rasterio when the local GDAL build supports NetCDF subdatasets.
"""
from __future__ import annotations

import argparse
import json
import math
import struct
from pathlib import Path

import geopandas as gpd
import rasterio
from rasterio.warp import transform
from shapely.geometry import Point
from shapely.ops import unary_union
from shapely.prepared import prep

FACES = ['positive-x', 'negative-x', 'positive-y', 'negative-y', 'positive-z', 'negative-z']


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
    return math.degrees(math.asin(y)), math.degrees(math.atan2(z, x))


def write_tile(path: Path, face_index: int, level: int, x: int, y: int,
               resolution: int, elevation: list[int], mask: list[int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    header = struct.pack(
        '<4sBBBBHHhh', b'ORGT', 1, resolution, level, face_index, x, y,
        min(elevation), max(elevation)
    )
    payload = struct.pack('<' + 'h' * len(elevation), *elevation) + bytes(mask)
    path.write_bytes(header + payload)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--land', required=True, help='Natural Earth land/country vector file')
    parser.add_argument('--relief', required=True, help='GEBCO/ETOPO signed elevation raster')
    parser.add_argument('--output', required=True)
    parser.add_argument('--maximum-level', type=int, default=6)
    parser.add_argument('--resolution', type=int, default=33)
    parser.add_argument('--planet-id', default='earth')
    parser.add_argument('--source-name', default='GEBCO signed global relief')
    args = parser.parse_args()

    if args.maximum_level < 0 or args.maximum_level > 12:
        raise SystemExit('--maximum-level must be between 0 and 12')
    if args.resolution < 2 or args.resolution > 257:
        raise SystemExit('--resolution must be between 2 and 257')

    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    land_frame = gpd.read_file(args.land).to_crs('EPSG:4326')
    land_geometry = unary_union([geometry for geometry in land_frame.geometry if geometry is not None])
    if not land_geometry.is_valid:
        land_geometry = land_geometry.buffer(0)
    land = prep(land_geometry)

    minimum = 32767
    maximum = -32768
    sample_count = 0
    with rasterio.open(args.relief) as raster:
        for level in range(args.maximum_level + 1):
            side = 2 ** level
            for face_index, face in enumerate(FACES):
                for tile_y in range(side):
                    for tile_x in range(side):
                        latitudes: list[float] = []
                        longitudes: list[float] = []
                        for row in range(args.resolution):
                            face_v = (tile_y + row / (args.resolution - 1)) / side
                            for column in range(args.resolution):
                                face_u = (tile_x + column / (args.resolution - 1)) / side
                                latitude, longitude = latlon(face, face_u, face_v)
                                latitudes.append(latitude)
                                longitudes.append(longitude)
                        source_x, source_y = transform('EPSG:4326', raster.crs, longitudes, latitudes)
                        values = [int(round(value[0])) for value in raster.sample(zip(source_x, source_y))]
                        values = [max(-32768, min(32767, value)) for value in values]
                        masks = [255 if land.covers(Point(lon, lat)) else 0
                                 for lon, lat in zip(longitudes, latitudes)]
                        minimum = min(minimum, min(values))
                        maximum = max(maximum, max(values))
                        sample_count += len(values)
                        write_tile(
                            output / 'tiles' / face / str(level) / str(tile_x) / f'{tile_y}.orgt',
                            face_index, level, tile_x, tile_y, args.resolution, values, masks
                        )

    manifest = {
        'format': 'orelunza-geography-pack',
        'version': 1,
        'planetId': args.planet_id,
        'dataQuality': 'production',
        'tileResolution': args.resolution,
        'minimumLevel': 0,
        'maximumLevel': args.maximum_level,
        'tileExtension': 'orgt',
        'elevationEncoding': 'int16-meters',
        'maskEncoding': 'uint8-land-255-ocean-0',
        'minimumElevationMeters': minimum,
        'maximumElevationMeters': maximum,
        'sources': [{'name': args.source_name, 'role': 'elevation and bathymetry',
                     'license': 'See source terms and attribution', 'url': ''}],
        'coastlinePath': 'coastlines.json',
        'countriesIndexPath': 'countries-index.json',
        'tilePathTemplate': 'tiles/{face}/{level}/{x}/{y}.orgt',
        'generatedSampleCount': sample_count,
    }
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    print(f'Wrote {sample_count:,} samples to {output}')


if __name__ == '__main__':
    main()
