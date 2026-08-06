import type { GeographicSample, GeographicTile } from '../geography/GeographicTile';
import { sampleGeographicTile } from '../geography/GeographicTileSampler';
import { canonicalFaceUvToDataFaceUv } from '../geography/PlanetDataProjection';
import type { PlanetDataCoordinateConvention } from '../geography/PlanetDataManifest';
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
		faceV: number,
		convention: PlanetDataCoordinateConvention = 'legacy-positive-z-east'
	): GeographicSample {
		const dataFaceUv = canonicalFaceUvToDataFaceUv(renderTile.face, faceU, faceV, convention);
		if (!dataTile || dataTile.id.face !== dataFaceUv.face) {
			return { ...EMPTY_SAMPLE };
		}
		const bounds = planetTileUvBounds(dataTile.id);
		const width = Math.max(Number.EPSILON, bounds.maxU - bounds.minU);
		const height = Math.max(Number.EPSILON, bounds.maxV - bounds.minV);
		return sampleGeographicTile(
			dataTile,
			(dataFaceUv.u - bounds.minU) / width,
			(dataFaceUv.v - bounds.minV) / height
		);
	}
}
