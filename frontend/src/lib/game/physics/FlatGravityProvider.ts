import { Vector3 } from 'three';
import type { PlanetPosition } from '../planet/GeodeticCoordinate';
import type { PlanetGravitySample } from '../planet/PlanetGravity';
import type { GravityProvider } from './GravityProvider';

export class FlatGravityProvider implements GravityProvider {
	constructor(readonly acceleration = 20) {
		if (!Number.isFinite(acceleration) || acceleration <= 0) {
			throw new RangeError('Flat gravity acceleration must be finite and positive.');
		}
	}

	sample(_globalPosition: Readonly<PlanetPosition>): PlanetGravitySample {
		return {
			direction: new Vector3(0, -1, 0),
			up: new Vector3(0, 1, 0),
			acceleration: this.acceleration
		};
	}
}
