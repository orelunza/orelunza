import { Scene, Vector3 } from 'three';
import { describe, expect, test } from 'vitest';

import { TallGrassRenderer, resolveTallGrassProfile } from '../rendering/TallGrassRenderer';
import { resolveQualitySettings } from '../rendering/QualitySettings';
import {
	tallGrassDensityForZone,
	tallGrassPlacementAt,
	tallGrassSeedValue
} from './TallGrassField';
import { createTallGrassGeometry, TALL_GRASS_PLANE_COUNT } from './TallGrassGeometry';
import { VoxelWorld } from './VoxelWorld';

describe('production tall grass', () => {
	test('builds three crossed tapered planes with finite attributes', () => {
		const geometry = createTallGrassGeometry();
		const positions = geometry.getAttribute('position');
		const normals = geometry.getAttribute('normal');
		const colors = geometry.getAttribute('color');
		let minimumY = Number.POSITIVE_INFINITY;
		let maximumY = Number.NEGATIVE_INFINITY;

		expect(positions.count).toBe(TALL_GRASS_PLANE_COUNT * 6);
		expect(normals.count).toBe(positions.count);
		expect(colors.count).toBe(positions.count);

		for (let index = 0; index < positions.count; index += 1) {
			const y = positions.getY(index);
			minimumY = Math.min(minimumY, y);
			maximumY = Math.max(maximumY, y);

			expect(Number.isFinite(positions.getX(index))).toBe(true);
			expect(Number.isFinite(y)).toBe(true);
			expect(Number.isFinite(positions.getZ(index))).toBe(true);
		}

		expect(minimumY).toBeCloseTo(0, 6);
		expect(maximumY).toBeCloseTo(1, 6);
		geometry.dispose();
	});

	test('generates the same field for the same world seed', () => {
		const seed = tallGrassSeedValue('orelunza-field');
		const first = collectPlacements(seed, 'Spawn Meadow');
		const second = collectPlacements(seed, 'Spawn Meadow');

		expect(first).toEqual(second);
		expect(first.length).toBeGreaterThan(0);
	});

	test('changes the field when the world seed changes', () => {
		const first = collectPlacements(tallGrassSeedValue('world-a'), 'Spawn Meadow');
		const second = collectPlacements(tallGrassSeedValue('world-b'), 'Spawn Meadow');

		expect(first).not.toEqual(second);
	});

	test('keeps instance transforms finite and within production bounds', () => {
		const seed = tallGrassSeedValue('bounded-field');

		for (let x = -24; x <= 24; x += 1) {
			for (let z = -24; z <= 24; z += 1) {
				const placement = tallGrassPlacementAt(x, 9, z, 'Forest Edge', 1, seed);

				if (!placement) {
					continue;
				}

				expect(Number.isFinite(placement.x)).toBe(true);
				expect(Number.isFinite(placement.y)).toBe(true);
				expect(Number.isFinite(placement.z)).toBe(true);
				expect(placement.width).toBeGreaterThanOrEqual(0.72);
				expect(placement.width).toBeLessThanOrEqual(1.2);
				expect(placement.height).toBeGreaterThanOrEqual(0.66);
				expect(placement.height).toBeLessThanOrEqual(1.38);
				expect(placement.rotationY).toBeGreaterThanOrEqual(0);
				expect(placement.rotationY).toBeLessThanOrEqual(Math.PI * 2);
			}
		}
	});

	test('uses biome and quality density without filling the city', () => {
		expect(tallGrassDensityForZone('Central City', 1)).toBeLessThan(
			tallGrassDensityForZone('Forest Edge', 1)
		);
		expect(tallGrassDensityForZone('Spawn Meadow', 0)).toBe(0);
		expect(tallGrassDensityForZone('Forest Edge', 2)).toBeLessThanOrEqual(1);
	});

	test('increases distance and density budgets with quality', () => {
		const low = resolveTallGrassProfile(resolveQualitySettings('low'));
		const medium = resolveTallGrassProfile(resolveQualitySettings('medium'));
		const high = resolveTallGrassProfile(resolveQualitySettings('high'));

		expect(low.density).toBeLessThan(medium.density);
		expect(medium.density).toBeLessThan(high.density);
		expect(low.fadeEnd).toBeLessThan(medium.fadeEnd);
		expect(medium.fadeEnd).toBeLessThan(high.fadeEnd);
	});

	test('streams one instanced grass mesh per chunk and hides distant chunks', () => {
		const world = new VoxelWorld('tall-grass-renderer');
		const chunk = { x: -2, z: -2 };
		world.loadChunk(chunk);
		const scene = new Scene();
		const renderer = new TallGrassRenderer(scene, resolveQualitySettings('medium'));

		renderer.replaceChunk(world, chunk);
		expect(renderer.chunkCount).toBe(1);
		expect(renderer.instanceCount).toBeGreaterThan(0);

		renderer.update(new Vector3(-24, 12, -24), 1 / 60, 0.4, 0.3);
		expect(renderer.visibleChunkCount).toBe(1);

		renderer.update(new Vector3(1000, 12, 1000), 1 / 60, 0.4, 0.3);
		expect(renderer.visibleChunkCount).toBe(0);

		renderer.removeChunk(chunk);
		expect(renderer.chunkCount).toBe(0);
		renderer.dispose();
		renderer.dispose();
	});
});

function collectPlacements(seed: number, zone: string): unknown[] {
	const placements: unknown[] = [];

	for (let x = -12; x <= 12; x += 1) {
		for (let z = -12; z <= 12; z += 1) {
			const placement = tallGrassPlacementAt(x, 9, z, zone, 0.78, seed);

			if (placement) {
				placements.push(placement);
			}
		}
	}

	return placements;
}
