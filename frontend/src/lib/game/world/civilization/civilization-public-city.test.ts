import { describe, expect, test } from 'vitest';
import { Inventory } from '../../inventory/Inventory';
import { BlockRegistry } from '../BlockRegistry';
import { CityGenerator } from '../CityGenerator';
import { TerrainGenerator } from '../TerrainGenerator';
import { VoxelWorld } from '../VoxelWorld';
import { CENTRAL_CITY_CENTER, STARTER_WORLD_SEED, WORLD_SPAWN, worldToChunk } from '../voxel-types';
import { CivilizationInteractionSystem } from './CivilizationInteractionSystem';
import { civilizationGeometry } from './CivilizationGeometry';

function cityColumn(generator: CityGenerator, localX: number, localZ: number, groundY = 9) {
	return generator.generateForColumn(
		CENTRAL_CITY_CENTER.x + localX,
		groundY,
		CENTRAL_CITY_CENTER.z + localZ
	);
}

describe('public civilization kit', () => {
	test('registers road, commercial, street and pool fixtures as real build pieces', () => {
		expect(BlockRegistry.get('asphalt')).toMatchObject({
			placeable: true,
			category: 'construction'
		});
		expect(BlockRegistry.get('street_lamp')).toMatchObject({
			interaction: 'lamp',
			shape: 'street-lamp'
		});
		expect(BlockRegistry.get('store_shelf')).toMatchObject({
			interaction: 'container',
			shape: 'store-shelf'
		});
		expect(BlockRegistry.get('glass_door')).toMatchObject({
			interaction: 'door',
			transparent: true
		});
		expect(BlockRegistry.get('pool_ladder').shape).toBe('pool-ladder');
	});

	test('lays a real road surface with markings and sidewalks in the native city', () => {
		const city = new CityGenerator();
		expect(cityColumn(city, 0, 18).some((block) => block.type === 'asphalt')).toBe(true);
		expect(cityColumn(city, 0, 20).some((block) => block.type === 'road_marking')).toBe(true);
		expect(cityColumn(city, 4, 18).some((block) => block.type === 'sidewalk')).toBe(true);
	});

	test('builds a stocked supermarket interior instead of an empty shell', () => {
		const city = new CityGenerator();
		const blockTypes = new Set<string>();
		for (let dx = -7; dx <= 7; dx += 1) {
			for (let dz = -5; dz <= 5; dz += 1) {
				for (const block of cityColumn(city, -21 + dx, 16 + dz)) blockTypes.add(block.type);
			}
		}
		for (const expected of [
			'store_shelf',
			'produce_crate',
			'drink_cooler',
			'checkout_counter',
			'shopping_cart'
		]) {
			expect(blockTypes.has(expected)).toBe(true);
		}
	});

	test('opens glass shop doors on approach and closes them after the player passes', () => {
		const world = new VoxelWorld('automatic-glass-door');
		world.loadChunk({ x: 0, z: 0 });
		const position = { x: 2, y: 20, z: 2 };
		world.setBlock(position, 'glass_door', true, { facing: 'north', open: false });
		const interactions = new CivilizationInteractionSystem(world);

		expect(interactions.updateAutomaticDoors({ x: 2.5, y: 20, z: 3.8 })).toContainEqual(position);
		expect(world.getLoadedBlock(position)?.state?.open).toBe(true);
		expect(world.getLoadedBlock(position)?.passable).toBe(true);

		expect(interactions.updateAutomaticDoors({ x: 2.5, y: 20, z: 6 })).toContainEqual(position);
		expect(world.getLoadedBlock(position)?.state?.open).toBe(false);
		expect(world.getLoadedBlock(position)?.passable).toBe(false);
	});

	test('opens a wooden door when the player actively walks into it and still supports nearby E use', () => {
		const world = new VoxelWorld('push-door');
		world.loadChunk({ x: 0, z: 0 });
		const position = { x: 2, y: 20, z: 2 };
		world.setBlock(position, 'wooden_door', true, { facing: 'north', open: false });
		const interactions = new CivilizationInteractionSystem(world);

		expect(
			interactions.updateAutomaticDoors(
				{ x: 2.5, y: 20, z: 3.45 },
				{ moving: true, directionX: 0, directionZ: -1 }
			)
		).toContainEqual(position);
		expect(world.getLoadedBlock(position)?.state?.open).toBe(true);

		world.updateBlockState(position, { open: false });
		expect(interactions.interactNearestDoor({ x: 2.5, y: 20, z: 3.3 })).toMatchObject({
			handled: true,
			worldChanged: true,
			position
		});
		expect(world.getLoadedBlock(position)?.state?.open).toBe(true);
	});

	test('gives tall standing fixtures real collision instead of letting the player phase through them', () => {
		for (const type of ['floor_lamp', 'street_lamp', 'clothes_rack', 'shopping_cart'] as const) {
			const block = BlockRegistry.create(type, { x: 0, y: 0, z: 0 });
			expect(BlockRegistry.collisionBox(block)).not.toBeNull();
			expect(block.solid).toBe(false);
		}
	});

	test('uses an unobstructed adjacent double-door entrance for the supermarket', () => {
		const city = new CityGenerator();
		const left = cityColumn(city, -21, 22).filter((block) => block.position.y === 10);
		const right = cityColumn(city, -20, 22).filter((block) => block.position.y === 10);
		expect(left.some((block) => block.type === 'glass_door')).toBe(true);
		expect(right.some((block) => block.type === 'glass_door')).toBe(true);
	});

	test('store shelves dispense finite inventory using the existing container system', () => {
		const world = new VoxelWorld('public-store');
		world.loadChunk({ x: 0, z: 0 });
		const inventory = new Inventory();
		const position = { x: 2, y: 20, z: 2 };
		world.setBlock(position, 'store_shelf');
		const interaction = new CivilizationInteractionSystem(world, inventory);
		const result = interaction.interact(position);
		expect(result).toMatchObject({ handled: true, itemAdded: 'rice_meal' });
		expect(world.getLoadedBlock(position)?.state?.stock).toBe(7);
	});
});

test('protects native-city parcels from player griefing while keeping interactions stateful', () => {
	const world = new VoxelWorld(STARTER_WORLD_SEED);
	const door = { x: CENTRAL_CITY_CENTER.x, y: 10, z: CENTRAL_CITY_CENTER.z + 5 };
	world.loadChunk(worldToChunk(door));
	expect(world.getLoadedBlock(door)?.type).toBe('glass_door');
	expect(world.isProtectedBuildPosition(door)).toBe(true);
	expect(world.removeBlock(door)).toBeNull();
	expect(world.setBlock({ x: door.x, y: 40, z: door.z }, 'brick')).toBe(false);

	const interactions = new CivilizationInteractionSystem(world);
	expect(interactions.interact(door)).toMatchObject({ handled: true, worldChanged: true });
	expect(world.getLoadedBlock(door)?.state?.open).toBe(true);

	const saved = world.exportModifications();
	const restored = new VoxelWorld(STARTER_WORLD_SEED);
	restored.loadChunk(worldToChunk(door));
	restored.loadModifications(saved);
	expect(restored.getLoadedBlock(door)?.state?.open).toBe(true);
});

test('keeps generated tree wood and leaves out of every reserved native-city column', () => {
	const terrain = new TerrainGenerator(STARTER_WORLD_SEED);
	const city = new CityGenerator();
	for (let chunkX = -3; chunkX <= 2; chunkX += 1) {
		for (let chunkZ = -5; chunkZ <= 1; chunkZ += 1) {
			for (const block of terrain.generateChunk(chunkX, chunkZ).blocks) {
				if (block.type !== 'wood' && block.type !== 'leaves') continue;
				expect(city.isProtectedColumn(block.position.x, block.position.z)).toBe(false);
			}
		}
	}
});

test('renders supermarket fixtures with visible product colors instead of empty monochrome shelves', () => {
	for (const shape of ['store-shelf', 'produce-crate', 'drink-cooler'] as const) {
		const geometry = civilizationGeometry(shape);
		expect(geometry).not.toBeNull();
		const colors = geometry?.getAttribute('color');
		expect(colors).toBeDefined();
		const unique = new Set<string>();
		if (colors) {
			for (
				let index = 0;
				index < colors.count;
				index += Math.max(1, Math.floor(colors.count / 32))
			) {
				unique.add(
					`${colors.getX(index).toFixed(3)},${colors.getY(index).toFixed(3)},${colors.getZ(index).toFixed(3)}`
				);
			}
		}
		expect(unique.size).toBeGreaterThan(1);
	}
});

test('never places public lamps inside building footprints or entrance clearance lanes', () => {
	const city = new CityGenerator();
	const entrances = [
		{ x: 0, z: 5 },
		{ x: 0, z: 15 },
		{ x: -21, z: 22 },
		{ x: -20, z: 22 },
		{ x: 20, z: 21 }
	];
	for (const entrance of entrances) {
		for (let dz = 0; dz <= 2; dz += 1) {
			for (let dx = -1; dx <= 1; dx += 1) {
				const blocks = cityColumn(city, entrance.x + dx, entrance.z + dz);
				expect(blocks.some((block) => block.type === 'street_lamp')).toBe(false);
			}
		}
	}
});

describe('native city public district', () => {
	test('keeps the city close to landing while expanding a flattened urban district', () => {
		const terrain = new TerrainGenerator(STARTER_WORLD_SEED);
		expect(
			Math.hypot(CENTRAL_CITY_CENTER.x - WORLD_SPAWN.x, CENTRAL_CITY_CENTER.z - WORLD_SPAWN.z)
		).toBeLessThan(40);
		expect(terrain.zoneAt(CENTRAL_CITY_CENTER.x + 40, CENTRAL_CITY_CENTER.z)).toBe('Central City');
		expect(terrain.heightAt(CENTRAL_CITY_CENTER.x + 20, CENTRAL_CITY_CENTER.z + 20)).toBe(9);
	});

	test('creates a two-metre-deep generated swimming pool with real water blocks', () => {
		const city = new CityGenerator();
		const terrain = new TerrainGenerator(STARTER_WORLD_SEED);
		const x = CENTRAL_CITY_CENTER.x + 23;
		const z = CENTRAL_CITY_CENTER.z - 20;
		const floorY = terrain.heightAt(x, z);
		expect(floorY).toBe(7);
		const blocks = city.generateForColumn(x, floorY, z);
		expect(blocks).toContainEqual({ position: { x, y: 7, z }, type: 'pool_tile' });
		expect(blocks).toContainEqual({ position: { x, y: 8, z }, type: 'water' });
		expect(blocks).toContainEqual({ position: { x, y: 9, z }, type: 'water' });
		expect(worldToChunk({ x, z }).z).toBeLessThan(worldToChunk(WORLD_SPAWN).z);
	});
});
