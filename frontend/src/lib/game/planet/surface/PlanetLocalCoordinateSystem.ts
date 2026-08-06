import { Vector3 } from 'three';
import type { GeodeticCoordinate, PlanetPosition } from '../GeodeticCoordinate';
import type { PlanetCoordinateSystem } from '../PlanetCoordinateSystem';
import type { PlanetSurfaceAnchor } from './PlanetSurfaceAnchor';

/**
 * East-up-north tangent frame used by the local voxel world.
 * X points east, Y points away from the planet, Z points north.
 */
export class PlanetLocalCoordinateSystem {
	constructor(
		readonly planet: PlanetCoordinateSystem,
		readonly anchor: Readonly<PlanetSurfaceAnchor>
	) {}

	toLocal(globalPosition: Readonly<PlanetPosition>, target = new Vector3()): Vector3 {
		const dx = globalPosition.x - this.anchor.planetPosition.x;
		const dy = globalPosition.y - this.anchor.planetPosition.y;
		const dz = globalPosition.z - this.anchor.planetPosition.z;
		const { east, north, up } = this.anchor.frame;
		return target.set(
			dx * east.x + dy * east.y + dz * east.z,
			dx * up.x + dy * up.y + dz * up.z,
			dx * north.x + dy * north.y + dz * north.z
		);
	}

	toGlobal(
		localPosition: Readonly<Vector3>,
		target: PlanetPosition = { x: 0, y: 0, z: 0 }
	): PlanetPosition {
		if (![localPosition.x, localPosition.y, localPosition.z].every(Number.isFinite)) {
			throw new RangeError('Local planet position must be finite.');
		}
		const { east, north, up } = this.anchor.frame;
		target.x =
			this.anchor.planetPosition.x +
			east.x * localPosition.x +
			up.x * localPosition.y +
			north.x * localPosition.z;
		target.y =
			this.anchor.planetPosition.y +
			east.y * localPosition.x +
			up.y * localPosition.y +
			north.y * localPosition.z;
		target.z =
			this.anchor.planetPosition.z +
			east.z * localPosition.x +
			up.z * localPosition.y +
			north.z * localPosition.z;
		return target;
	}

	toLocalFromGeodetic(coordinate: Readonly<GeodeticCoordinate>, target = new Vector3()): Vector3 {
		return this.toLocal(this.planet.geodeticToPlanet(coordinate), target);
	}

	toGeodeticFromLocal(localPosition: Readonly<Vector3>): GeodeticCoordinate {
		return this.planet.planetToGeodetic(this.toGlobal(localPosition));
	}
}
