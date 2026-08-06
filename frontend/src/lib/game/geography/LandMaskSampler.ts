import type { GeographicTile } from './GeographicTile';
import { sampleGeographicTile } from './GeographicTileSampler';

export class LandMaskSampler {
	sample(tile: Readonly<GeographicTile>, u: number, v: number): number {
		return sampleGeographicTile(tile, u, v).land;
	}

	isLand(tile: Readonly<GeographicTile>, u: number, v: number): boolean {
		return this.sample(tile, u, v) >= 0.5;
	}
}
