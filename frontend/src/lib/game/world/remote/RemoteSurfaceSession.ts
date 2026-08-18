import { CountryResolver } from '../../geography/countries/CountryResolver';
import { PlanetEcologyQuery } from '../../geography/ecology/PlanetEcologyQuery';
import { PlanetSurfaceContextResolver } from '../../geography/ecology/PlanetSurfaceContextResolver';
import { PlanetGeographyQuery } from '../../geography/PlanetGeographyQuery';
import { PlanetCoordinateSystem } from '../../planet/PlanetCoordinateSystem';
import type { GeodeticCoordinate } from '../../planet/GeodeticCoordinate';
import {
	PlanetSurfaceSpawnResolver,
	type PreparedPlanetSurfaceRegion
} from '../../planet/surface/PlanetSurfaceSpawnResolver';
import type { PlanetTravelRequest } from '../../planet/surface/PlanetTravelRequest';
import type { PlanetSurfaceRegionBuildOptions } from '../planet/PlanetSurfaceRegionBuilder';

export interface RemoteSurfacePrepareOptions extends PlanetSurfaceRegionBuildOptions {
	chunkRadius?: number;
}

export interface RemoteSurfaceRegionResolver {
	resolve(
		coordinate: Readonly<GeodeticCoordinate>,
		options?: Readonly<PlanetSurfaceRegionBuildOptions>
	): Promise<PreparedPlanetSurfaceRegion>;
}

/**
 * Owns the data queries needed to observe one remote planetary surface.
 *
 * This session never owns a player, inventory, physics controller or the active
 * game world. It prepares a read-only local surface from the same planetary
 * geography and terrain pipeline used by real surface travel.
 */
export class RemoteSurfaceSession {
	private disposed = false;

	constructor(
		private readonly resolver: RemoteSurfaceRegionResolver,
		private readonly cleanup: () => void = () => undefined
	) {}

	static createDefault(): RemoteSurfaceSession {
		const geography = new PlanetGeographyQuery();
		const ecology = new PlanetEcologyQuery();
		const countries = new CountryResolver();
		const context = new PlanetSurfaceContextResolver(countries, ecology);
		const coordinates = new PlanetCoordinateSystem();
		const resolver = new PlanetSurfaceSpawnResolver(coordinates, geography, context);

		return new RemoteSurfaceSession(resolver, () => {
			geography.dispose();
			ecology.dispose();
			countries.dispose();
		});
	}

	async prepare(
		location: Readonly<PlanetTravelRequest>,
		options: Readonly<RemoteSurfacePrepareOptions> = {}
	): Promise<PreparedPlanetSurfaceRegion> {
		this.assertUsable();
		const { chunkRadius = 2, ...regionOptions } = options;
		const radius = normalizeChunkRadius(chunkRadius);
		const region = await this.resolver.resolve(location.coordinate, regionOptions);
		this.assertUsable();
		region.bridge.ensureChunksAround({ x: 0, z: 0 }, radius);
		return region;
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.cleanup();
	}

	private assertUsable(): void {
		if (this.disposed) {
			throw new Error('Remote surface session has been disposed.');
		}
	}
}

function normalizeChunkRadius(value: number): number {
	if (!Number.isInteger(value) || value < 1 || value > 4) {
		throw new RangeError('Remote surface chunk radius must be an integer between 1 and 4.');
	}
	return value;
}
