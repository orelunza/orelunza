import { Vector3 } from 'three';
import type { GeographicLocationSnapshot } from '../../game-types';
import type { PlanetTravelRequest } from '../../planet/surface/PlanetTravelRequest';
import { PlanetCoordinateSystem } from '../../planet/PlanetCoordinateSystem';
import { PlanetLocalCoordinateSystem } from '../../planet/surface/PlanetLocalCoordinateSystem';
import {
	createPlanetSurfaceAnchor,
	restorePlanetSurfaceAnchor,
	serializePlanetSurfaceAnchor,
	type PlanetSurfaceAnchor,
	type PlanetSurfaceAnchorSaveState
} from '../../planet/surface/PlanetSurfaceAnchor';
import type { WorldCoordinate } from '../voxel-types';
import type { WorldLocation } from './WorldLocation';

export interface LocalWorldPlanetAnchorSaveState {
	version: 1;
	surface: PlanetSurfaceAnchorSaveState;
	localOrigin: WorldCoordinate;
	countryId: string | null;
	countryName: string | null;
	settlementId: string | null;
	settlementName: string | null;
	biomeName: string | null;
}

export interface LocalWorldPlanetAnchor {
	surface: PlanetSurfaceAnchor;
	coordinates: PlanetLocalCoordinateSystem;
	localOrigin: Vector3;
	countryId: string | null;
	countryName: string | null;
	settlementId: string | null;
	settlementName: string | null;
	biomeName: string | null;
}

export function createLocalWorldPlanetAnchor(
	planet: PlanetCoordinateSystem,
	request: Readonly<PlanetTravelRequest>,
	localOrigin: Readonly<WorldCoordinate>
): LocalWorldPlanetAnchor {
	const surface = createPlanetSurfaceAnchor(
		planet,
		{
			latitudeRadians: request.coordinate.latitudeRadians,
			longitudeRadians: request.coordinate.longitudeRadians,
			altitudeMeters: request.elevationMeters
		},
		request.elevationMeters
	);
	return {
		surface,
		coordinates: new PlanetLocalCoordinateSystem(planet, surface),
		localOrigin: new Vector3(localOrigin.x, localOrigin.y, localOrigin.z),
		countryId: request.countryId ?? null,
		countryName: request.countryName ?? null,
		settlementId: request.settlementId ?? null,
		settlementName: request.settlementName ?? null,
		biomeName: request.biomeName ?? null
	};
}

export function createLocalWorldPlanetAnchorFromLocation(
	planet: PlanetCoordinateSystem,
	location: Readonly<WorldLocation>,
	localOrigin: Readonly<WorldCoordinate>
): LocalWorldPlanetAnchor {
	return createLocalWorldPlanetAnchor(
		planet,
		{
			coordinate: {
				latitudeRadians: (location.latitude * Math.PI) / 180,
				longitudeRadians: (location.longitude * Math.PI) / 180,
				altitudeMeters: location.elevationMeters
			},
			elevationMeters: location.elevationMeters,
			countryId: location.countryId,
			countryName: location.countryName,
			settlementId: location.settlementId,
			settlementName: location.settlementName,
			biomeName: location.biomeName
		},
		localOrigin
	);
}

export function geographicLocationFromLocalAnchor(
	anchor: Readonly<LocalWorldPlanetAnchor>,
	localPosition: Readonly<WorldCoordinate>
): GeographicLocationSnapshot {
	const offset = new Vector3(
		localPosition.x - anchor.localOrigin.x,
		localPosition.y - anchor.localOrigin.y,
		localPosition.z - anchor.localOrigin.z
	);
	const coordinate = anchor.coordinates.toGeodeticFromLocal(offset);
	return {
		latitude: (coordinate.latitudeRadians * 180) / Math.PI,
		longitude: (coordinate.longitudeRadians * 180) / Math.PI,
		elevationMeters: coordinate.altitudeMeters,
		countryName: anchor.countryName,
		biomeName: anchor.biomeName,
		settlementId: anchor.settlementId ?? anchor.surface.id,
		settlementName: anchor.settlementName
	};
}

export function serializeLocalWorldPlanetAnchor(
	anchor: Readonly<LocalWorldPlanetAnchor>
): LocalWorldPlanetAnchorSaveState {
	return {
		version: 1,
		surface: serializePlanetSurfaceAnchor(anchor.surface),
		localOrigin: {
			x: anchor.localOrigin.x,
			y: anchor.localOrigin.y,
			z: anchor.localOrigin.z
		},
		countryId: anchor.countryId,
		countryName: anchor.countryName,
		settlementId: anchor.settlementId,
		settlementName: anchor.settlementName,
		biomeName: anchor.biomeName
	};
}

export function restoreLocalWorldPlanetAnchor(
	planet: PlanetCoordinateSystem,
	state: Readonly<LocalWorldPlanetAnchorSaveState>
): LocalWorldPlanetAnchor {
	if (
		state.version !== 1 ||
		!state.surface ||
		![state.localOrigin.x, state.localOrigin.y, state.localOrigin.z].every(Number.isFinite)
	) {
		throw new TypeError('Unsupported local world planet anchor state.');
	}
	const surface = restorePlanetSurfaceAnchor(planet, state.surface);
	return {
		surface,
		coordinates: new PlanetLocalCoordinateSystem(planet, surface),
		localOrigin: new Vector3(state.localOrigin.x, state.localOrigin.y, state.localOrigin.z),
		countryId: state.countryId ?? null,
		countryName: state.countryName ?? null,
		settlementId: state.settlementId ?? null,
		settlementName: state.settlementName ?? null,
		biomeName: state.biomeName ?? null
	};
}
