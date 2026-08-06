#!/usr/bin/env sh
set -eu

ROOT="${1:-planet-data/sources}"
mkdir -p "$ROOT"

curl -fL \
  https://naturalearth.s3.amazonaws.com/110m_physical/ne_110m_land.zip \
  -o "$ROOT/ne_110m_land.zip"
unzip -o "$ROOT/ne_110m_land.zip" -d "$ROOT/ne_110m_land"

cat <<'EOF'
Natural Earth land data downloaded.

Download the current GEBCO grid from the official GEBCO download application:
  https://download.gebco.net/

Choose a signed elevation product containing land topography and ocean bathymetry,
then place the GeoTIFF/NetCDF under planet-data/sources/. GEBCO requires source
acknowledgement; do not use the grid for navigation or safety-at-sea decisions.
EOF
