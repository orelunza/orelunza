export interface PlanetDefinition {
	id: string;
	name: string;
	equatorialRadiusMeters: number;
	polarRadiusMeters: number;
	surfaceGravityMetersPerSecondSquared: number;
	renderRadiusUnits: number;
	maximumLodLevel: number;
}

export const EARTH_EQUATORIAL_RADIUS_METERS = 6_378_137;
export const EARTH_POLAR_RADIUS_METERS = 6_356_752.314245;
export const EARTH_MEAN_RADIUS_METERS = 6_371_008.8;

export const EARTH_PLANET: Readonly<PlanetDefinition> = Object.freeze({
	id: 'earth',
	name: 'Earth',
	equatorialRadiusMeters: EARTH_EQUATORIAL_RADIUS_METERS,
	polarRadiusMeters: EARTH_POLAR_RADIUS_METERS,
	surfaceGravityMetersPerSecondSquared: 9.80665,
	renderRadiusUnits: 100,
	maximumLodLevel: 14
});

export function validatePlanetDefinition(definition: Readonly<PlanetDefinition>): void {
	const values = [
		definition.equatorialRadiusMeters,
		definition.polarRadiusMeters,
		definition.surfaceGravityMetersPerSecondSquared,
		definition.renderRadiusUnits
	];

	if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
		throw new RangeError(
			'Planet dimensions, gravity and render radius must be finite and positive.'
		);
	}

	if (
		!Number.isInteger(definition.maximumLodLevel) ||
		definition.maximumLodLevel < 0 ||
		definition.maximumLodLevel > 24
	) {
		throw new RangeError('Planet maximum LOD level must be an integer between 0 and 24.');
	}
}
