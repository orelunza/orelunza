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

## Countries and ecology

Country polygons are converted from Natural Earth Admin-0 data:

```bash
python tools/planet-data/build-country-pack.py \
  --countries planet-data/sources/ne_110m_admin_0_countries/ne_110m_admin_0_countries.shp \
  --output frontend/static/planet-data/full/countries-110m.json
```

Production ecology tiles should be built from ESA WorldCover 2021 or a compatible Copernicus LCFM categorical raster. The optional tree-cover and confidence inputs must use the same global coordinate system or provide valid GDAL metadata.

```bash
python tools/planet-data/build-ecology-pack.py \
  --land-cover planet-data/sources/ESA_WorldCover_10m_2021_v200.tif \
  --tree-cover planet-data/sources/tree-cover-density.tif \
  --output frontend/static/planet-data/full \
  --maximum-level 6 \
  --resolution 33
```

The bundled `preview` ecology tiles are a deterministic development proxy. They are suitable for integration and gameplay testing, but they must not be presented as measured WorldCover values.

### Ecology binary format

Little-endian header (`24` bytes):

```text
4s magic = OREC
u8 version
u8 faceIndex
u8 level
u8 reserved
u16 x
u16 y
u16 resolution
u16 reserved
u32 sampleCount
```

Payload:

```text
resolution² uint8 internal land-cover codes
resolution² uint8 tree-cover density (0-100)
resolution² uint8 confidence (0-255)
```
