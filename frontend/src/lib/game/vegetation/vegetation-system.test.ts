import { Scene, Vector3 } from 'three';
import { describe, expect, test } from 'vitest';

import {
	GroundFoliageRenderer,
	resolveGroundFoliageProfile
} from '../rendering/GroundFoliageRenderer';
import { resolveQualitySettings } from '../rendering/QualitySettings';
import { createLeafCanopyGeometry, leafCanopyShapeAt } from '../world/LeafCanopyGeometry';
import { TerrainGenerator } from '../world/TerrainGenerator';
import { VoxelWorld } from '../world/VoxelWorld';
import { allBiomeVegetationProfiles, biomeVegetationProfile } from './BiomeVegetationProfile';
import { createGroundFoliageGeometry } from './GroundFoliageGeometry';
import type { CanopyShape } from './VegetationFamily';
import {
	groundVegetationPlacementAt,
	selectTreeSpecies,
	vegetationSeedValue
} from './VegetationDistribution';
import { VegetationRegistry } from './VegetationRegistry';
import { generateTreeShape, treeShapeBounds } from './TreeShapeGenerator';

const CANOPY_SHAPES: readonly CanopyShape[] = [
	'round',
	'umbrella',
	'layered',
	'emergent',
	'frond',
	'drooping'
];

describe('production vegetation biodiversity', () => {
	test('registers several tree families and several ground layers', () => {
		expect(VegetationRegistry.allTrees().length).toBeGreaterThanOrEqual(6);
		expect(VegetationRegistry.allGround().length).toBeGreaterThanOrEqual(10);
		expect(new Set(VegetationRegistry.allTrees().map((species) => species.canopy)).size).toBe(6);
		expect(
			new Set(VegetationRegistry.allGround().map((species) => species.family)).size
		).toBeGreaterThanOrEqual(5);
	});

	test('gives every biome a distinct deterministic vegetation profile', () => {
		const profiles = allBiomeVegetationProfiles();
		const amazon = biomeVegetationProfile('Amazon Rainforest');
		const city = biomeVegetationProfile('Central City');
		const pine = biomeVegetationProfile('Pine Highlands');

		expect(profiles.length).toBeGreaterThanOrEqual(7);
		expect(amazon.treeDensity).toBeGreaterThan(city.treeDensity);
		expect(amazon.groundDensity).toBeGreaterThan(city.groundDensity);
		expect(amazon.trees.some((entry) => entry.id === 'kapok_emergent')).toBe(true);
		expect(pine.trees[0]?.id).toBe('pine_layered');
	});

	test('selects deterministic but diverse tree species in rainforest cells', () => {
		const seed = vegetationSeedValue('rainforest-diversity');
		const first: Array<string | null> = [];
		const second: Array<string | null> = [];

		for (let x = -18; x <= 18; x += 1) {
			for (let z = -18; z <= 18; z += 1) {
				first.push(selectTreeSpecies('Amazon Rainforest', x, z, seed));
				second.push(selectTreeSpecies('Amazon Rainforest', x, z, seed));
			}
		}

		const species = new Set(first.filter((value): value is string => value !== null));
		expect(first).toEqual(second);
		expect(species.size).toBeGreaterThanOrEqual(3);
	});

	test('builds genuinely different bounded silhouettes for every tree family', () => {
		const seed = vegetationSeedValue('tree-shapes');
		const signatures = new Set<string>();

		for (const species of VegetationRegistry.allTrees()) {
			const blocks = generateTreeShape(species.id, 0, 9, 0, seed);
			const bounds = treeShapeBounds(blocks);
			const width = bounds.maxX - bounds.minX + 1;
			const height = bounds.maxY - bounds.minY + 1;
			const depth = bounds.maxZ - bounds.minZ + 1;

			expect(blocks.some((block) => block.type === 'wood')).toBe(true);
			expect(blocks.some((block) => block.type === 'leaves')).toBe(true);
			expect(width).toBeGreaterThan(1);
			expect(height).toBeGreaterThanOrEqual(species.minHeight);
			expect(height).toBeLessThan(22);
			expect(depth).toBeGreaterThan(1);
			signatures.add(`${width}:${height}:${depth}:${blocks.length}`);
		}

		expect(signatures.size).toBeGreaterThanOrEqual(5);
	});

	test('generates multiple deterministic ground species instead of one grass model', () => {
		const seed = vegetationSeedValue('ground-diversity');
		const first: unknown[] = [];
		const second: unknown[] = [];
		const species = new Set<string>();
		const zones = ['Spawn Meadow', 'Forest Edge', 'Amazon Rainforest', 'Pine Highlands'];

		for (let zoneIndex = 0; zoneIndex < zones.length; zoneIndex += 1) {
			const zone = zones[zoneIndex];

			for (let x = -24; x <= 24; x += 1) {
				for (let z = -24; z <= 24; z += 1) {
					const a = groundVegetationPlacementAt(x, 9, z, zone, 1, seed + zoneIndex);
					const b = groundVegetationPlacementAt(x, 9, z, zone, 1, seed + zoneIndex);

					if (a) {
						first.push(a);
						species.add(a.speciesId);
					}

					if (b) {
						second.push(b);
					}
				}
			}
		}

		expect(first).toEqual(second);
		expect(species.size).toBeGreaterThanOrEqual(7);
	});

	test('creates six visibly distinct finite canopy geometries', () => {
		const signatures = new Set<string>();

		for (const shape of CANOPY_SHAPES) {
			const geometry = createLeafCanopyGeometry(shape);
			const positions = geometry.getAttribute('position');
			geometry.computeBoundingBox();
			const bounds = geometry.boundingBox!;
			const signature = [
				positions.count,
				(bounds.max.x - bounds.min.x).toFixed(2),
				(bounds.max.y - bounds.min.y).toFixed(2),
				(bounds.max.z - bounds.min.z).toFixed(2)
			].join(':');

			for (let index = 0; index < positions.count; index += 1) {
				expect(Number.isFinite(positions.getX(index))).toBe(true);
				expect(Number.isFinite(positions.getY(index))).toBe(true);
				expect(Number.isFinite(positions.getZ(index))).toBe(true);
			}

			signatures.add(signature);
			geometry.dispose();
		}

		expect(signatures.size).toBeGreaterThanOrEqual(5);
		expect(leafCanopyShapeAt({ x: -90, y: 18, z: 30 }, 'Amazon Rainforest')).toBe(
			leafCanopyShapeAt({ x: -90, y: 18, z: 30 }, 'Amazon Rainforest')
		);
	});

	test('creates finite ground geometries for grass fern shrub flower and moss', () => {
		for (const shape of [
			'short-grass',
			'fern',
			'tropical-fern',
			'shrub',
			'flower',
			'moss'
		] as const) {
			const geometry = createGroundFoliageGeometry(shape);
			const positions = geometry.getAttribute('position');

			expect(positions.count).toBeGreaterThan(2);

			for (let index = 0; index < positions.count; index += 1) {
				expect(Number.isFinite(positions.getX(index))).toBe(true);
				expect(Number.isFinite(positions.getY(index))).toBe(true);
				expect(Number.isFinite(positions.getZ(index))).toBe(true);
			}

			geometry.dispose();
		}
	});

	test('streams several instanced ground species and hides distant chunks', () => {
		const world = new VoxelWorld('biodiversity-renderer');
		const chunk = { x: -6, z: 2 };
		world.loadChunk(chunk);
		const scene = new Scene();
		const renderer = new GroundFoliageRenderer(scene, resolveQualitySettings('high'));

		renderer.replaceChunk(world, chunk);
		expect(renderer.chunkCount).toBe(1);
		expect(renderer.instanceCount).toBeGreaterThan(0);
		expect(renderer.meshCount).toBeGreaterThan(1);

		renderer.update(new Vector3(-88, 18, 40), 1 / 60, 0.5, 0.4);
		expect(renderer.visibleChunkCount).toBe(1);
		renderer.update(new Vector3(1000, 18, 1000), 1 / 60, 0.5, 0.4);
		expect(renderer.visibleChunkCount).toBe(0);
		renderer.dispose();
		renderer.dispose();
	});

	test('maps distant world regions to rainforest and pine biodiversity zones', () => {
		const generator = new TerrainGenerator('biome-zones');

		expect(generator.zoneAt(-90, 30)).toBe('Amazon Rainforest');
		expect(generator.zoneAt(0, 90)).toBe('Pine Highlands');
	});

	test('raises vegetation budgets with render quality', () => {
		const low = resolveGroundFoliageProfile(resolveQualitySettings('low'));
		const medium = resolveGroundFoliageProfile(resolveQualitySettings('medium'));
		const high = resolveGroundFoliageProfile(resolveQualitySettings('high'));

		expect(low.density).toBeLessThan(medium.density);
		expect(medium.density).toBeLessThan(high.density);
		expect(low.fadeEnd).toBeLessThan(medium.fadeEnd);
		expect(medium.fadeEnd).toBeLessThan(high.fadeEnd);
	});
});
