import { describe, expect, test } from 'vitest';
import { Vector3 } from 'three';

import { PlanetCoordinateSystem } from '../../planet/PlanetCoordinateSystem';
import { createPlanetSurfaceAnchor } from '../../planet/surface/PlanetSurfaceAnchor';
import { PlanetLocalCoordinateSystem } from '../../planet/surface/PlanetLocalCoordinateSystem';
import { buildPlanetSurfaceElevationGrid } from './PlanetSurfaceRegionBuilder';
import { PlanetTerrainColumnSampler } from './PlanetTerrainColumnSampler';
import { PlanetTerrainGenerator } from './PlanetTerrainGenerator';
import { PlanetVoxelBridge } from './PlanetVoxelBridge';
import { planetSurfaceChunkKey } from '../../planet/surface/PlanetSurfaceChunkId';

const planet = new PlanetCoordinateSystem();
const coordinate = {
	latitudeRadians: 0.4,
	longitudeRadians: 0.8,
	altitudeMeters: 600
};

function createGradientSource() {
	return {
		async sample(value: typeof coordinate) {
			const elevationMeters = 600 + value.latitudeRadians * 80 + value.longitudeRadians * 35;
			return {
				elevationMeters,
				land: 1,
				bathymetryMeters: 0,
				coastProximity: 0
			};
		}
	};
}

describe('planet Earth Lot 3 local voxel terrain', () => {
	test('builds a finite geographic elevation grid in the tangent frame', async () => {
		const anchor = createPlanetSurfaceAnchor(planet, coordinate, 600);
		const local = new PlanetLocalCoordinateSystem(planet, anchor);
		const grid = await buildPlanetSurfaceElevationGrid(local, createGradientSource(), {
			halfExtentMeters: 64,
			resolution: 7
		});
		expect(grid.elevationMeters).toHaveLength(49);
		expect(grid.minimumElevationMeters).toBeLessThanOrEqual(grid.maximumElevationMeters);
		expect([...grid.elevationMeters].every(Number.isFinite)).toBe(true);
	});

	test('interpolates column elevation and preserves the geographic reference', () => {
		const values = new Float32Array([100, 110, 120, 130]);
		const sampler = new PlanetTerrainColumnSampler({
			resolution: 2,
			halfExtentMeters: 10,
			referenceElevationMeters: 115,
			elevationMeters: values,
			landMask: new Uint8Array([255, 255, 255, 255]),
			minimumElevationMeters: 100,
			maximumElevationMeters: 130
		});
		expect(sampler.sample(0, 0).elevationMeters).toBeCloseTo(115, 8);
		expect(sampler.sample(0, 0).relativeHeightMeters).toBeCloseTo(0, 8);
	});

	test('generates deterministic bounded voxel terrain from the real elevation grid', async () => {
		const anchor = createPlanetSurfaceAnchor(planet, coordinate, 600);
		const local = new PlanetLocalCoordinateSystem(planet, anchor);
		const grid = await buildPlanetSurfaceElevationGrid(local, createGradientSource(), {
			halfExtentMeters: 64,
			resolution: 7
		});
		const first = new PlanetTerrainGenerator(anchor, new PlanetTerrainColumnSampler(grid));
		const second = new PlanetTerrainGenerator(anchor, new PlanetTerrainColumnSampler(grid));
		for (let x = -32; x <= 32; x += 4) {
			for (let z = -32; z <= 32; z += 4) {
				expect(second.heightAt(x, z)).toBe(first.heightAt(x, z));
				expect(first.heightAt(x, z)).toBeGreaterThan(1);
				expect(first.heightAt(x, z)).toBeLessThan(497);
			}
		}
	});

	test('carves deterministic rivers and fills inland water from the watershed', () => {
		const resolution = 9;
		const elevationMeters = new Float32Array(resolution * resolution);
		const landMask = new Uint8Array(resolution * resolution).fill(255);
		for (let row = 0; row < resolution; row += 1) {
			for (let column = 0; column < resolution; column += 1) {
				elevationMeters[row * resolution + column] =
					60 + Math.abs(column - 4) * 18 + (resolution - 1 - row) * 5;
			}
		}
		landMask[8 * resolution + 4] = 0;
		elevationMeters[8 * resolution + 4] = -5;
		const anchor = createPlanetSurfaceAnchor(planet, { ...coordinate, altitudeMeters: 60 }, 60);
		const generator = new PlanetTerrainGenerator(
			anchor,
			new PlanetTerrainColumnSampler({
				resolution,
				halfExtentMeters: 128,
				referenceElevationMeters: 60,
				elevationMeters,
				landMask,
				minimumElevationMeters: -5,
				maximumElevationMeters: 172
			}),
			{ detailAmplitudeMeters: 2, seed: 'hydrology-test' }
		);
		let water: { x: number; z: number } | null = null;
		for (let z = -120; z <= 120 && !water; z += 2) {
			for (let x = -120; x <= 120; x += 2) {
				if (generator.hydrologyAt(x, z).kind !== 'none') {
					water = { x, z };
					break;
				}
			}
		}
		expect(water).not.toBeNull();
		if (!water) return;
		const sample = generator.hydrologyAt(water.x, water.z);
		expect(sample.waterSurfaceElevationMeters).not.toBeNull();
		expect(['Planet River', 'Planet Lake', 'River Mouth', 'Waterfall']).toContain(
			generator.zoneAt(water.x, water.z)
		);
		const chunk = generator.generateChunk(Math.floor(water.x / 16), Math.floor(water.z / 16));
		expect(
			chunk.blocks.some(
				(block) =>
					block.type === 'water' && block.position.x === water.x && block.position.z === water.z
			)
		).toBe(true);
	});

	test('creates stable anchor-scoped chunk identifiers', () => {
		const key = planetSurfaceChunkKey({ anchorId: 'earth/positive-x/16/10/12', x: -3, z: 8 });
		expect(key).toBe('earth/positive-x/16/10/12/chunk/-3/8');
	});

	test('bridges chunk loading, block editing and geodetic lookup', async () => {
		const anchor = createPlanetSurfaceAnchor(planet, coordinate, 600);
		const local = new PlanetLocalCoordinateSystem(planet, anchor);
		const grid = await buildPlanetSurfaceElevationGrid(local, createGradientSource(), {
			halfExtentMeters: 64,
			resolution: 7
		});
		const generator = new PlanetTerrainGenerator(anchor, new PlanetTerrainColumnSampler(grid));
		const bridge = new PlanetVoxelBridge(local, generator);
		expect(bridge.ensureChunksAround({ x: 0, z: 0 }, 1)).toBe(true);
		const top = generator.heightAt(0, 0);
		const original = bridge.world.getBlock({ x: 0, y: top, z: 0 }).type;
		expect(bridge.removeBlock({ x: 0, y: top, z: 0 })).toBe(original);
		expect(bridge.placeBlock({ x: 0, y: top + 1, z: 0 }, 'brick')).toBe(true);
		expect(bridge.edits.size).toBe(2);
		const geodetic = bridge.blockToGeodetic({ x: 0, y: top, z: 0 });
		expect(
			[geodetic.latitudeRadians, geodetic.longitudeRadians, geodetic.altitudeMeters].every(
				Number.isFinite
			)
		).toBe(true);
	});

	test('keeps tangent conversion stable across several kilometres', () => {
		const anchor = createPlanetSurfaceAnchor(planet, coordinate, 600);
		const local = new PlanetLocalCoordinateSystem(planet, anchor);
		for (let index = 0; index < 1000; index += 1) {
			const point = new Vector3(index * 5 - 2500, (index % 17) - 8, 1800 - index * 3);
			const restored = local.toLocal(local.toGlobal(point));
			expect(restored.distanceTo(point)).toBeLessThan(1e-6);
		}
	});
});
