import { describe, expect, test } from 'vitest';
import { Inventory } from '../../inventory/Inventory';
import { ItemRegistry } from '../../inventory/ItemRegistry';
import { BlockRegistry } from '../BlockRegistry';
import { TerrainGenerator } from '../TerrainGenerator';
import { VoxelWorld } from '../VoxelWorld';
import { CENTRAL_CITY_CENTER, STARTER_WORLD_SEED, WORLD_SPAWN, worldToChunk } from '../voxel-types';
import { CivilizationInteractionSystem } from './CivilizationInteractionSystem';
import { nativeCityAnchorFromLanding, nativeCityIsNearLanding } from './NativeCityAnchor';

describe('civilization interior kit', () => {
	test('registers recognizable domestic fixtures instead of generic cubes', () => {
		expect(BlockRegistry.get('chair')).toMatchObject({ shape: 'chair', placeable: true });
		expect(BlockRegistry.get('sofa')).toMatchObject({ shape: 'sofa', placeable: true });
		expect(BlockRegistry.get('refrigerator')).toMatchObject({
			shape: 'refrigerator',
			interaction: 'container'
		});
		expect(BlockRegistry.get('sink')).toMatchObject({ interaction: 'water' });
		expect(BlockRegistry.get('shower')).toMatchObject({ interaction: 'shower' });
		expect(BlockRegistry.get('radio')).toMatchObject({ interaction: 'radio' });
		expect(BlockRegistry.get('cooking_pot').shape).toBe('cooking-pot');
	});

	test('opens a refrigerator, transfers food to inventory and persists stock', () => {
		const world = new VoxelWorld('interior-fridge');
		world.loadChunk({ x: 0, z: 0 });
		const inventory = new Inventory();
		const position = { x: 2, y: 20, z: 2 };
		world.setBlock(position, 'refrigerator');
		const interactions = new CivilizationInteractionSystem(world, inventory);

		const opened = interactions.interact(position);
		expect(opened).toMatchObject({ handled: true, worldChanged: true, itemAdded: 'fresh_fruit' });
		expect(world.getLoadedBlock(position)?.state).toMatchObject({ open: true, stock: 5 });
		expect(inventory.allSlots.some((slot) => slot.stack?.type === 'fresh_fruit')).toBe(true);

		interactions.interact(position); // close
		const reopened = interactions.interact(position);
		expect(reopened.itemAdded).toBe('bottled_water');
		expect(world.getLoadedBlock(position)?.state?.stock).toBe(4);

		const snapshot = world.exportModifications();
		const restored = new VoxelWorld('interior-fridge');
		restored.loadChunk({ x: 0, z: 0 });
		restored.loadModifications(snapshot);
		expect(restored.getLoadedBlock(position)?.state).toMatchObject({ open: true, stock: 4 });
	});

	test('provides working tap, shower, radio and finite food interactions', () => {
		const world = new VoxelWorld('interior-fixtures');
		world.loadChunk({ x: 0, z: 0 });
		const interactions = new CivilizationInteractionSystem(world, new Inventory());
		const sink = { x: 1, y: 20, z: 1 };
		const shower = { x: 2, y: 20, z: 1 };
		const radio = { x: 3, y: 20, z: 1 };
		const fruit = { x: 4, y: 20, z: 1 };
		world.setBlock(sink, 'sink');
		world.setBlock(shower, 'shower');
		world.setBlock(radio, 'radio');
		world.setBlock(fruit, 'fruit_bowl');

		expect(interactions.interact(sink)).toMatchObject({ action: 'drink', hydration: 18 });
		expect(world.getLoadedBlock(sink)?.state?.running).toBe(true);
		expect(interactions.interact(shower)).toMatchObject({ action: 'wash' });
		expect(interactions.interact(radio)).toMatchObject({ action: 'radio', active: true });
		expect(BlockRegistry.isLit(world.getLoadedBlock(radio)!)).toBe(true);
		expect(interactions.interact(fruit)).toMatchObject({ action: 'eat', nutrition: 10 });
		expect(world.getLoadedBlock(fruit)?.state?.stock).toBe(4);
	});

	test('keeps food as inventory items rather than construction blocks', () => {
		for (const type of ['bread_loaf', 'fresh_fruit', 'rice_meal', 'bottled_water'] as const) {
			expect(BlockRegistry.get(type).placeable).toBe(false);
			expect(ItemRegistry.get(type).consumable).not.toBeNull();
		}
		expect(ItemRegistry.get('fresh_fruit').consumable).toMatchObject({
			nutrition: 11,
			hydration: 3
		});
		expect(ItemRegistry.get('bottled_water').consumable).toMatchObject({ hydration: 24 });
	});
});

describe('native city landing anchor', () => {
	test('keeps the native city close enough to the landing meadow to appear immediately', () => {
		const anchor = nativeCityAnchorFromLanding(WORLD_SPAWN);
		expect(anchor).toMatchObject(CENTRAL_CITY_CENTER);
		expect(anchor.distanceFromLanding).toBeLessThan(48);
		expect(nativeCityIsNearLanding(WORLD_SPAWN)).toBe(true);
		const landingChunk = worldToChunk(WORLD_SPAWN);
		const cityChunk = worldToChunk(anchor);
		expect(Math.abs(cityChunk.x - landingChunk.x)).toBeLessThanOrEqual(2);
		expect(Math.abs(cityChunk.z - landingChunk.z)).toBeLessThanOrEqual(2);
	});

	test('generates a hollow multi-storey facade and furnished show-home near the anchor', () => {
		const generator = new TerrainGenerator(STARTER_WORLD_SEED);
		const chunkZ = Math.floor(CENTRAL_CITY_CENTER.z / 16);
		const blocks = [
			generator.generateChunk(-1, chunkZ),
			generator.generateChunk(0, chunkZ)
		].flatMap((chunk) => chunk.blocks);
		const types = new Set(blocks.map((block) => block.type));
		const highestCityBlock = Math.max(...blocks.map((block) => block.position.y));
		expect(highestCityBlock).toBeGreaterThanOrEqual(30);
		expect(types.has('concrete')).toBe(true);
		expect(types.has('glass')).toBe(true);
		expect(types.has('wooden_door')).toBe(true);
		expect(types.has('refrigerator')).toBe(true);
		expect(types.has('sink')).toBe(true);
		expect(types.has('radio')).toBe(true);
	});
});
