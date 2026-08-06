import { Vector3 } from 'three';
import type { GeodeticCoordinate, PlanetPosition } from './GeodeticCoordinate';
import { isFinitePlanetPosition, sanitizeGeodeticCoordinate } from './GeodeticCoordinate';
import { createLocalPlanetFrame, type LocalPlanetFrame } from './LocalPlanetFrame';
import { EARTH_PLANET, validatePlanetDefinition, type PlanetDefinition } from './PlanetDefinition';

export class PlanetCoordinateSystem {
	readonly firstEccentricitySquared: number;
	readonly secondEccentricitySquared: number;

	constructor(readonly definition: Readonly<PlanetDefinition> = EARTH_PLANET) {
		validatePlanetDefinition(definition);
		const a2 = definition.equatorialRadiusMeters ** 2;
		const b2 = definition.polarRadiusMeters ** 2;
		this.firstEccentricitySquared = 1 - b2 / a2;
		this.secondEccentricitySquared = a2 / b2 - 1;
	}

	geodeticToPlanet(
		coordinate: Readonly<GeodeticCoordinate>,
		target: PlanetPosition = { x: 0, y: 0, z: 0 }
	): PlanetPosition {
		const value = sanitizeGeodeticCoordinate(coordinate);
		const latitude = value.latitudeRadians;
		const longitude = value.longitudeRadians;
		const sinLatitude = Math.sin(latitude);
		const cosLatitude = Math.cos(latitude);
		const sinLongitude = Math.sin(longitude);
		const cosLongitude = Math.cos(longitude);
		const radius =
			this.definition.equatorialRadiusMeters /
			Math.sqrt(1 - this.firstEccentricitySquared * sinLatitude * sinLatitude);

		target.x = (radius + value.altitudeMeters) * cosLatitude * cosLongitude;
		target.y = (radius * (1 - this.firstEccentricitySquared) + value.altitudeMeters) * sinLatitude;
		target.z = (radius + value.altitudeMeters) * cosLatitude * sinLongitude;
		return target;
	}

	planetToGeodetic(position: Readonly<PlanetPosition>): GeodeticCoordinate {
		if (!isFinitePlanetPosition(position)) {
			throw new RangeError('Planet position must be finite.');
		}

		const a = this.definition.equatorialRadiusMeters;
		const b = this.definition.polarRadiusMeters;
		const horizontal = Math.hypot(position.x, position.z);

		if (horizontal < 1e-9 && Math.abs(position.y) < 1e-9) {
			throw new RangeError('The planet centre has no geodetic coordinate.');
		}

		const longitude = horizontal < 1e-9 ? 0 : Math.atan2(position.z, position.x);
		const theta = Math.atan2(position.y * a, horizontal * b);
		const sinTheta = Math.sin(theta);
		const cosTheta = Math.cos(theta);
		const latitude = Math.atan2(
			position.y + this.secondEccentricitySquared * b * sinTheta ** 3,
			horizontal - this.firstEccentricitySquared * a * cosTheta ** 3
		);
		const sinLatitude = Math.sin(latitude);
		const cosLatitude = Math.cos(latitude);
		const primeVerticalRadius = a / Math.sqrt(1 - this.firstEccentricitySquared * sinLatitude ** 2);
		const altitude =
			Math.abs(cosLatitude) > 1e-8
				? horizontal / cosLatitude - primeVerticalRadius
				: Math.abs(position.y) - b;

		return {
			latitudeRadians: latitude,
			longitudeRadians: longitude,
			altitudeMeters: altitude
		};
	}

	localFrameAt(
		coordinateOrPosition: Readonly<GeodeticCoordinate> | Readonly<PlanetPosition>
	): LocalPlanetFrame {
		const coordinate =
			'altitudeMeters' in coordinateOrPosition
				? coordinateOrPosition
				: this.planetToGeodetic(coordinateOrPosition);
		return createLocalPlanetFrame(coordinate);
	}

	surfaceRadiusAlong(direction: Readonly<PlanetPosition>): number {
		if (!isFinitePlanetPosition(direction)) {
			throw new RangeError('Direction must be finite.');
		}

		const length = Math.hypot(direction.x, direction.y, direction.z);
		if (length <= 1e-12) {
			throw new RangeError('Direction must not be zero.');
		}

		const x = direction.x / length;
		const y = direction.y / length;
		const z = direction.z / length;
		const a = this.definition.equatorialRadiusMeters;
		const b = this.definition.polarRadiusMeters;
		return 1 / Math.sqrt((x * x + z * z) / (a * a) + (y * y) / (b * b));
	}

	planetToRender(
		position: Readonly<PlanetPosition>,
		origin: Readonly<PlanetPosition>,
		target = new Vector3(),
		metersPerRenderUnit = 1
	): Vector3 {
		if (!Number.isFinite(metersPerRenderUnit) || metersPerRenderUnit <= 0) {
			throw new RangeError('metersPerRenderUnit must be finite and positive.');
		}

		return target.set(
			(position.x - origin.x) / metersPerRenderUnit,
			(position.y - origin.y) / metersPerRenderUnit,
			(position.z - origin.z) / metersPerRenderUnit
		);
	}
}
