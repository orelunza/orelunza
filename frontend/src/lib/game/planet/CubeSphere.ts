import { Vector3 } from 'three';
import type { PlanetDefinition } from './PlanetDefinition';
import { EARTH_PLANET } from './PlanetDefinition';
import type { PlanetFace } from './PlanetFace';
import type { PlanetTileId } from './PlanetTileId';
import { planetTileUvBounds } from './PlanetTileId';

export interface CubeFaceUv {
	face: PlanetFace;
	u: number;
	v: number;
}

export function cubeFaceUvToDirection(
	face: PlanetFace,
	u: number,
	v: number,
	target = new Vector3()
): Vector3 {
	const s = clamp01(u) * 2 - 1;
	const t = clamp01(v) * 2 - 1;

	switch (face) {
		case 'positive-x':
			target.set(1, t, -s);
			break;
		case 'negative-x':
			target.set(-1, t, s);
			break;
		case 'positive-y':
			target.set(s, 1, -t);
			break;
		case 'negative-y':
			target.set(s, -1, t);
			break;
		case 'positive-z':
			target.set(s, t, 1);
			break;
		case 'negative-z':
			target.set(-s, t, -1);
			break;
	}

	return target.normalize();
}

export function directionToCubeFaceUv(direction: Readonly<Vector3>): CubeFaceUv {
	const length = Math.hypot(direction.x, direction.y, direction.z);
	if (!Number.isFinite(length) || length <= 1e-12) {
		throw new RangeError('Direction must be finite and non-zero.');
	}

	const x = direction.x / length;
	const y = direction.y / length;
	const z = direction.z / length;
	const ax = Math.abs(x);
	const ay = Math.abs(y);
	const az = Math.abs(z);
	let face: PlanetFace;
	let s: number;
	let t: number;

	if (ax >= ay && ax >= az) {
		if (x >= 0) {
			face = 'positive-x';
			s = -z / ax;
			t = y / ax;
		} else {
			face = 'negative-x';
			s = z / ax;
			t = y / ax;
		}
	} else if (ay >= ax && ay >= az) {
		if (y >= 0) {
			face = 'positive-y';
			s = x / ay;
			t = -z / ay;
		} else {
			face = 'negative-y';
			s = x / ay;
			t = z / ay;
		}
	} else if (z >= 0) {
		face = 'positive-z';
		s = x / az;
		t = y / az;
	} else {
		face = 'negative-z';
		s = -x / az;
		t = y / az;
	}

	return { face, u: clamp01((s + 1) * 0.5), v: clamp01((t + 1) * 0.5) };
}

export function cubeSphereSurfacePoint(
	face: PlanetFace,
	u: number,
	v: number,
	definition: Readonly<PlanetDefinition> = EARTH_PLANET,
	target = new Vector3()
): Vector3 {
	cubeFaceUvToDirection(face, u, v, target);
	const a = definition.equatorialRadiusMeters;
	const b = definition.polarRadiusMeters;
	const radius = 1 / Math.sqrt((target.x ** 2 + target.z ** 2) / a ** 2 + target.y ** 2 / b ** 2);
	return target.multiplyScalar(radius);
}

export function planetTileCenterDirection(
	tile: Readonly<PlanetTileId>,
	target = new Vector3()
): Vector3 {
	const bounds = planetTileUvBounds(tile);
	return cubeFaceUvToDirection(
		tile.face,
		(bounds.minU + bounds.maxU) * 0.5,
		(bounds.minV + bounds.maxV) * 0.5,
		target
	);
}

export function planetTileAngularRadius(tile: Readonly<PlanetTileId>): number {
	const bounds = planetTileUvBounds(tile);
	const centre = planetTileCenterDirection(tile);
	const corners = [
		cubeFaceUvToDirection(tile.face, bounds.minU, bounds.minV),
		cubeFaceUvToDirection(tile.face, bounds.maxU, bounds.minV),
		cubeFaceUvToDirection(tile.face, bounds.minU, bounds.maxV),
		cubeFaceUvToDirection(tile.face, bounds.maxU, bounds.maxV)
	];

	let maximum = 0;
	for (const corner of corners) {
		maximum = Math.max(maximum, Math.acos(Math.max(-1, Math.min(1, centre.dot(corner)))));
	}
	return maximum;
}

function clamp01(value: number): number {
	if (!Number.isFinite(value)) {
		throw new RangeError('Cube-sphere coordinates must be finite.');
	}
	return Math.max(0, Math.min(1, value));
}
