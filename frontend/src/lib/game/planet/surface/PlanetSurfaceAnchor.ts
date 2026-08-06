import { Vector3 } from 'three';
import { directionToCubeFaceUv } from '../CubeSphere';
import { canonicalTileToDataTile } from '../../geography/PlanetDataProjection';
import type { GeodeticCoordinate, PlanetPosition } from '../GeodeticCoordinate';
import type { LocalPlanetFrame } from '../LocalPlanetFrame';
import type { PlanetCoordinateSystem } from '../PlanetCoordinateSystem';
import { planetTileKey, type PlanetTileId } from '../PlanetTileId';

export const PLANET_SURFACE_ANCHOR_LEVEL = 16;

export interface PlanetSurfaceAnchor {
	id: string;
	coordinate: GeodeticCoordinate;
	referenceElevationMeters: number;
	planetPosition: PlanetPosition;
	frame: LocalPlanetFrame;
	tile: PlanetTileId;
}

export interface PlanetSurfaceAnchorSaveState {
	version: 1;
	id: string;
	latitudeRadians: number;
	longitudeRadians: number;
	referenceElevationMeters: number;
	level: number;
}

export function createPlanetSurfaceAnchor(
	coordinateSystem: PlanetCoordinateSystem,
	coordinate: Readonly<GeodeticCoordinate>,
	referenceElevationMeters: number,
	level = PLANET_SURFACE_ANCHOR_LEVEL
): PlanetSurfaceAnchor {
	if (!Number.isFinite(referenceElevationMeters)) {
		throw new RangeError('Surface anchor elevation must be finite.');
	}
	if (!Number.isInteger(level) || level < 0 || level > 24) {
		throw new RangeError('Surface anchor level must be an integer between 0 and 24.');
	}

	const normalizedCoordinate: GeodeticCoordinate = {
		latitudeRadians: coordinate.latitudeRadians,
		longitudeRadians: coordinate.longitudeRadians,
		altitudeMeters: referenceElevationMeters
	};
	const planetPosition = coordinateSystem.geodeticToPlanet(normalizedCoordinate);
	const direction = new Vector3(planetPosition.x, planetPosition.y, planetPosition.z);
	const faceUv = directionToCubeFaceUv(direction);
	const side = 2 ** level;
	const tile: PlanetTileId = {
		face: faceUv.face,
		level,
		x: Math.min(side - 1, Math.max(0, Math.floor(faceUv.u * side))),
		y: Math.min(side - 1, Math.max(0, Math.floor(faceUv.v * side)))
	};
	// Keep region/save identifiers compatible with worlds created before the
	// right-handed Earth migration. Runtime geometry uses the canonical tile.
	const stableIdTile = canonicalTileToDataTile(tile, 'legacy-positive-z-east');
	const id = `earth/${planetTileKey(stableIdTile)}`;

	return {
		id,
		coordinate: normalizedCoordinate,
		referenceElevationMeters,
		planetPosition: { ...planetPosition },
		frame: coordinateSystem.localFrameAt(normalizedCoordinate),
		tile
	};
}

export function serializePlanetSurfaceAnchor(
	anchor: Readonly<PlanetSurfaceAnchor>
): PlanetSurfaceAnchorSaveState {
	return {
		version: 1,
		id: anchor.id,
		latitudeRadians: anchor.coordinate.latitudeRadians,
		longitudeRadians: anchor.coordinate.longitudeRadians,
		referenceElevationMeters: anchor.referenceElevationMeters,
		level: anchor.tile.level
	};
}

export function restorePlanetSurfaceAnchor(
	coordinateSystem: PlanetCoordinateSystem,
	state: Readonly<PlanetSurfaceAnchorSaveState>
): PlanetSurfaceAnchor {
	if (state.version !== 1 || typeof state.id !== 'string') {
		throw new TypeError('Unsupported planet surface anchor state.');
	}
	const anchor = createPlanetSurfaceAnchor(
		coordinateSystem,
		{
			latitudeRadians: state.latitudeRadians,
			longitudeRadians: state.longitudeRadians,
			altitudeMeters: state.referenceElevationMeters
		},
		state.referenceElevationMeters,
		state.level
	);
	return { ...anchor, id: state.id };
}
