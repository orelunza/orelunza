import type { GeographicTile } from './GeographicTile';
import { sampleGeographicTile } from './GeographicTileSampler';

export class ElevationSampler {
	sampleMeters(tile: Readonly<GeographicTile>, u: number, v: number): number {
		return sampleGeographicTile(tile, u, v).elevationMeters;
	}
}
