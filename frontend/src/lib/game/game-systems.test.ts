import { afterEach, describe, expect, test, vi } from 'vitest';

import { GameLoop } from './GameLoop';
import { GamePersistence } from './persistence/GamePersistence';
import {
	DEFAULT_CHARACTER_APPEARANCE,
	parseCharacterAppearance,
	serializeCharacterAppearance
} from './character/CharacterAppearance';
import { BlockPlacementSystem } from './interaction/BlockPlacementSystem';
import { Hotbar } from './inventory/Hotbar';
import { Inventory } from './inventory/Inventory';
import { KeyboardInput } from './input/KeyboardInput';
import { PlayerController } from './player/PlayerController';
import {
	SPRINT_SPEED,
	WALK_SPEED,
	cameraRelativeMovement,
	PlayerPhysics
} from './player/PlayerPhysics';
import {
	MAX_CAMERA_DISTANCE,
	MAX_CAMERA_PITCH,
	MIN_CAMERA_DISTANCE,
	MIN_CAMERA_PITCH,
	ThirdPersonCamera
} from './player/ThirdPersonCamera';
import { BlockRegistry } from './world/BlockRegistry';
import { TerrainGenerator } from './world/TerrainGenerator';
import { VoxelWorld } from './world/VoxelWorld';
import { parseWorldSave, serializeWorldSave, type WorldSaveV1 } from './world/WorldSave';
import {
	CENTRAL_CITY_CENTER,
	STARTER_WORLD_SEED,
	chunkToWorld,
	worldToChunk
} from './world/voxel-types';

describe('voxel world coordinates', () => {
	test('converts world coordinates to chunk coordinates', () => {
		expect(worldToChunk({ x: 0, z: 0 })).toEqual({ x: 0, z: 0 });
		expect(worldToChunk({ x: 16, z: -1 })).toEqual({ x: 1, z: -1 });
		expect(worldToChunk({ x: -1, z: -17 })).toEqual({ x: -1, z: -2 });
	});

	test('converts chunk coordinates to world origins', () => {
		expect(chunkToWorld({ x: 2, z: -3 })).toEqual({ x: 32, y: 0, z: -48 });
	});
});

describe('game loop performance guards', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	test('starts only one requestAnimationFrame loop and stop cancels it', () => {
		let nextFrame = 0;
		const requested: number[] = [];
		const cancelled: number[] = [];
		const loop = new GameLoop({
			update: () => undefined,
			render: () => undefined
		});

		vi.stubGlobal('requestAnimationFrame', () => {
			const frame = ++nextFrame;
			requested.push(frame);

			return frame;
		});
		vi.stubGlobal('cancelAnimationFrame', (frame: number) => {
			cancelled.push(frame);
		});

		loop.start();
		loop.start();

		expect(requested).toEqual([1]);
		expect(loop.isRunning).toBe(true);

		loop.stop();
		loop.stop();

		expect(cancelled).toEqual([1]);
		expect(loop.isRunning).toBe(false);
	});
});

describe('terrain generation', () => {
	test('is deterministic for a seed', () => {
		const first = new TerrainGenerator(STARTER_WORLD_SEED);
		const second = new TerrainGenerator(STARTER_WORLD_SEED);

		expect(first.heightAt(12, -7)).toBe(second.heightAt(12, -7));
		expect(first.generateChunk(0, 0).blocks.slice(0, 20)).toEqual(
			second.generateChunk(0, 0).blocks.slice(0, 20)
		);
	});

	test('generates a deterministic open spawn meadow', () => {
		const generator = new TerrainGenerator(STARTER_WORLD_SEED);

		expect(generator.heightAt(0, 0)).toBe(9);
		expect(generator.zoneAt(0, 0)).toBe('Spawn Meadow');
		expect(generator.zoneAt(24, 0)).toBe('Riverbank');
	});

	test('places the central city and a path in the expected direction', () => {
		const generator = new TerrainGenerator(STARTER_WORLD_SEED);

		expect(generator.zoneAt(CENTRAL_CITY_CENTER.x, CENTRAL_CITY_CENTER.z)).toBe('Central City');
		expect(generator.isPath(0, -40)).toBe(true);

		const cityBlocks = generator
			.generateChunk(0, Math.floor(CENTRAL_CITY_CENTER.z / 16))
			.blocks.filter((block) => block.type === 'brick' || block.type === 'wooden_plank');

		expect(cityBlocks.length).toBeGreaterThan(20);
	});
});

describe('block registry and world mutations', () => {
	test('exposes stable block definitions', () => {
		expect(BlockRegistry.get('grass')).toMatchObject({
			type: 'grass',
			solid: true,
			collectable: true
		});
		expect(BlockRegistry.get('water')).toMatchObject({
			passable: true,
			transparent: true
		});
	});

	test('adds and removes a block', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);

		expect(world.setBlock({ x: 4, y: 20, z: 4 }, 'brick')).toBe(true);
		expect(world.getBlock({ x: 4, y: 20, z: 4 }).type).toBe('brick');
		expect(world.removeBlock({ x: 4, y: 20, z: 4 })).toBe('brick');
		expect(world.getBlock({ x: 4, y: 20, z: 4 }).type).toBe('air');
	});

	test('applies placed and removed block snapshots', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		world.setBlock({ x: 5, y: 20, z: 5 }, 'glass');
		world.removeBlock({ x: 5, y: 20, z: 5 });

		const restored = new VoxelWorld(STARTER_WORLD_SEED);
		restored.loadModifications(world.exportModifications());

		expect(restored.getBlock({ x: 5, y: 20, z: 5 }).type).toBe('air');
	});

	test('keeps loaded chunks and visible generated blocks bounded while moving', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);

		expect(world.ensureChunksAround({ x: 0, z: 0 }, 1)).toBe(true);
		expect(world.getLoadedChunks()).toHaveLength(9);
		const firstVisible = world.getVisibleBlocks();

		expect(firstVisible.length).toBeGreaterThan(0);
		expect(world.ensureChunksAround({ x: 96, z: 0 }, 1)).toBe(true);
		expect(world.getLoadedChunks()).toHaveLength(9);
		expect(world.getVisibleBlocks().some((block) => block.position.x < 16)).toBe(false);
		expect(world.getVisibleBlocks().length).toBeLessThan(firstVisible.length * 2);
	});

	test('player and camera collision queries do not generate new chunks', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const spawn = world.findSafeSpawnPosition();
		const player = testPlayer(world, {
			position: { ...spawn, x: Math.floor(spawn.x / 16) * 16 + 15.75 }
		});
		const camera = new ThirdPersonCamera(1, world);

		world.ensureChunksAround(spawn, 0);
		const loadedBefore = world.getLoadedChunks().length;
		camera.setOrientation(Math.PI / 2, 0.34);
		camera.update(player);
		const physics = new PlayerPhysics(world);
		physics.step(player, move(0, 1), 1 / 60);

		expect(world.getLoadedChunks()).toHaveLength(loadedBefore);
	});

	test('returns a safe spawn and repairs invalid restore positions', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const spawn = world.spawnPosition();

		expect(world.isSolidAt({ x: spawn.x, y: spawn.y, z: spawn.z })).toBe(false);
		expect(world.isSolidAt({ x: spawn.x + 1, y: spawn.y, z: spawn.z })).toBe(false);
		expect(world.safeRestorePosition({ x: 0, y: -50, z: 0 })).toEqual(spawn);
	});
});

describe('player physics', () => {
	test('normalizes diagonal movement input', () => {
		const windowTarget = new FakeWindow();
		const input = new KeyboardInput(windowTarget as unknown as Window);

		windowTarget.press('KeyW');
		windowTarget.press('KeyD');

		const movement = input.getMovement();

		expect(Math.hypot(movement.forward, movement.right)).toBeCloseTo(1);
		input.destroy();
	});

	test('toggles build mode through keyboard commands', () => {
		const windowTarget = new FakeWindow();
		const input = new KeyboardInput(windowTarget as unknown as Window);

		windowTarget.press('KeyB');

		expect(input.consumeCommands()).toMatchObject({
			build: true
		});
		input.destroy();
	});

	test('detects ground and prevents falling through solid blocks', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const player = {
			playerId: 'p',
			worldId: 'w',
			position: { x: 0.5, y: world.terrainGenerator.heightAt(0, 0) + 1.02, z: 0.5 },
			velocity: { x: 0, y: -1, z: 0 },
			yaw: 0,
			pitch: 0,
			onGround: false,
			height: 1.78,
			radius: 0.32
		};
		const physics = new PlayerPhysics(world);

		for (let step = 0; step < 120; step += 1) {
			physics.step(player, { forward: 0, right: 0, jump: false, sprint: false }, 1 / 60);
		}

		expect(player.onGround).toBe(true);
		expect(player.position.y).toBeGreaterThan(world.terrainGenerator.heightAt(0, 0));
	});

	test('jumps only from the ground', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const height = world.terrainGenerator.heightAt(0, 0);
		const player = {
			playerId: 'p',
			worldId: 'w',
			position: { x: 0.5, y: height + 1.02, z: 0.5 },
			velocity: { x: 0, y: 0, z: 0 },
			yaw: 0,
			pitch: 0,
			onGround: true,
			height: 1.78,
			radius: 0.32
		};
		const physics = new PlayerPhysics(world);

		physics.step(player, { forward: 0, right: 0, jump: true, sprint: false }, 1 / 60);

		expect(player.velocity.y).toBeGreaterThan(0);
	});

	test('moves relative to the camera yaw', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const controller = new PlayerController(world, 'p', 'w', world.spawnPosition(), 1);
		controller.camera.setOrientation(Math.PI, 0.34);
		const startZ = controller.state.position.z;

		controller.step({ forward: 1, right: 0, jump: false, sprint: false }, 1 / 60);

		expect(controller.state.position.z).toBeLessThan(startZ);
	});

	test('computes left and right from the horizontal camera yaw', () => {
		expect(cameraRelativeMovement(Math.PI, move(0, 1))).toMatchObject({
			x: expect.closeTo(1),
			z: expect.closeTo(0)
		});
		expect(cameraRelativeMovement(Math.PI, move(0, -1))).toMatchObject({
			x: expect.closeTo(-1),
			z: expect.closeTo(0)
		});
		expect(cameraRelativeMovement(0, move(0, 1))).toMatchObject({
			x: expect.closeTo(-1),
			z: expect.closeTo(0)
		});
		expect(cameraRelativeMovement(Math.PI / 2, move(0, 1))).toMatchObject({
			x: expect.closeTo(0),
			z: expect.closeTo(1)
		});
		expect(cameraRelativeMovement(-Math.PI / 2, move(0, 1))).toMatchObject({
			x: expect.closeTo(0),
			z: expect.closeTo(-1)
		});
	});

	test('keeps diagonal movement normalized for arbitrary camera yaw', () => {
		const direction = cameraRelativeMovement(0.7, move(1, 1));

		expect(Math.hypot(direction.x, direction.z)).toBeCloseTo(1);
		expect(Math.abs(direction.x)).toBeGreaterThan(0.05);
		expect(Math.abs(direction.z)).toBeGreaterThan(0.05);
	});

	test('accelerates, sprints and decelerates in seconds', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const player = testPlayer(world);
		const physics = new PlayerPhysics(world);

		physics.step(player, move(1, 0), 1 / 60);
		expect(Math.hypot(player.velocity.x, player.velocity.z)).toBeGreaterThan(0);
		expect(Math.hypot(player.velocity.x, player.velocity.z)).toBeLessThan(WALK_SPEED);

		for (let index = 0; index < 60; index += 1) {
			physics.step(player, move(1, 0, false, true), 1 / 60);
		}

		expect(Math.hypot(player.velocity.x, player.velocity.z)).toBeCloseTo(SPRINT_SPEED, 1);

		for (let index = 0; index < 60; index += 1) {
			physics.step(player, move(0, 0), 1 / 60);
		}

		expect(Math.hypot(player.velocity.x, player.velocity.z)).toBeLessThan(0.2);
	});

	test('keeps movement distance comparable at 30, 60 and 120 FPS', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const distances = [30, 60, 120].map((fps) => {
			const player = testPlayer(world);
			const physics = new PlayerPhysics(world);

			for (let index = 0; index < fps; index += 1) {
				physics.step(player, move(1, 0), 1 / fps);
			}

			return Math.hypot(player.position.x - 0.5, player.position.z - 0.5);
		});

		expect(distances[0]).toBeCloseTo(distances[1], 0);
		expect(distances[2]).toBeCloseTo(distances[1], 0);
	});

	test('validates safe spawn and repairs invalid restore positions', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const spawn = world.findSafeSpawnPosition();

		expect(world.validatePlayerPosition(spawn)).toBe(true);
		world.setBlock(
			{ x: Math.floor(spawn.x), y: Math.floor(spawn.y), z: Math.floor(spawn.z) },
			'brick'
		);

		expect(world.validatePlayerPosition(spawn)).toBe(false);
		expect(world.safeRestorePosition(spawn)).not.toEqual(spawn);
	});

	test('steps up one block but refuses a two-block wall', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const spawn = world.findSafeSpawnPosition();
		const player = testPlayer(world, {
			position: { ...spawn },
			yaw: Math.PI / 2
		});
		const physics = new PlayerPhysics(world);
		const obstacleX = Math.floor(spawn.x + 1);
		const obstacleZ = Math.floor(spawn.z);
		const baseY = Math.floor(spawn.y);

		world.setBlock({ x: obstacleX, y: baseY, z: obstacleZ }, 'brick');
		for (let index = 0; index < 24; index += 1) {
			physics.step(player, move(1, 0), 1 / 60);
		}

		expect(player.position.y).toBeGreaterThan(spawn.y + 0.5);

		const wallPlayer = testPlayer(world, {
			position: { ...spawn },
			yaw: Math.PI / 2
		});
		world.setBlock({ x: obstacleX, y: baseY + 1, z: obstacleZ }, 'brick');
		for (let index = 0; index < 24; index += 1) {
			physics.step(wallPlayer, move(1, 0), 1 / 60);
		}

		expect(wallPlayer.position.x).toBeLessThan(obstacleX);
	});

	test('does not step up while airborne or into a low ceiling', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const spawn = world.findSafeSpawnPosition();
		const obstacleX = Math.floor(spawn.x + 1);
		const obstacleZ = Math.floor(spawn.z);
		const baseY = Math.floor(spawn.y);
		const physics = new PlayerPhysics(world);

		world.setBlock({ x: obstacleX, y: baseY, z: obstacleZ }, 'brick');
		world.setBlock({ x: obstacleX, y: baseY + 2, z: obstacleZ }, 'brick');

		const ceilingPlayer = testPlayer(world, {
			position: { ...spawn },
			yaw: Math.PI / 2
		});
		for (let index = 0; index < 24; index += 1) {
			physics.step(ceilingPlayer, move(1, 0), 1 / 60);
		}
		expect(ceilingPlayer.position.x).toBeLessThan(obstacleX);

		const airPlayer = testPlayer(world, {
			position: { ...spawn, y: spawn.y + 2 },
			yaw: Math.PI / 2,
			onGround: false
		});
		physics.step(airPlayer, move(1, 0), 1 / 60);
		expect(airPlayer.position.y).toBeGreaterThan(spawn.y + 1);
	});

	test('camera clamps pitch, zoom and avoids terrain obstacles', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const camera = new ThirdPersonCamera(1, world);
		const player = testPlayer(world);

		camera.setOrientation(0, -10);
		expect(camera.orientationPitch).toBe(MIN_CAMERA_PITCH);
		camera.setOrientation(0, 10);
		expect(camera.orientationPitch).toBe(MAX_CAMERA_PITCH);
		camera.applyZoom(100_000);
		expect(camera.orbitDistance).toBe(MAX_CAMERA_DISTANCE);
		camera.applyZoom(-100_000);
		expect(camera.orbitDistance).toBe(MIN_CAMERA_DISTANCE);

		camera.setOrientation(Math.PI, 0.34);
		camera.update(player);
		expect(camera.camera.position.y).toBeGreaterThan(
			world.terrainGenerator.heightAt(camera.camera.position.x, camera.camera.position.z)
		);
	});

	test('camera shortens before an obstacle behind the player', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const player = testPlayer(world);
		const camera = new ThirdPersonCamera(1, world);
		const wallZ = Math.floor(player.position.z - 3);
		const wallX = Math.floor(player.position.x);

		for (let y = Math.floor(player.position.y); y <= Math.floor(player.position.y + 3); y += 1) {
			world.setBlock({ x: wallX, y, z: wallZ }, 'brick');
		}

		camera.setOrientation(0, 0.2);
		camera.update(player);

		expect(camera.currentDistance).toBeLessThan(camera.orbitDistance);
	});
});

describe('inventory and placement', () => {
	test('selects hotbar slots', () => {
		const hotbar = new Hotbar();

		expect(hotbar.select(4)).toBe(4);
		expect(hotbar.next(1)).toBe(5);
		expect(hotbar.next(-1)).toBe(4);
	});

	test('adds and removes items', () => {
		const inventory = new Inventory();

		expect(inventory.addItem('brick', 3)).toBe(true);
		expect(inventory.removeItem('brick', 2)).toBe(true);
		expect(inventory.getSelectedStack(1)?.quantity).toBe(33);
	});

	test('does not place a block inside the player', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const controller = new PlayerController(world, 'p', 'w', { x: 10.5, y: 20, z: 10.5 }, 1);
		const inventory = new Inventory();
		const system = new BlockPlacementSystem(
			world,
			inventory,
			controller.state,
			controller.physics.collider,
			() => undefined
		);

		const placed = system.place(
			{
				block: { x: 10, y: 19, z: 10 },
				normal: { x: 0, y: 1, z: 0 },
				type: 'stone'
			},
			'brick'
		);

		expect(placed).toBe(false);
	});
});

describe('world saves', () => {
	test('serializes WorldSaveV1', () => {
		const save: WorldSaveV1 = {
			version: 1,
			worldId: 'starter-world',
			seed: STARTER_WORLD_SEED,
			player: {
				playerId: 'p',
				worldId: 'starter-world',
				position: { x: 1, y: 2, z: 3 },
				yaw: 0,
				pitch: 0
			},
			inventory: new Inventory().snapshot(),
			placedBlocks: [{ position: { x: 1, y: 2, z: 3 }, type: 'brick' }],
			removedBlocks: [{ x: 2, y: 3, z: 4 }],
			changes: [],
			updatedAt: 1
		};

		expect(parseWorldSave(serializeWorldSave(save))).toEqual(save);
	});

	test('serializes character appearance', () => {
		expect(
			parseCharacterAppearance(serializeCharacterAppearance(DEFAULT_CHARACTER_APPEARANCE))
		).toEqual(DEFAULT_CHARACTER_APPEARANCE);
	});

	test('serializes WorldSaveV2 with character appearance', () => {
		const save = {
			version: 2 as const,
			worldId: 'orelunza-world',
			seed: STARTER_WORLD_SEED,
			player: {
				playerId: 'p',
				worldId: 'orelunza-world',
				position: { x: 1, y: 12, z: 3 },
				yaw: Math.PI,
				pitch: 0.34
			},
			character: DEFAULT_CHARACTER_APPEARANCE,
			inventory: new Inventory().snapshot(),
			placedBlocks: [],
			removedBlocks: [],
			changes: [],
			updatedAt: 2
		};

		expect(parseWorldSave(serializeWorldSave(save))).toEqual(save);
	});

	test('does not save when nothing changed', async () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const player = new PlayerController(world, 'p', 'starter-world', { x: 0.5, y: 12, z: 0.5 }, 1);
		const inventory = new Inventory();
		const persistence = new GamePersistence(
			'starter-world',
			STARTER_WORLD_SEED,
			world,
			player,
			inventory,
			DEFAULT_CHARACTER_APPEARANCE,
			() => undefined
		);

		await expect(persistence.save(false)).resolves.toBe(false);
	});
});

function move(forward: number, right: number, jump = false, sprint = false) {
	return {
		forward,
		right,
		jump,
		sprint
	};
}

function testPlayer(
	world: VoxelWorld,
	overrides: Partial<ReturnType<typeof baseTestPlayer>> = {}
): ReturnType<typeof baseTestPlayer> {
	return {
		...baseTestPlayer(world),
		...overrides
	};
}

function baseTestPlayer(world: VoxelWorld) {
	return {
		playerId: 'p',
		worldId: 'w',
		position: world.findSafeSpawnPosition(),
		velocity: { x: 0, y: 0, z: 0 },
		yaw: Math.PI,
		pitch: 0,
		onGround: true,
		height: 1.78,
		radius: 0.32
	};
}

class FakeWindow {
	private readonly listeners = new Map<string, Set<(event: KeyboardEvent) => void>>();

	addEventListener(type: string, listener: (event: KeyboardEvent) => void): void {
		const listeners = this.listeners.get(type) ?? new Set<(event: KeyboardEvent) => void>();
		listeners.add(listener);
		this.listeners.set(type, listeners);
	}

	removeEventListener(type: string, listener: (event: KeyboardEvent) => void): void {
		this.listeners.get(type)?.delete(listener);
	}

	press(code: string): void {
		this.dispatch('keydown', { code } as KeyboardEvent);
	}

	private dispatch(type: string, event: KeyboardEvent): void {
		for (const listener of this.listeners.get(type) ?? []) {
			listener(event);
		}
	}
}
