import type { GravityProvider } from '../physics/GravityProvider';
import { FlatGravityProvider } from '../physics/FlatGravityProvider';
import { PlanetGravityProvider } from '../physics/PlanetGravityProvider';
import type { PlanetTravelRequest } from '../planet/surface/PlanetTravelRequest';
import type { PreparedPlanetSurfaceRegion } from '../planet/surface/PlanetSurfaceSpawnResolver';
import { PlanetSurfaceSession } from '../planet/surface/PlanetSurfaceSession';
import type { VoxelWorld } from './VoxelWorld';
import { createStarterWorld } from './WorldGenerator';

export interface ActiveWorldSession {
	geometry: 'local-flat' | 'planet-earth';
	world: VoxelWorld;
	gravity: GravityProvider;
	dispose(): void;
}

export class FlatWorldSession implements ActiveWorldSession {
	readonly geometry = 'local-flat' as const;
	readonly gravity = new FlatGravityProvider();
	readonly world: VoxelWorld;
	constructor(seed: string) {
		this.world = createStarterWorld(seed);
	}
	dispose(): void {}
}

export class PlanetWorldSession implements ActiveWorldSession {
	readonly geometry = 'planet-earth' as const;
	readonly gravity = new PlanetGravityProvider();
	readonly world: VoxelWorld;
	readonly session: PlanetSurfaceSession;
	readonly request: PlanetTravelRequest;
	constructor(
		readonly region: PreparedPlanetSurfaceRegion,
		request: PlanetTravelRequest
	) {
		this.world = region.bridge.world;
		this.session = new PlanetSurfaceSession(region);
		this.request = request;
	}
	dispose(): void {
		this.session.dispose();
	}
}
