import { describe, expect, test } from 'vitest';
import { BlockRegistry } from '../BlockRegistry';
import { VoxelWorld } from '../VoxelWorld';
import type { TargetedBlock } from '../../game-types';
import { CivilizationInteractionSystem } from './CivilizationInteractionSystem';
import { blockStateForPlacement, facingFromYaw, placementRuleAllows } from './CivilizationBlocks';
import { nextWardrobeOutfit } from './OutfitWardrobe';

const floorTarget: TargetedBlock = {
	block: { x: 0, y: 9, z: 0 },
	normal: { x: 0, y: 1, z: 0 },
	type: 'grass'
};

const wallTarget: TargetedBlock = {
	block: { x: 0, y: 10, z: 0 },
	normal: { x: 1, y: 0, z: 0 },
	type: 'brick'
};

describe('civilization kit', () => {
	test('registers real architectural and household shapes', () => {
		expect(BlockRegistry.get('glass_panel')).toMatchObject({
			shape: 'glass-panel',
			orientable: true
		});
		expect(BlockRegistry.get('wooden_door')).toMatchObject({ interaction: 'door', shape: 'door' });
		expect(BlockRegistry.get('stone_slab').collision?.maxY).toBe(0.5);
		expect(BlockRegistry.get('table').shape).toBe('table');
		expect(BlockRegistry.get('bed').interaction).toBe('bed');
		expect(BlockRegistry.get('wardrobe').interaction).toBe('wardrobe');
		expect(BlockRegistry.get('floor_lamp').light?.distance).toBeGreaterThan(0);
		expect(
			BlockRegistry.collisionBox(BlockRegistry.create('floor_lamp', { x: 0, y: 0, z: 0 }))
		).not.toBeNull();
		expect(BlockRegistry.get('fire_pit').heatCelsius).toBeGreaterThan(0);
	});

	test('uses support-aware placement and deterministic facing', () => {
		expect(placementRuleAllows('wooden_door', floorTarget)).toBe(true);
		expect(placementRuleAllows('wooden_door', wallTarget)).toBe(false);
		expect(placementRuleAllows('curtain', wallTarget)).toBe(true);
		expect(placementRuleAllows('curtain', floorTarget)).toBe(false);
		expect(facingFromYaw(0)).toBe('south');
		expect(facingFromYaw(Math.PI / 2)).toBe('east');
		expect(blockStateForPlacement('glass_panel', wallTarget, 0)?.facing).toBe('east');
	});

	test('opens doors into a passable state and persists interactive state', () => {
		const world = new VoxelWorld('civilization-state');
		world.loadChunk({ x: 0, z: 0 });
		const position = { x: 2, y: 20, z: 2 };
		expect(world.setBlock(position, 'wooden_door', true, { facing: 'east', open: false })).toBe(
			true
		);

		const interactions = new CivilizationInteractionSystem(world);
		expect(interactions.interact(position)).toMatchObject({ handled: true, worldChanged: true });
		const opened = world.getLoadedBlock(position);
		expect(opened?.state).toMatchObject({ facing: 'east', open: true });
		expect(opened?.passable).toBe(true);
		expect(opened ? BlockRegistry.collisionBox(opened) : null).toBeNull();

		const snapshot = world.exportModifications();
		const restored = new VoxelWorld('civilization-state');
		restored.loadChunk({ x: 0, z: 0 });
		restored.loadModifications(snapshot);
		expect(restored.getLoadedBlock(position)?.state).toMatchObject({ facing: 'east', open: true });
	});

	test('switches lights and fire without duplicating block types', () => {
		const world = new VoxelWorld('civilization-light');
		world.loadChunk({ x: 0, z: 0 });
		const lamp = { x: 3, y: 20, z: 3 };
		const fire = { x: 4, y: 20, z: 3 };
		world.setBlock(lamp, 'floor_lamp');
		world.setBlock(fire, 'fire_pit');
		const interactions = new CivilizationInteractionSystem(world);

		expect(BlockRegistry.isLit(world.getLoadedBlock(lamp)!)).toBe(false);
		interactions.interact(lamp);
		expect(BlockRegistry.isLit(world.getLoadedBlock(lamp)!)).toBe(true);
		interactions.interact(fire);
		expect(BlockRegistry.isLit(world.getLoadedBlock(fire)!)).toBe(true);
	});

	test('cycles civilian clothes and shoes while preserving identity', () => {
		const current = {
			version: 1,
			displayName: 'Citizen',
			bodyType: 'average',
			skinTone: '#9a6a4d',
			hairStyle: 'short',
			hairColor: '#251b17',
			shirtColor: '#000001',
			pantsColor: '#000002',
			shoesColor: '#000003'
		} as const;
		const next = nextWardrobeOutfit(current as never);

		expect(next.appearance.displayName).toBe('Citizen');
		expect(next.appearance.shirtColor).not.toBe(current.shirtColor);
		expect(next.appearance.pantsColor).not.toBe(current.pantsColor);
		expect(next.appearance.shoesColor).not.toBe(current.shoesColor);
	});
});
