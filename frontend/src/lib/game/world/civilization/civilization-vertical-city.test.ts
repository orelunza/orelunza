import { describe, expect, test } from 'vitest';
import { BlockRegistry } from '../BlockRegistry';
import { CityGenerator } from '../CityGenerator';
import { TerrainGenerator } from '../TerrainGenerator';
import { VoxelWorld } from '../VoxelWorld';
import { CENTRAL_CITY_CENTER, STARTER_WORLD_SEED, worldToChunk } from '../voxel-types';
import {
	CIVIC_ELEVATOR_LAYOUT,
	CIVIC_TOWER,
	URBAN_BUILDINGS,
	buildingFloorBlockY,
	buildingPowerPanelPosition
} from './UrbanBuildingRegistry';
import { UrbanPowerSystem } from './UrbanPowerSystem';
import { UrbanElevatorSystem } from './UrbanElevatorSystem';

describe('vertical native city', () => {
	test('builds genuinely tall multi-storey towers with structural floors and interior lights', () => {
		const city = new CityGenerator();
		const blocks = city.generateForColumn(CENTRAL_CITY_CENTER.x, 9, CENTRAL_CITY_CENTER.z);
		const top = Math.max(...blocks.map((block) => block.position.y));
		expect(CIVIC_TOWER.floors).toBeGreaterThanOrEqual(15);
		expect(top).toBeGreaterThanOrEqual(70);
		expect(
			URBAN_BUILDINGS.some((building) => building.kind === 'hotel' && building.floors >= 10)
		).toBe(true);
	});

	test('uses genuinely spacious floor plates for urban homes, hotel rooms and offices', () => {
		for (const building of URBAN_BUILDINGS) {
			const interiorWidth = building.halfWidth * 2 - 1;
			const interiorDepth = building.halfDepth * 2 - 1;
			expect(interiorWidth).toBeGreaterThanOrEqual(11);
			expect(interiorDepth).toBeGreaterThanOrEqual(9);
		}
	});

	test('places a visible two-metre-wide four-step stair run usable up and down on every building', () => {
		const city = new CityGenerator();
		for (const building of URBAN_BUILDINGS) {
			const stairX = -building.halfWidth + 2;
			const stairStartZ = building.halfDepth - 5;
			for (const lane of [0, 1]) {
				for (let step = 0; step < 4; step += 1) {
					const x = CENTRAL_CITY_CENTER.x + building.localX + stairX + lane;
					const z = CENTRAL_CITY_CENTER.z + building.localZ + stairStartZ + step;
					const column = city.generateForColumn(x, 9, z);
					expect(column).toContainEqual({
						position: { x, y: 10 + step, z },
						type: 'stone_stairs'
					});
					if (building.floors > 2) {
						expect(column).toContainEqual({
							position: { x, y: 14 + step, z },
							type: 'stone_stairs'
						});
					}
				}
			}
		}
	});

	test('gives residential floors distinct bedroom and living-room zones', () => {
		const city = new CityGenerator();
		const apartment = URBAN_BUILDINGS.find((building) => building.kind === 'apartments')!;
		const firstFloorBlocks: ReturnType<CityGenerator['generateForColumn']> = [];
		for (let dx = -apartment.halfWidth + 1; dx < apartment.halfWidth; dx += 1) {
			for (let dz = -apartment.halfDepth + 1; dz < apartment.halfDepth; dz += 1) {
				firstFloorBlocks.push(
					...city
						.generateForColumn(
							CENTRAL_CITY_CENTER.x + apartment.localX + dx,
							9,
							CENTRAL_CITY_CENTER.z + apartment.localZ + dz
						)
						.filter((block) => block.position.y === 10)
				);
			}
		}

		const centerZ = CENTRAL_CITY_CENTER.z + apartment.localZ;
		const bed = firstFloorBlocks.find((block) => block.type === 'bed');
		const sofa = firstFloorBlocks.find((block) => block.type === 'sofa');
		const kitchen = firstFloorBlocks.find((block) => block.type === 'kitchen_counter');
		const partitionDoor = firstFloorBlocks.find(
			(block) => block.type === 'wooden_door' && block.position.z === centerZ
		);

		expect(bed).toBeDefined();
		expect(sofa).toBeDefined();
		expect(kitchen).toBeDefined();
		expect(partitionDoor).toBeDefined();
		expect(bed!.position.z).toBeLessThan(centerZ);
		expect(sofa!.position.z).toBeGreaterThan(centerZ);
		expect(kitchen!.position.z).toBeGreaterThan(centerZ);
	});

	test('generates elevator doors, call buttons and a floor panel on real tower storeys', () => {
		const city = new CityGenerator();
		const doorColumn = city.generateForColumn(
			CENTRAL_CITY_CENTER.x + CIVIC_ELEVATOR_LAYOUT.doorLocalX,
			9,
			CENTRAL_CITY_CENTER.z + CIVIC_ELEVATOR_LAYOUT.doorLocalZ
		);
		const callColumn = city.generateForColumn(
			CENTRAL_CITY_CENTER.x + CIVIC_ELEVATOR_LAYOUT.callLocalX,
			9,
			CENTRAL_CITY_CENTER.z + CIVIC_ELEVATOR_LAYOUT.callLocalZ
		);
		const panelColumn = city.generateForColumn(
			CENTRAL_CITY_CENTER.x + CIVIC_ELEVATOR_LAYOUT.panelLocalX,
			9,
			CENTRAL_CITY_CENTER.z + CIVIC_ELEVATOR_LAYOUT.panelLocalZ
		);
		expect(doorColumn.filter((block) => block.type === 'elevator_door').length).toBe(
			CIVIC_TOWER.floors
		);
		expect(callColumn.filter((block) => block.type === 'elevator_call_button').length).toBe(
			CIVIC_TOWER.floors
		);
		expect(panelColumn.filter((block) => block.type === 'elevator_panel').length).toBe(
			CIVIC_TOWER.floors
		);
	});

	test('keeps the authored urban layout free from conflicting fixtures and building overlaps', () => {
		const city = new CityGenerator();
		for (let localX = -40; localX <= 40; localX += 1) {
			for (let localZ = -40; localZ <= 40; localZ += 1) {
				const blocks = city.generateForColumn(
					CENTRAL_CITY_CENTER.x + localX,
					9,
					CENTRAL_CITY_CENTER.z + localZ
				);
				const occupied = new Map<number, string>();
				for (const block of blocks) {
					const previous = occupied.get(block.position.y);
					if (previous !== undefined) expect(block.type).toBe(previous);
					occupied.set(block.position.y, block.type);
				}
			}
		}
	});

	test('keeps compact elevator controls ray-targetable without making them solid obstacles', () => {
		for (const type of ['elevator_call_button', 'elevator_panel'] as const) {
			const definition = BlockRegistry.get(type);
			expect(definition.collectable).toBe(true);
			expect(definition.solid).toBe(false);
			expect(definition.passable).toBe(true);
		}
	});

	test('moves the elevator through world space and restores a solid cabin platform at arrival', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const shaft = {
			x: CENTRAL_CITY_CENTER.x + CIVIC_ELEVATOR_LAYOUT.shaftLocalX,
			z: CENTRAL_CITY_CENTER.z + CIVIC_ELEVATOR_LAYOUT.shaftLocalZ
		};
		world.loadChunk(worldToChunk(shaft));
		const power = new UrbanPowerSystem(world);
		const elevator = new UrbanElevatorSystem(world, power);
		elevator.initialize();
		const player = {
			position: { x: shaft.x + 0.5, y: 10.04, z: shaft.z + 0.5 },
			velocity: { x: 0, y: 0, z: 0 },
			verticalSpeed: 0,
			onGround: true
		} as any;
		const panel = {
			x: CENTRAL_CITY_CENTER.x + CIVIC_ELEVATOR_LAYOUT.panelLocalX,
			y: 10,
			z: CENTRAL_CITY_CENTER.z + CIVIC_ELEVATOR_LAYOUT.panelLocalZ
		};
		expect(elevator.canUsePanel(panel, player)).toBe(true);
		expect(elevator.selectFloor(3, player).handled).toBe(true);
		for (let i = 0; i < 400 && elevator.snapshot.phase !== 'idle'; i += 1)
			elevator.update(1 / 60, player);
		expect(elevator.snapshot.currentFloor).toBe(3);
		expect(player.position.y).toBeGreaterThan(17);
		expect(world.getLoadedBlock({ x: shaft.x, y: 17, z: shaft.z })?.type).toBe('elevator_platform');
	});

	test('holds a rider safely in the cabin during a power outage and resumes after power returns', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		for (let chunkX = -1; chunkX <= 1; chunkX += 1) {
			for (let chunkZ = -3; chunkZ <= -1; chunkZ += 1) world.loadChunk({ x: chunkX, z: chunkZ });
		}
		const shaft = {
			x: CENTRAL_CITY_CENTER.x + CIVIC_ELEVATOR_LAYOUT.shaftLocalX,
			z: CENTRAL_CITY_CENTER.z + CIVIC_ELEVATOR_LAYOUT.shaftLocalZ
		};
		const groundY = Math.floor(world.terrainGenerator.heightAt(shaft.x, shaft.z));
		const power = new UrbanPowerSystem(world);
		const elevator = new UrbanElevatorSystem(world, power);
		elevator.initialize();
		const player = {
			position: { x: shaft.x + 0.5, y: groundY + 1.04, z: shaft.z + 0.5 },
			velocity: { x: 0, y: 0, z: 0 },
			verticalSpeed: 0,
			onGround: true
		} as any;
		expect(elevator.selectFloor(5, player).handled).toBe(true);
		for (let i = 0; i < 20; i += 1) elevator.update(1 / 60, player);
		const stoppedY = player.position.y;
		const powerPanel = {
			x: CENTRAL_CITY_CENTER.x - 2,
			y: groundY + 1,
			z: CENTRAL_CITY_CENTER.z + 1
		};
		expect(power.toggleAt(powerPanel)).toMatchObject({ handled: true, powered: false });
		for (let i = 0; i < 60; i += 1) elevator.update(1 / 60, player);
		expect(elevator.snapshot.phase).toBe('stopped');
		expect(player.position.y).toBeCloseTo(stoppedY, 6);
		expect(power.toggleAt(powerPanel)).toMatchObject({ handled: true, powered: true });
		for (let i = 0; i < 600 && elevator.snapshot.phase !== 'idle'; i += 1)
			elevator.update(1 / 60, player);
		expect(elevator.snapshot.currentFloor).toBe(5);
	});

	test('building power disables consumers without removing the building', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		const groundY = Math.floor(
			world.terrainGenerator.heightAt(CENTRAL_CITY_CENTER.x, CENTRAL_CITY_CENTER.z)
		);
		const panel = buildingPowerPanelPosition(CIVIC_TOWER, groundY);
		const city = new CityGenerator();
		let light: { x: number; y: number; z: number } | undefined;
		for (let dx = -CIVIC_TOWER.halfWidth + 1; dx < CIVIC_TOWER.halfWidth && !light; dx += 1) {
			for (let dz = -CIVIC_TOWER.halfDepth + 1; dz < CIVIC_TOWER.halfDepth && !light; dz += 1) {
				light = city
					.generateForColumn(CENTRAL_CITY_CENTER.x + dx, groundY, CENTRAL_CITY_CENTER.z + dz)
					.find((block) => block.type === 'ceiling_light')?.position;
			}
		}
		expect(light).toBeDefined();

		world.loadChunk(worldToChunk(panel));
		world.loadChunk(worldToChunk(light!));
		const power = new UrbanPowerSystem(world);
		expect(world.getLoadedBlock(panel)?.type).toBe('power_panel');
		expect(world.getLoadedBlock(light!)?.type).toBe('ceiling_light');

		const door = {
			x: CENTRAL_CITY_CENTER.x,
			y: groundY + 1,
			z: CENTRAL_CITY_CENTER.z + CIVIC_TOWER.halfDepth
		};
		world.loadChunk(worldToChunk(door));

		const result = power.toggleAt(panel);
		expect(result).toMatchObject({ handled: true, powered: false });
		expect(world.getLoadedBlock(panel)?.state?.powered).toBe(false);
		expect(world.getLoadedBlock(light!)?.state?.powered).toBe(false);
		expect(world.getLoadedBlock(door)?.type).toBe('glass_door');
	});

	test('serializes the last stable elevator floor and restores it safely', () => {
		const world = new VoxelWorld(STARTER_WORLD_SEED);
		for (let chunkX = -1; chunkX <= 1; chunkX += 1) {
			for (let chunkZ = -3; chunkZ <= -1; chunkZ += 1) world.loadChunk({ x: chunkX, z: chunkZ });
		}
		const shaft = {
			x: CENTRAL_CITY_CENTER.x + CIVIC_ELEVATOR_LAYOUT.shaftLocalX,
			z: CENTRAL_CITY_CENTER.z + CIVIC_ELEVATOR_LAYOUT.shaftLocalZ
		};
		const groundY = Math.floor(world.terrainGenerator.heightAt(shaft.x, shaft.z));
		const power = new UrbanPowerSystem(world);
		const elevator = new UrbanElevatorSystem(world, power);
		elevator.initialize();
		const player = {
			position: { x: shaft.x + 0.5, y: groundY + 1.04, z: shaft.z + 0.5 },
			velocity: { x: 0, y: 0, z: 0 },
			verticalSpeed: 0,
			onGround: true
		} as any;
		elevator.selectFloor(6, player);
		for (let i = 0; i < 800 && elevator.snapshot.phase !== 'idle'; i += 1)
			elevator.update(1 / 60, player);
		expect(elevator.serialize()).toEqual({ version: 1, currentFloor: 6 });

		const restored = new UrbanElevatorSystem(world, power);
		restored.restore(elevator.serialize());
		restored.initialize();
		expect(restored.snapshot).toMatchObject({ currentFloor: 6, targetFloor: 6, phase: 'idle' });
		expect(restored.snapshot.cabinY).toBe(buildingFloorBlockY(CIVIC_TOWER, groundY, 6));
	});
});
