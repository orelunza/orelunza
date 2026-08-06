import { Vector3 } from 'three';
import { planetTileAngularRadius, planetTileCenterDirection } from './CubeSphere';
import type { PlanetDefinition } from './PlanetDefinition';
import { EARTH_PLANET } from './PlanetDefinition';
import type { PlanetTileId } from './PlanetTileId';

const cameraDirection = new Vector3();
const tileDirection = new Vector3();

export function isPlanetTileAboveHorizon(
	tile: Readonly<PlanetTileId>,
	cameraPlanetPosition: Readonly<Vector3>,
	definition: Readonly<PlanetDefinition> = EARTH_PLANET,
	marginRadians = 0.015
): boolean {
	const cameraDistance = Math.hypot(
		cameraPlanetPosition.x,
		cameraPlanetPosition.y,
		cameraPlanetPosition.z
	);
	if (!Number.isFinite(cameraDistance) || cameraDistance <= definition.polarRadiusMeters) {
		return true;
	}

	cameraDirection
		.set(cameraPlanetPosition.x, cameraPlanetPosition.y, cameraPlanetPosition.z)
		.normalize();
	planetTileCenterDirection(tile, tileDirection);
	const horizonCosine = definition.polarRadiusMeters / cameraDistance;
	const angularPadding = planetTileAngularRadius(tile) + Math.max(0, marginRadians);
	const threshold = Math.cos(Math.acos(Math.min(1, horizonCosine)) + angularPadding);
	return cameraDirection.dot(tileDirection) >= threshold;
}
