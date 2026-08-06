import { Vector3 } from 'three';
import type { PlanetPosition } from '../planet/GeodeticCoordinate';
import { PlanetGravity, type PlanetGravitySample } from '../planet/PlanetGravity';
import type { GravityProvider } from './GravityProvider';

export class PlanetGravityProvider implements GravityProvider {
	constructor(private readonly gravity = new PlanetGravity()) {}

	sample(globalPosition: Readonly<PlanetPosition>): PlanetGravitySample {
		return this.gravity.sample(new Vector3(globalPosition.x, globalPosition.y, globalPosition.z));
	}
}
