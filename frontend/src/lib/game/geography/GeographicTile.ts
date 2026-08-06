import type { GeographicTileId } from './GeographicTileId';

export interface GeographicTile {
	id: GeographicTileId;
	resolution: number;
	minimumElevationMeters: number;
	maximumElevationMeters: number;
	elevationMeters: Int16Array;
	landMask: Uint8Array;
	byteLength: number;
}

export interface GeographicSample {
	elevationMeters: number;
	land: number;
	bathymetryMeters: number;
	coastProximity: number;
}

export function validateGeographicTile(tile: Readonly<GeographicTile>): void {
	const expected = tile.resolution * tile.resolution;
	if (
		!Number.isInteger(tile.resolution) ||
		tile.resolution < 2 ||
		tile.elevationMeters.length !== expected ||
		tile.landMask.length !== expected ||
		!Number.isFinite(tile.minimumElevationMeters) ||
		!Number.isFinite(tile.maximumElevationMeters)
	) {
		throw new TypeError('Invalid geographic tile payload.');
	}
}
