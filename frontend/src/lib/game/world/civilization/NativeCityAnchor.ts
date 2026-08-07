import {
	CENTRAL_CITY_CENTER,
	NATIVE_CITY_PREFERRED_DISTANCE,
	WORLD_SPAWN,
	type WorldCoordinate
} from '../voxel-types';

export interface NativeCityAnchor {
	x: number;
	z: number;
	distanceFromLanding: number;
}

/**
 * Canonical native-city anchor for the starter world.
 *
 * The city is deliberately close enough that the first facade sits inside the
 * initial streamed chunk radius. The anchor is deterministic and relative to
 * the landing meadow rather than a random far-away landmark.
 */
export function nativeCityAnchorFromLanding(
	landing: Pick<WorldCoordinate, 'x' | 'z'> = WORLD_SPAWN
): NativeCityAnchor {
	const landingX = Math.floor(landing.x);
	const landingZ = Math.floor(landing.z);
	const x = landingX + CENTRAL_CITY_CENTER.x;
	const z = landingZ - NATIVE_CITY_PREFERRED_DISTANCE;
	return {
		x,
		z,
		distanceFromLanding: Math.hypot(x - landing.x, z - landing.z)
	};
}

export function nativeCityIsNearLanding(
	landing: Pick<WorldCoordinate, 'x' | 'z'> = WORLD_SPAWN,
	maximumDistance = 48
): boolean {
	return nativeCityAnchorFromLanding(landing).distanceFromLanding <= maximumDistance;
}
