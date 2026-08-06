import { Vector3 } from 'three';
import { EARTH_PLANET, type PlanetDefinition } from './PlanetDefinition';

export interface PlanetGravitySample {
	direction: Vector3;
	up: Vector3;
	acceleration: number;
}

export class PlanetGravity {
	constructor(readonly definition: Readonly<PlanetDefinition> = EARTH_PLANET) {}

	sample(position: Readonly<Vector3>): PlanetGravitySample {
		const radius = Math.hypot(position.x, position.y, position.z);
		if (!Number.isFinite(radius) || radius <= 1e-6) {
			throw new RangeError(
				'Gravity cannot be sampled at the planet centre or a non-finite position.'
			);
		}

		const direction = new Vector3(-position.x / radius, -position.y / radius, -position.z / radius);
		const up = direction.clone().negate();
		const referenceRadius = this.definition.equatorialRadiusMeters;
		const acceleration =
			this.definition.surfaceGravityMetersPerSecondSquared * (referenceRadius / radius) ** 2;
		return { direction, up, acceleration };
	}
}
