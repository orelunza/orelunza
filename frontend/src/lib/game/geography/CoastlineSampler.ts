import type { GeographicTile } from './GeographicTile';
import { sampleGeographicTile } from './GeographicTileSampler';

export class CoastlineSampler {
	sampleProximity(tile: Readonly<GeographicTile>, u: number, v: number): number {
		return sampleGeographicTile(tile, u, v).coastProximity;
	}
}
