# Orelunza planet-data pipeline

The browser never loads the raw global source. This tool converts WGS84 land polygons and a signed elevation raster into deterministic cube-sphere `ORGT` tiles.

## Sources

- Natural Earth: land mask and coastlines. Natural Earth vector/raster data are public domain.
- GEBCO_2026: production elevation and bathymetry. Acknowledge the GEBCO source in products and publications. GEBCO is not suitable for navigation.
- The repository's `preview` pack uses real Natural Earth continent/coastline shapes and a coarse ETOPO-derived visual relief proxy. Its elevation numbers are for rendering tests, not science.

## Build

```bash
python3 -m venv .venv-planet
. .venv-planet/bin/activate
pip install geopandas rasterio shapely

./tools/planet-data/download-sources.sh

python tools/planet-data/build-geography-pack.py \
  --land planet-data/sources/ne_110m_land/ne_110m_land.shp \
  --relief planet-data/sources/GEBCO_2026.tif \
  --output frontend/static/planet-data/full \
  --maximum-level 6 \
  --resolution 33 \
  --source-name GEBCO_2026

python tools/planet-data/verify-planet-pack.py \
  frontend/static/planet-data/full
```

Serve only generated packs. Raw GeoTIFF/NetCDF data, working directories and full local packs are ignored by Git.

## Binary format

Little-endian header (`16` bytes):

```text
4s magic = ORGT
u8 version
u8 resolution
u8 level
u8 faceIndex
u16 x
u16 y
i16 minimumElevationMeters
i16 maximumElevationMeters
```

Payload:

```text
resolution² signed int16 elevation samples in metres
resolution² uint8 land-mask samples (255 land, 0 ocean)
```
