import { describe, expect, test } from 'vitest';
import { Ray, Vector3 } from 'three';

import { EARTH_PLANET } from '../PlanetDefinition';
import { PlanetCoordinateSystem } from '../PlanetCoordinateSystem';
import { planetTileKey } from '../PlanetTileId';
import { canonicalTileToDataTile } from '../../geography/PlanetDataProjection';
import { createPlanetSurfaceAnchor } from './PlanetSurfaceAnchor';
import { PlanetLocalCoordinateSystem } from './PlanetLocalCoordinateSystem';
import { rayToPlanetDestination, resolveSurfaceDestination } from './PlanetSurfaceDestination';
import { PlanetSurfaceTransition } from './PlanetSurfaceTransition';
import {
	ConstantPlanetSurfaceElevationSource,
	PlanetSurfaceDestinationError,
	PlanetSurfaceSpawnResolver
} from './PlanetSurfaceSpawnResolver';
import { PlanetSurfaceSession } from './PlanetSurfaceSession';
import { FlatGravityProvider } from '../../physics/FlatGravityProvider';
import { PlanetGravityProvider } from '../../physics/PlanetGravityProvider';

const coordinateSystem = new PlanetCoordinateSystem();
const uganda = {
	latitudeRadians: (1.4 * Math.PI) / 180,
	longitudeRadians: (32.3 * Math.PI) / 180,
	altitudeMeters: 1150
};

describe('planet Earth Lot 3 surface bridge', () => {
	test('creates a stable quantized anchor and east-up-north local frame', () => {
		const first = createPlanetSurfaceAnchor(coordinateSystem, uganda, 1150);
		const second = createPlanetSurfaceAnchor(
			coordinateSystem,
			{ ...uganda, altitudeMeters: 0 },
			1150
		);
		expect(second.id).toBe(first.id);
		const legacyTile = canonicalTileToDataTile(first.tile, 'legacy-positive-z-east');
		expect(first.id).toBe(`earth/${planetTileKey(legacyTile)}`);
		expect(first.frame.east.dot(first.frame.up)).toBeCloseTo(0, 10);
		expect(first.frame.north.dot(first.frame.up)).toBeCloseTo(0, 10);
		expect(first.frame.east.clone().cross(first.frame.up).dot(first.frame.north)).toBeCloseTo(
			-1,
			10
		);
	});

	test('round-trips local coordinates through global and geodetic space', () => {
		const anchor = createPlanetSurfaceAnchor(coordinateSystem, uganda, 1150);
		const localCoordinates = new PlanetLocalCoordinateSystem(coordinateSystem, anchor);
		for (const local of [
			new Vector3(0, 0, 0),
			new Vector3(120, 14, -85),
			new Vector3(-1700, 30, 2400)
		]) {
			const global = localCoordinates.toGlobal(local);
			const restored = localCoordinates.toLocal(global);
			expect(restored.distanceTo(local)).toBeLessThan(1e-6);
			const geodetic = localCoordinates.toGeodeticFromLocal(local);
			const fromGeodetic = localCoordinates.toLocalFromGeodetic(geodetic);
			expect(fromGeodetic.distanceTo(local)).toBeLessThan(0.01);
		}
	});

	test('converts a render-space ray into a geographic destination', () => {
		const ray = new Ray(new Vector3(0, 0, 300), new Vector3(0, 0, -1));
		const coordinate = rayToPlanetDestination(ray, EARTH_PLANET, coordinateSystem);
		expect(coordinate).not.toBeNull();
		expect(coordinate?.latitudeRadians).toBeCloseTo(0, 8);
		expect(coordinate?.longitudeRadians).toBeCloseTo(-Math.PI / 2, 8);
	});

	test('rejects ocean destinations and accepts land destinations', () => {
		const land = resolveSurfaceDestination(uganda, {
			elevationMeters: 1150,
			land: 1,
			bathymetryMeters: 0,
			coastProximity: 0
		});
		const ocean = resolveSurfaceDestination(uganda, {
			elevationMeters: -4200,
			land: 0,
			bathymetryMeters: -4200,
			coastProximity: 0
		});
		expect(land.status).toBe('land');
		expect(ocean.status).toBe('ocean');
		expect(ocean.message).toBe('Surface destination required');
	});

	test('advances descent and ascent independently of frame subdivision', () => {
		const thirty = new PlanetSurfaceTransition();
		const oneTwenty = new PlanetSurfaceTransition();
		thirty.beginDescent(2);
		oneTwenty.beginDescent(2);
		for (let index = 0; index < 60; index += 1) thirty.update(1 / 30);
		for (let index = 0; index < 240; index += 1) oneTwenty.update(1 / 120);
		expect(thirty.snapshot.mode).toBe('surface');
		expect(oneTwenty.snapshot).toEqual(thirty.snapshot);
		thirty.beginAscent(1);
		thirty.update(1);
		expect(thirty.snapshot.mode).toBe('globe');
	});

	test('prepares a land surface session, rebases globally and restores edits', async () => {
		const source = new ConstantPlanetSurfaceElevationSource({
			elevationMeters: 1150,
			land: 1,
			bathymetryMeters: 0,
			coastProximity: 0
		});
		const region = await new PlanetSurfaceSpawnResolver(coordinateSystem, source).resolve(uganda, {
			halfExtentMeters: 64,
			resolution: 5
		});
		const session = new PlanetSurfaceSession(region, 1000);
		const initial = session.updatePlayerLocalPosition(region.spawnPosition);
		expect(initial.geodetic.altitudeMeters).toBeGreaterThan(1140);
		const moved = session.updatePlayerLocalPosition(new Vector3(1800, region.spawnPosition.y, 0));
		expect(moved.originRebase.rebased).toBe(true);
		const top = region.generator.heightAt(0, 0);
		expect(region.bridge.removeBlock({ x: 0, y: top, z: 0 })).not.toBeNull();
		const save = session.serialize();

		const restoredRegion = await new PlanetSurfaceSpawnResolver(coordinateSystem, source).resolve(
			uganda,
			{ halfExtentMeters: 64, resolution: 5 }
		);
		const restored = new PlanetSurfaceSession(restoredRegion, 1000);
		restored.restore(save);
		expect(restored.region.bridge.edits.size).toBe(1);
		expect(restored.region.bridge.world.getBlock({ x: 0, y: top, z: 0 }).type).toBe('air');
		session.dispose();
		restored.dispose();
	});

	test('refuses to prepare an ocean surface session', async () => {
		const source = new ConstantPlanetSurfaceElevationSource({
			elevationMeters: -3000,
			land: 0,
			bathymetryMeters: -3000,
			coastProximity: 0
		});
		await expect(
			new PlanetSurfaceSpawnResolver(coordinateSystem, source).resolve(uganda, {
				halfExtentMeters: 64,
				resolution: 5
			})
		).rejects.toBeInstanceOf(PlanetSurfaceDestinationError);
	});

	test('keeps flat and spherical gravity providers explicit', () => {
		const flat = new FlatGravityProvider(20).sample({ x: 0, y: 0, z: 0 });
		expect(flat.direction.toArray()).toEqual([0, -1, 0]);
		const global = coordinateSystem.geodeticToPlanet(uganda);
		const spherical = new PlanetGravityProvider().sample(global);
		expect(spherical.direction.length()).toBeCloseTo(1, 10);
		expect(spherical.direction.dot(spherical.up)).toBeCloseTo(-1, 10);
	});
});
