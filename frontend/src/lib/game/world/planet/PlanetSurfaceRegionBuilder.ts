import { Vector3 } from 'three';
import type { GeographicSample } from '../../geography/GeographicTile';
import type { GeodeticCoordinate } from '../../planet/GeodeticCoordinate';
import type { PlanetLocalCoordinateSystem } from '../../planet/surface/PlanetLocalCoordinateSystem';
import type { PlanetSurfaceElevationGrid } from './PlanetTerrainColumnSampler';

export interface PlanetSurfaceElevationSource {
	sample(coordinate: Readonly<GeodeticCoordinate>, signal?: AbortSignal): Promise<GeographicSample>;
}

export interface PlanetSurfaceRegionBuildOptions {
	halfExtentMeters?: number;
	resolution?: number;
	signal?: AbortSignal;
}

export async function buildPlanetSurfaceElevationGrid(
	coordinates: PlanetLocalCoordinateSystem,
	source: PlanetSurfaceElevationSource,
	options: Readonly<PlanetSurfaceRegionBuildOptions> = {}
): Promise<PlanetSurfaceElevationGrid> {
	const halfExtentMeters = normalizeExtent(options.halfExtentMeters ?? 384);
	const resolution = normalizeResolution(options.resolution ?? 25);
	const elevationMeters = new Float32Array(resolution * resolution);
	const landMask = new Uint8Array(resolution * resolution);
	let minimumElevationMeters = Number.POSITIVE_INFINITY;
	let maximumElevationMeters = Number.NEGATIVE_INFINITY;
	const local = new Vector3();
	const tasks: Promise<void>[] = [];

	for (let row = 0; row < resolution; row += 1) {
		for (let column = 0; column < resolution; column += 1) {
			const index = row * resolution + column;
			local.set(
				-halfExtentMeters + (column / (resolution - 1)) * halfExtentMeters * 2,
				0,
				-halfExtentMeters + (row / (resolution - 1)) * halfExtentMeters * 2
			);
			const coordinate = coordinates.toGeodeticFromLocal(local);
			tasks.push(
				source.sample(coordinate, options.signal).then((sample) => {
					const elevation = Number.isFinite(sample.elevationMeters) ? sample.elevationMeters : 0;
					elevationMeters[index] = elevation;
					landMask[index] = sample.land >= 0.5 ? 255 : 0;
					minimumElevationMeters = Math.min(minimumElevationMeters, elevation);
					maximumElevationMeters = Math.max(maximumElevationMeters, elevation);
				})
			);
		}
	}
	await Promise.all(tasks);

	return {
		resolution,
		halfExtentMeters,
		referenceElevationMeters: coordinates.anchor.referenceElevationMeters,
		elevationMeters,
		landMask,
		minimumElevationMeters,
		maximumElevationMeters
	};
}

function normalizeExtent(value: number): number {
	if (!Number.isFinite(value) || value < 32 || value > 4096) {
		throw new RangeError('Surface grid half extent must be between 32 and 4096 metres.');
	}
	return value;
}

function normalizeResolution(value: number): number {
	if (!Number.isInteger(value) || value < 3 || value > 129 || value % 2 === 0) {
		throw new RangeError('Surface grid resolution must be an odd integer between 3 and 129.');
	}
	return value;
}
