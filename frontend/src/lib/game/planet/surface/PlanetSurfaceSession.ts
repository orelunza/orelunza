import { Vector3 } from 'three';
import { FloatingOrigin, type FloatingOriginRebase } from '../FloatingOrigin';
import type { GeodeticCoordinate, PlanetPosition } from '../GeodeticCoordinate';
import { serializePlanetSurfaceAnchor } from './PlanetSurfaceAnchor';
import type { PreparedPlanetSurfaceRegion } from './PlanetSurfaceSpawnResolver';
import type { PlanetSurfaceSaveState } from './PlanetSurfaceState';

export interface PlanetSurfacePositionSnapshot {
	local: Vector3;
	global: PlanetPosition;
	geodetic: GeodeticCoordinate;
	originRebase: FloatingOriginRebase;
}

export class PlanetSurfaceSession {
	readonly floatingOrigin: FloatingOrigin;
	private playerLocalPosition: Vector3;
	private disposed = false;

	constructor(
		readonly region: PreparedPlanetSurfaceRegion,
		rebaseThresholdMeters = 3000
	) {
		this.playerLocalPosition = region.spawnPosition.clone();
		this.floatingOrigin = new FloatingOrigin(
			region.coordinates.anchor.planetPosition,
			rebaseThresholdMeters
		);
	}

	get playerPosition(): Vector3 {
		return this.playerLocalPosition.clone();
	}

	updatePlayerLocalPosition(position: Readonly<Vector3>): PlanetSurfacePositionSnapshot {
		this.assertUsable();
		if (![position.x, position.y, position.z].every(Number.isFinite)) {
			throw new RangeError('Planet surface player position must be finite.');
		}
		this.playerLocalPosition.copy(position);
		const localForPlanet = new Vector3(
			position.x,
			position.y - this.region.generator.baseSurfaceY,
			position.z
		);
		const global = this.region.coordinates.toGlobal(localForPlanet);
		const originRebase = this.floatingOrigin.rebaseIfNeeded(global);
		const geodetic = this.region.coordinates.planet.planetToGeodetic(global);
		return { local: this.playerLocalPosition.clone(), global, geodetic, originRebase };
	}

	serialize(): PlanetSurfaceSaveState {
		this.assertUsable();
		const snapshot = this.updatePlayerLocalPosition(this.playerLocalPosition);
		return {
			version: 1,
			anchor: serializePlanetSurfaceAnchor(this.region.coordinates.anchor),
			playerLocalPosition: {
				x: this.playerLocalPosition.x,
				y: this.playerLocalPosition.y,
				z: this.playerLocalPosition.z
			},
			playerGeodeticPosition: snapshot.geodetic,
			floatingOrigin: this.floatingOrigin.state,
			terrainEdits: this.region.bridge.edits.serialize(),
			ecology: this.region.ecology
		};
	}

	restore(state: Readonly<PlanetSurfaceSaveState>): void {
		this.assertUsable();
		if (state.version !== 1 || state.anchor.id !== this.region.coordinates.anchor.id) {
			throw new TypeError('Planet surface save does not belong to this region.');
		}
		this.playerLocalPosition.set(
			state.playerLocalPosition.x,
			state.playerLocalPosition.y,
			state.playerLocalPosition.z
		);
		this.floatingOrigin.restore(state.floatingOrigin);
		this.region.bridge.edits.restore(state.terrainEdits);
		this.region.bridge.edits.apply(this.region.bridge.world);
	}

	dispose(): void {
		this.disposed = true;
	}

	private assertUsable(): void {
		if (this.disposed) {
			throw new Error('PlanetSurfaceSession has been disposed.');
		}
	}
}
