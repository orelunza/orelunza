import type { GeographicSample, GeographicTile } from '../geography/GeographicTile';
import { sampleGeographicTile } from '../geography/GeographicTileSampler';
import { planetTileUvBounds, type PlanetTileId } from './PlanetTileId';

const EMPTY_SAMPLE: Readonly<GeographicSample> = Object.freeze({
	elevationMeters: -3200,
	land: 0,
	bathymetryMeters: -3200,
	coastProximity: 0
});

export class PlanetTerrainSampler {
	sample(
		renderTile: Readonly<PlanetTileId>,
		dataTile: Readonly<GeographicTile> | null,
		faceU: number,
		faceV: number
	): GeographicSample {
		if (!dataTile || dataTile.id.face !== renderTile.face) {
			return { ...EMPTY_SAMPLE };
		}
		const bounds = planetTileUvBounds(dataTile.id);
		const width = Math.max(Number.EPSILON, bounds.maxU - bounds.minU);
		const height = Math.max(Number.EPSILON, bounds.maxV - bounds.minV);
		return sampleGeographicTile(
			dataTile,
			(faceU - bounds.minU) / width,
			(faceV - bounds.minV) / height
		);
	}
}
