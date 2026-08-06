import { Vector3 } from 'three';
import { directionToCubeFaceUv, type CubeFaceUv } from '../planet/CubeSphere';
import type { GeodeticCoordinate } from '../planet/GeodeticCoordinate';
import type { PlanetFace } from '../planet/PlanetFace';
import type { PlanetTileId } from '../planet/PlanetTileId';
import type { PlanetDataCoordinateConvention } from './PlanetDataManifest';

const direction = new Vector3();

/**
 * Converts a WGS84 coordinate into Orelunza's canonical right-handed planet direction.
 * +Y points north, +X crosses Greenwich and -Z points east at 90°E.
 */
export function geodeticToCanonicalDirection(
	coordinate: Readonly<Pick<GeodeticCoordinate, 'latitudeRadians' | 'longitudeRadians'>>,
	target = new Vector3()
): Vector3 {
	const latitude = coordinate.latitudeRadians;
	const longitude = coordinate.longitudeRadians;
	if (![latitude, longitude].every(Number.isFinite)) {
		throw new RangeError('Geodetic direction coordinate must be finite.');
	}
	const cosLatitude = Math.cos(latitude);
	return target
		.set(cosLatitude * Math.cos(longitude), Math.sin(latitude), -cosLatitude * Math.sin(longitude))
		.normalize();
}

/** Maps a canonical WGS84 coordinate into the cube face used by a data pack. */
export function geodeticToDataFaceUv(
	coordinate: Readonly<Pick<GeodeticCoordinate, 'latitudeRadians' | 'longitudeRadians'>>,
	convention: PlanetDataCoordinateConvention
): CubeFaceUv {
	geodeticToCanonicalDirection(coordinate, direction);
	if (convention === 'legacy-positive-z-east') {
		direction.z = -direction.z;
	}
	return directionToCubeFaceUv(direction);
}

/**
 * Maps canonical render-face UVs to the equivalent coordinates in a data pack.
 * Old preview packs were produced with +Z pointing east and are reflected here at runtime.
 */
export function canonicalFaceUvToDataFaceUv(
	face: PlanetFace,
	u: number,
	v: number,
	convention: PlanetDataCoordinateConvention
): CubeFaceUv {
	if (convention === 'right-handed-negative-z-east') {
		return { face, u, v };
	}

	switch (face) {
		case 'positive-x':
		case 'negative-x':
			return { face, u: 1 - u, v };
		case 'positive-y':
		case 'negative-y':
			return { face, u, v: 1 - v };
		case 'positive-z':
			return { face: 'negative-z', u: 1 - u, v };
		case 'negative-z':
			return { face: 'positive-z', u: 1 - u, v };
	}
}

/** Maps a canonical render tile to the exact equivalent tile in a data pack. */
export function canonicalTileToDataTile(
	tile: Readonly<PlanetTileId>,
	convention: PlanetDataCoordinateConvention
): PlanetTileId {
	if (convention === 'right-handed-negative-z-east') {
		return { ...tile };
	}
	const side = 2 ** tile.level;
	switch (tile.face) {
		case 'positive-x':
		case 'negative-x':
			return { ...tile, x: side - 1 - tile.x };
		case 'positive-y':
		case 'negative-y':
			return { ...tile, y: side - 1 - tile.y };
		case 'positive-z':
			return { ...tile, face: 'negative-z', x: side - 1 - tile.x };
		case 'negative-z':
			return { ...tile, face: 'positive-z', x: side - 1 - tile.x };
	}
}
