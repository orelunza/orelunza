import type { GeodeticCoordinate } from '../../planet/GeodeticCoordinate';

export type OceanCurrentRegion =
	| 'equatorial-westward'
	| 'equatorial-counter-current'
	| 'subtropical-gyre'
	| 'subpolar-gyre'
	| 'antarctic-circumpolar'
	| 'polar-drift';

export interface OceanCurrentSample {
	region: OceanCurrentRegion;
	directionRadians: number;
	directionEast: number;
	directionNorth: number;
	speedMetersPerSecond: number;
	temperatureBias: number;
}

/**
 * Deterministic large-scale current field. It is intentionally regional rather
 * than a fluid simulation: gameplay receives stable directions and strengths
 * while production oceanographic data can replace this resolver later.
 */
export class OceanCurrentResolver {
	resolve(coordinate: Readonly<GeodeticCoordinate>): OceanCurrentSample {
		const latitude = coordinate.latitudeRadians;
		const longitude = coordinate.longitudeRadians;
		if (![latitude, longitude].every(Number.isFinite)) {
			throw new RangeError('Ocean current coordinates must be finite.');
		}

		const latitudeDegrees = (latitude * 180) / Math.PI;
		const absoluteLatitude = Math.abs(latitudeDegrees);
		let region: OceanCurrentRegion;
		let east = 0;
		let north = 0;
		let speed = 0;

		if (latitudeDegrees <= -55) {
			region = 'antarctic-circumpolar';
			east = 1;
			north = Math.sin(longitude * 3) * 0.12;
			speed = 0.9;
		} else if (absoluteLatitude >= 70) {
			region = 'polar-drift';
			east = latitudeDegrees > 0 ? -0.35 : 0.35;
			north = Math.cos(longitude * 2) * 0.55;
			speed = 0.22;
		} else if (absoluteLatitude < 7) {
			region = 'equatorial-westward';
			east = -1;
			north = Math.sin(longitude * 2) * 0.08;
			speed = 0.48;
		} else if (absoluteLatitude < 13) {
			region = 'equatorial-counter-current';
			east = 1;
			north = latitudeDegrees > 0 ? 0.08 : -0.08;
			speed = 0.34;
		} else if (absoluteLatitude < 45) {
			region = 'subtropical-gyre';
			const hemisphere = latitudeDegrees >= 0 ? 1 : -1;
			const phase = longitude + hemisphere * Math.PI * 0.25;
			east = Math.cos(phase) * hemisphere;
			north = -Math.sin(phase);
			speed = 0.3 + Math.cos(latitude * 2) * 0.08;
		} else {
			region = 'subpolar-gyre';
			const hemisphere = latitudeDegrees >= 0 ? 1 : -1;
			const phase = longitude - hemisphere * Math.PI * 0.2;
			east = -Math.cos(phase) * hemisphere;
			north = Math.sin(phase);
			speed = 0.25;
		}

		const magnitude = Math.max(1e-6, Math.hypot(east, north));
		east /= magnitude;
		north /= magnitude;
		return {
			region,
			directionRadians: Math.atan2(north, east),
			directionEast: east,
			directionNorth: north,
			speedMetersPerSecond: clamp(speed, 0.05, 1.5),
			temperatureBias: clamp(Math.cos(latitude) * 2 - 1, -1, 1)
		};
	}
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.max(minimum, Math.min(maximum, value));
}
