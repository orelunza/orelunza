import type { GeographicTileId } from '../GeographicTileId';
import type { LandCoverClass } from './LandCoverClass';

export interface EcologicalTile {
	id: GeographicTileId;
	resolution: number;
	landCoverCodes: Uint8Array;
	treeCoverDensity: Uint8Array;
	confidence: Uint8Array;
	byteLength: number;
}

export interface EcologicalSample {
	landCover: LandCoverClass;
	treeCoverDensity: number;
	confidence: number;
}

export function validateEcologicalTile(tile: Readonly<EcologicalTile>): void {
	const expected = tile.resolution * tile.resolution;
	if (
		!Number.isInteger(tile.resolution) ||
		tile.resolution < 2 ||
		tile.landCoverCodes.length !== expected ||
		tile.treeCoverDensity.length !== expected ||
		tile.confidence.length !== expected
	) {
		throw new TypeError('Invalid ecological tile payload.');
	}
}
