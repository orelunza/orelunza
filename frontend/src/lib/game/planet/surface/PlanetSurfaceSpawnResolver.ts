import { Vector3 } from 'three';
import type { GeographicSample } from '../../geography/GeographicTile';
import type { PlanetSurfaceContextSource } from '../../geography/ecology/PlanetSurfaceContextResolver';
import {
	createFallbackPlanetSurfaceEcology,
	type PlanetSurfaceEcology
} from '../../geography/ecology/PlanetSurfaceEcology';
import type { GeodeticCoordinate } from '../GeodeticCoordinate';
import type { PlanetCoordinateSystem } from '../PlanetCoordinateSystem';
import { createPlanetSurfaceAnchor } from './PlanetSurfaceAnchor';
import { PlanetLocalCoordinateSystem } from './PlanetLocalCoordinateSystem';
import type { PlanetSurfaceDestination } from './PlanetSurfaceDestination';
import { resolveSurfaceDestination } from './PlanetSurfaceDestination';
import { PlanetTerrainColumnSampler } from '../../world/planet/PlanetTerrainColumnSampler';
import {
	buildPlanetSurfaceElevationGrid,
	type PlanetSurfaceElevationSource,
	type PlanetSurfaceRegionBuildOptions
} from '../../world/planet/PlanetSurfaceRegionBuilder';
import { PlanetTerrainGenerator } from '../../world/planet/PlanetTerrainGenerator';
import { PlanetVoxelBridge } from '../../world/planet/PlanetVoxelBridge';

export interface PreparedPlanetSurfaceRegion {
	destination: PlanetSurfaceDestination;
	coordinates: PlanetLocalCoordinateSystem;
	generator: PlanetTerrainGenerator;
	bridge: PlanetVoxelBridge;
	spawnPosition: Vector3;
	ecology: PlanetSurfaceEcology;
}

export class PlanetSurfaceSpawnResolver {
	constructor(
		private readonly coordinateSystem: PlanetCoordinateSystem,
		private readonly elevationSource: PlanetSurfaceElevationSource,
		private readonly contextSource?: PlanetSurfaceContextSource
	) {}

	async resolve(
		coordinate: Readonly<GeodeticCoordinate>,
		options: Readonly<PlanetSurfaceRegionBuildOptions> = {}
	): Promise<PreparedPlanetSurfaceRegion> {
		const firstSample = await this.elevationSource.sample(coordinate, options.signal);
		const ecology = this.contextSource
			? await this.contextSource.resolve(coordinate, firstSample, options.signal)
			: createFallbackPlanetSurfaceEcology();
		const destination = resolveSurfaceDestination(coordinate, firstSample, 0.55, ecology);
		if (destination.status !== 'land' || !destination.sample) {
			throw new PlanetSurfaceDestinationError(
				destination.message ?? 'Surface destination required'
			);
		}

		const anchor = createPlanetSurfaceAnchor(
			this.coordinateSystem,
			destination.coordinate,
			destination.sample.elevationMeters
		);
		const coordinates = new PlanetLocalCoordinateSystem(this.coordinateSystem, anchor);
		const grid = await buildPlanetSurfaceElevationGrid(coordinates, this.elevationSource, options);
		const columns = new PlanetTerrainColumnSampler(grid);
		const generator = new PlanetTerrainGenerator(anchor, columns, { ecology });
		const bridge = new PlanetVoxelBridge(coordinates, generator);
		bridge.ensureChunksAround({ x: 0, z: 0 }, 2);
		const spawn = bridge.world.findSafeSpawnPosition(0.32, 1.78, { x: 0, z: 0 }, 12);
		return {
			destination,
			coordinates,
			generator,
			bridge,
			spawnPosition: new Vector3(spawn.x, spawn.y, spawn.z),
			ecology
		};
	}
}

export class PlanetSurfaceDestinationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PlanetSurfaceDestinationError';
	}
}

export class ConstantPlanetSurfaceElevationSource implements PlanetSurfaceElevationSource {
	constructor(private readonly sampleValue: Readonly<GeographicSample>) {}

	async sample(_coordinate: Readonly<GeodeticCoordinate>): Promise<GeographicSample> {
		return { ...this.sampleValue };
	}
}
