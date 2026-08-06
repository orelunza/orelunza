import type { PlanetPosition } from '../planet/GeodeticCoordinate';
import type { PlanetGravitySample } from '../planet/PlanetGravity';

export interface GravityProvider {
	sample(globalPosition: Readonly<PlanetPosition>): PlanetGravitySample;
}
