export interface GeodeticCoordinate {
	latitudeRadians: number;
	longitudeRadians: number;
	altitudeMeters: number;
}

export interface PlanetPosition {
	x: number;
	y: number;
	z: number;
}

export const HALF_PI = Math.PI / 2;
export const TWO_PI = Math.PI * 2;

export function normalizeLongitude(longitudeRadians: number): number {
	if (!Number.isFinite(longitudeRadians)) {
		throw new RangeError('Longitude must be finite.');
	}

	const normalized = ((((longitudeRadians + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI) - Math.PI;
	return Object.is(normalized, -0) ? 0 : normalized;
}

export function clampLatitude(latitudeRadians: number): number {
	if (!Number.isFinite(latitudeRadians)) {
		throw new RangeError('Latitude must be finite.');
	}

	return Math.max(-HALF_PI, Math.min(HALF_PI, latitudeRadians));
}

export function sanitizeGeodeticCoordinate(
	coordinate: Readonly<GeodeticCoordinate>
): GeodeticCoordinate {
	if (!Number.isFinite(coordinate.altitudeMeters)) {
		throw new RangeError('Altitude must be finite.');
	}

	return {
		latitudeRadians: clampLatitude(coordinate.latitudeRadians),
		longitudeRadians: normalizeLongitude(coordinate.longitudeRadians),
		altitudeMeters: coordinate.altitudeMeters
	};
}

export function isFinitePlanetPosition(position: Readonly<PlanetPosition>): boolean {
	return Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z);
}
