import { describe, expect, test } from 'vitest';
import { PerspectiveCamera, Scene, Vector3 } from 'three';

import {
	cubeFaceUvToDirection,
	directionToCubeFaceUv,
	planetTileAngularRadius,
	planetTileCenterDirection
} from './CubeSphere';
import { FloatingOrigin } from './FloatingOrigin';
import { isOrthonormalPlanetFrame } from './LocalPlanetFrame';
import { PlanetCoordinateSystem } from './PlanetCoordinateSystem';
import { EARTH_PLANET } from './PlanetDefinition';
import { PLANET_FACES } from './PlanetFace';
import { PlanetGravity } from './PlanetGravity';
import { PlanetLodSystem } from './PlanetLodSystem';
import { PlanetQuadtree } from './PlanetQuadtree';
import { isPlanetTileAboveHorizon } from './PlanetVisibility';
import {
	planetTileChildren,
	planetTileKey,
	planetTileParent,
	planetTileUvBounds,
	type PlanetTileId
} from './PlanetTileId';
import { PlanetRenderer } from '../rendering/planet/PlanetRenderer';
import { PlanetTileRenderer } from '../rendering/planet/PlanetTileRenderer';

const coordinateSystem = new PlanetCoordinateSystem();

function expectCoordinateClose(
	actual: { latitudeRadians: number; longitudeRadians: number; altitudeMeters: number },
	expected: { latitudeRadians: number; longitudeRadians: number; altitudeMeters: number }
): void {
	expect(actual.latitudeRadians).toBeCloseTo(expected.latitudeRadians, 9);
	const longitudeDelta = Math.atan2(
		Math.sin(actual.longitudeRadians - expected.longitudeRadians),
		Math.cos(actual.longitudeRadians - expected.longitudeRadians)
	);
	expect(longitudeDelta).toBeCloseTo(0, 9);
	expect(actual.altitudeMeters).toBeCloseTo(expected.altitudeMeters, 4);
}

describe('planet Earth Lot 1 foundation', () => {
	test('round-trips geodetic coordinates at the equator, hemispheres and below sea level', () => {
		const coordinates = [
			{ latitudeRadians: 0, longitudeRadians: 0, altitudeMeters: 0 },
			{ latitudeRadians: 0.71, longitudeRadians: 2.38, altitudeMeters: 4210 },
			{ latitudeRadians: -0.54, longitudeRadians: -2.91, altitudeMeters: -430 },
			{ latitudeRadians: 0.02, longitudeRadians: Math.PI - 1e-7, altitudeMeters: 83 }
		];

		for (const coordinate of coordinates) {
			const planet = coordinateSystem.geodeticToPlanet(coordinate);
			expectCoordinateClose(coordinateSystem.planetToGeodetic(planet), coordinate);
		}
	});

	test('handles both poles without producing NaN', () => {
		for (const latitudeRadians of [Math.PI / 2, -Math.PI / 2]) {
			const planet = coordinateSystem.geodeticToPlanet({
				latitudeRadians,
				longitudeRadians: 1.7,
				altitudeMeters: 1000
			});
			const restored = coordinateSystem.planetToGeodetic(planet);
			expect(restored.latitudeRadians).toBeCloseTo(latitudeRadians, 9);
			expect(restored.altitudeMeters).toBeCloseTo(1000, 4);
			expect(Object.values(restored).every(Number.isFinite)).toBe(true);
		}
	});

	test('creates an orthonormal east north up frame anywhere on Earth', () => {
		for (const coordinate of [
			{ latitudeRadians: 0, longitudeRadians: 0, altitudeMeters: 0 },
			{ latitudeRadians: 1.1, longitudeRadians: -2.2, altitudeMeters: 0 },
			{ latitudeRadians: -1.4, longitudeRadians: 2.8, altitudeMeters: 0 }
		]) {
			expect(isOrthonormalPlanetFrame(coordinateSystem.localFrameAt(coordinate))).toBe(true);
		}
	});

	test('maps every cube face centre to a unique direction and back', () => {
		const keys = new Set<string>();
		for (const face of PLANET_FACES) {
			const direction = cubeFaceUvToDirection(face, 0.5, 0.5);
			const inverse = directionToCubeFaceUv(direction);
			expect(inverse.face).toBe(face);
			expect(inverse.u).toBeCloseTo(0.5, 10);
			expect(inverse.v).toBeCloseTo(0.5, 10);
			keys.add(`${direction.x.toFixed(2)},${direction.y.toFixed(2)},${direction.z.toFixed(2)}`);
		}
		expect(keys.size).toBe(6);
	});

	test('creates deterministic tile identifiers, bounds, parents and four children', () => {
		const tile: PlanetTileId = { face: 'positive-z', level: 8, x: 142, y: 97 };
		expect(planetTileKey(tile)).toBe('positive-z/8/142/97');
		expect(planetTileUvBounds(tile)).toEqual({
			minU: 142 / 256,
			minV: 97 / 256,
			maxU: 143 / 256,
			maxV: 98 / 256
		});
		const children = planetTileChildren(tile);
		expect(children).toHaveLength(4);
		expect(new Set(children.map(planetTileKey)).size).toBe(4);
		for (const child of children) {
			expect(planetTileParent(child)).toEqual(tile);
		}
	});

	test('subdivides the six roots without emitting invalid quadtree tiles', () => {
		const quadtree = new PlanetQuadtree();
		const tiles = quadtree.select({
			maximumLevel: 3,
			maximumTiles: 384,
			shouldSubdivide: (tile) => tile.level < 3
		});
		expect(tiles).toHaveLength(384);
		for (const tile of tiles) {
			const side = 2 ** tile.level;
			expect(tile.level).toBe(3);
			expect(tile.x).toBeGreaterThanOrEqual(0);
			expect(tile.y).toBeGreaterThanOrEqual(0);
			expect(tile.x).toBeLessThan(side);
			expect(tile.y).toBeLessThan(side);
			expect(planetTileAngularRadius(tile)).toBeGreaterThan(0);
			expect(planetTileCenterDirection(tile).length()).toBeCloseTo(1, 10);
		}
	});

	test('culls a tile on the far side of the horizon', () => {
		const camera = new Vector3(EARTH_PLANET.equatorialRadiusMeters * 2.5, 0, 0);
		expect(isPlanetTileAboveHorizon({ face: 'positive-x', level: 2, x: 1, y: 1 }, camera)).toBe(
			true
		);
		expect(isPlanetTileAboveHorizon({ face: 'negative-x', level: 2, x: 1, y: 1 }, camera)).toBe(
			false
		);
	});

	test('keeps LOD output stable when the camera does not cross a hysteresis threshold', () => {
		const lod = new PlanetLodSystem();
		const camera = new Vector3(EARTH_PLANET.equatorialRadiusMeters * 2.2, 0, 0);
		const first = lod.update({
			cameraPlanetPosition: camera,
			verticalFieldOfViewRadians: Math.PI / 3,
			viewportHeightPixels: 1080,
			quality: 'medium'
		});
		const second = lod.update({
			cameraPlanetPosition: camera.clone().add(new Vector3(10, 0, 0)),
			verticalFieldOfViewRadians: Math.PI / 3,
			viewportHeightPixels: 1080,
			quality: 'medium'
		});
		expect(second.tiles.map(planetTileKey)).toEqual(first.tiles.map(planetTileKey));
		expect(first.visibleTileCount).toBeGreaterThan(0);
		expect(first.visibleTileCount).toBeLessThanOrEqual(2048);
	});

	test('samples normalized spherical gravity with finite inverse-square acceleration', () => {
		const gravity = new PlanetGravity();
		for (const position of [
			new Vector3(EARTH_PLANET.equatorialRadiusMeters, 0, 0),
			new Vector3(0, EARTH_PLANET.polarRadiusMeters + 1000, 0),
			new Vector3(-4_000_000, 3_000_000, 5_000_000)
		]) {
			const sample = gravity.sample(position);
			expect(sample.direction.length()).toBeCloseTo(1, 10);
			expect(sample.up.length()).toBeCloseTo(1, 10);
			expect(sample.direction.dot(sample.up)).toBeCloseTo(-1, 10);
			expect(sample.acceleration).toBeGreaterThan(0);
			expect(sample.acceleration).toBeLessThan(30);
		}
	});

	test('rebases thousands of kilometres without losing global position', () => {
		const origin = new FloatingOrigin({ x: 6_378_137, y: 0, z: 0 }, 1000);
		const global = { x: 6_378_137, y: 0, z: 0 };
		for (let index = 1; index <= 3000; index += 1) {
			global.x += 1250;
			global.y += index % 2 === 0 ? 4 : -4;
			const result = origin.rebaseIfNeeded(global);
			expect(result.rebased).toBe(true);
			const local = origin.toLocal(global);
			expect(local.length()).toBeCloseTo(0, 10);
			const restored = origin.toGlobal(local);
			expect(restored.x).toBe(global.x);
			expect(restored.y).toBe(global.y);
			expect(restored.z).toBe(global.z);
		}
		expect(origin.state.rebaseCount).toBe(3000);
	});

	test('builds bounded combined globe geometry and disposes the renderer idempotently', () => {
		const roots = PLANET_FACES.map((face) => ({ face, level: 0, x: 0, y: 0 }) as PlanetTileId);
		const geometry = PlanetTileRenderer.buildGeometry(roots, 2);
		expect(geometry.triangleCount).toBe(48);
		expect(geometry.surface.getAttribute('position').count).toBe(54);
		expect(geometry.grid.getAttribute('position').count).toBeGreaterThan(0);
		geometry.surface.dispose();
		geometry.grid.dispose();

		const scene = new Scene();
		const renderer = new PlanetRenderer(scene);
		const camera = new PerspectiveCamera(45, 1, 0.1, 5000);
		camera.position.set(0, 0, 280);
		renderer.update(camera, 720);
		expect(renderer.diagnostics.activeTiles).toBeGreaterThan(0);
		renderer.dispose();
		renderer.dispose();
		expect(scene.children).not.toContain(renderer.object);
	});
});
