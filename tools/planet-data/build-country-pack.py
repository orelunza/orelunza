#!/usr/bin/env python3
"""Convert Natural Earth Admin-0 polygons to the compact Orelunza country JSON."""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path
import geopandas as gpd
from shapely.geometry import mapping


def rounded(value):
    if isinstance(value, (list, tuple)):
        if value and isinstance(value[0], (int, float)):
            return [round(float(value[0]), 5), round(float(value[1]), 5)]
        return [rounded(item) for item in value]
    return value


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--countries', required=True, help='Natural Earth Admin-0 vector file')
    parser.add_argument('--output', required=True, help='Output countries JSON')
    args = parser.parse_args()

    frame = gpd.read_file(args.countries).to_crs('EPSG:4326')
    records = []
    for _, row in frame.iterrows():
        geometry = row.geometry
        if geometry is None or geometry.is_empty:
            continue
        if not geometry.is_valid:
            geometry = geometry.buffer(0)
        encoded = mapping(geometry)
        if encoded['type'] == 'Polygon':
            polygons = [rounded(encoded['coordinates'])]
        elif encoded['type'] == 'MultiPolygon':
            polygons = rounded(encoded['coordinates'])
        else:
            continue
        name = str(row.get('ADMIN') or row.get('name') or row.get('NAME') or 'Unknown')
        iso = str(row.get('ADM0_A3') or row.get('iso_a3') or row.get('ISO_A3') or '').strip()
        if iso == '-99' or len(iso) != 3:
            iso = re.sub(r'[^A-Z0-9]+', '-', name.upper()).strip('-')[:24]
        continent = str(row.get('CONTINENT') or row.get('continent') or 'Unknown')
        minimum_x, minimum_y, maximum_x, maximum_y = geometry.bounds
        label = geometry.representative_point()
        records.append({
            'id': iso,
            'isoA3': iso if len(iso) == 3 else None,
            'name': name,
            'continent': continent,
            'bounds': [round(minimum_x, 5), round(minimum_y, 5), round(maximum_x, 5), round(maximum_y, 5)],
            'label': [round(label.x, 5), round(label.y, 5)],
            'polygons': polygons,
        })

    payload = {
        'version': 1,
        'source': {
            'name': 'Natural Earth Admin-0 countries',
            'version': 'source-defined',
            'license': 'public domain',
            'url': 'https://www.naturalearthdata.com/',
        },
        'countries': records,
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, separators=(',', ':')))
    print(f'Wrote {len(records)} countries to {output}')


if __name__ == '__main__':
    main()
