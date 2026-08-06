import { Ray, Sphere, Vector3 } from 'three';
import type { GeographicSample } from '../../geography/GeographicTile';
import type { PlanetSurfaceEcology } from '../../geography/ecology/PlanetSurfaceEcology';
import type { GeodeticCoordinate } from '../GeodeticCoordinate';
import type { PlanetCoordinateSystem } from '../PlanetCoordinateSystem';
import type { PlanetDefinition } from '../PlanetDefinition';

export type PlanetSurfaceDestinationStatus = 'pending' | 'land' | 'ocean' | 'error';

export interface PlanetSurfaceDestination {
	coordinate: GeodeticCoordinate;
	sample: GeographicSample | null;
	status: PlanetSurfaceDestinationStatus;
	message: string | null;
	ecology: PlanetSurfaceEcology | null;
}

export function createPendingSurfaceDestination(
	coordinate: Readonly<GeodeticCoordinate>
): PlanetSurfaceDestination {
	return {
		coordinate: { ...coordinate },
		sample: null,
		status: 'pending',
		message: null,
		ecology: null
	};
}

export function resolveSurfaceDestination(
	coordinate: Readonly<GeodeticCoordinate>,
	sample: Readonly<GeographicSample>,
	minimumLandCoverage = 0.55,
	ecology: PlanetSurfaceEcology | null = null
): PlanetSurfaceDestination {
	const land = sample.land >= minimumLandCoverage && sample.elevationMeters >= -5;
	return {
		coordinate: {
			latitudeRadians: coordinate.latitudeRadians,
			longitudeRadians: coordinate.longitudeRadians,
			altitudeMeters: sample.elevationMeters
		},
		sample: { ...sample },
		status: land ? 'land' : 'ocean',
		message: land ? null : 'Surface destination required',
		ecology
	};
}

export function rayToPlanetDestination(
	ray: Readonly<Ray>,
	definition: Readonly<PlanetDefinition>,
	coordinateSystem: PlanetCoordinateSystem,
	target = new Vector3()
): GeodeticCoordinate | null {
	const sphere = new Sphere(new Vector3(), definition.renderRadiusUnits);
	const intersection = ray.intersectSphere(sphere, target);
	if (!intersection) {
		return null;
	}
	const scale = definition.equatorialRadiusMeters / definition.renderRadiusUnits;
	return coordinateSystem.planetToGeodetic({
		x: intersection.x * scale,
		y: intersection.y * scale,
		z: intersection.z * scale
	});
}
