export interface GeographicPointDegrees {
	latitude: number;
	longitude: number;
}

export interface LocalDestinationVector {
	eastMeters: number;
	northMeters: number;
	distanceMeters: number;
	bearingDegrees: number;
}

const EARTH_RADIUS_METERS = 6_371_008.8;

/**
 * Computes a local east/north displacement for map rendering while keeping the
 * bearing calculation spherical. The planar displacement is intentionally used
 * only for the local map, where distances are small compared with Earth.
 */
export function localDestinationVector(
	origin: Readonly<GeographicPointDegrees>,
	destination: Readonly<GeographicPointDegrees>
): LocalDestinationVector {
	const latitude1 = radians(origin.latitude);
	const latitude2 = radians(destination.latitude);
	const deltaLatitude = latitude2 - latitude1;
	const deltaLongitude = radians(normalizeLongitude(destination.longitude - origin.longitude));
	const meanLatitude = (latitude1 + latitude2) / 2;
	const northMeters = deltaLatitude * EARTH_RADIUS_METERS;
	const eastMeters = deltaLongitude * Math.cos(meanLatitude) * EARTH_RADIUS_METERS;
	return {
		eastMeters,
		northMeters,
		distanceMeters: Math.hypot(eastMeters, northMeters),
		bearingDegrees: initialBearingDegrees(origin, destination)
	};
}

export function initialBearingDegrees(
	origin: Readonly<GeographicPointDegrees>,
	destination: Readonly<GeographicPointDegrees>
): number {
	const latitude1 = radians(origin.latitude);
	const latitude2 = radians(destination.latitude);
	const deltaLongitude = radians(normalizeLongitude(destination.longitude - origin.longitude));
	const y = Math.sin(deltaLongitude) * Math.cos(latitude2);
	const x =
		Math.cos(latitude1) * Math.sin(latitude2) -
		Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(deltaLongitude);
	return normalizeBearing((Math.atan2(y, x) * 180) / Math.PI);
}

export function compassDirection(bearingDegrees: number): string {
	const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
	const index = Math.round(normalizeBearing(bearingDegrees) / 45) % labels.length;
	return labels[index];
}

function radians(value: number): number {
	return (value * Math.PI) / 180;
}

function normalizeBearing(value: number): number {
	return ((value % 360) + 360) % 360;
}

function normalizeLongitude(value: number): number {
	return ((value + 540) % 360) - 180;
}
