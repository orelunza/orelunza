import type { GeographicTile } from './GeographicTile';
import { sampleGeographicTile } from './GeographicTileSampler';

export class BathymetrySampler {
	sampleDepthMeters(tile: Readonly<GeographicTile>, u: number, v: number): number {
		return Math.max(0, -sampleGeographicTile(tile, u, v).bathymetryMeters);
	}
}
