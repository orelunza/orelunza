import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, test, vi } from 'vitest';
import { CreationRaycaster } from '../interaction/CreationRaycaster';
import { CreationRemovalSystem } from '../interaction/CreationRemovalSystem';
import { VegetationRaycaster } from '../interaction/VegetationRaycaster';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { BlockCoordinate, VoxelBlock } from '../world/voxel-types';
import { parseWorldSave, serializeWorldSave, type WorldSaveV3 } from '../world/WorldSave';
import { groundVegetationInstanceId, tallGrassInstanceId } from './VegetationInstanceId';
import {
	VegetationInteractionIndex,
	type VegetationInteractionInstance
} from './VegetationInteractionIndex';
import { VegetationRemovalState } from './VegetationRemovalState';

describe('universal vegetation interaction', () => {
	test('creates stable ids from terrain columns rather than render instance indexes', () => {
		expect(tallGrassInstanceId(3, 8, -2)).toBe('tall-grass:3:8:-2');
		expect(tallGrassInstanceId(3, 8, -2)).toBe(tallGrassInstanceId(3, 8, -2));
		expect(groundVegetationInstanceId('forest_fern', 3, 8, -2)).toBe('ground:forest_fern:3:8:-2');
		expect(groundVegetationInstanceId('forest_fern', 3, 8, -2)).not.toBe(
			groundVegetationInstanceId('yellow_flower', 3, 8, -2)
		);
	});

	test('serializes removals deterministically and restores without duplicates', () => {
		const state = new VegetationRemovalState();
		expect(state.markRemoved('ground:yellow_flower:2:7:4')).toBe(true);
		expect(state.markRemoved('ground:yellow_flower:2:7:4')).toBe(false);
		expect(state.markRemoved('tall-grass:1:7:4')).toBe(true);
		expect(state.serialize()).toEqual(['ground:yellow_flower:2:7:4', 'tall-grass:1:7:4']);

		const restored = new VegetationRemovalState();
		restored.restore([...state.serialize(), 'tall-grass:1:7:4', '']);
		expect(restored.size).toBe(2);
		expect(restored.has('ground:yellow_flower:2:7:4')).toBe(true);
	});

	test('round-trips removed vegetation ids while accepting older V3 saves without them', () => {
		const base = {
			version: 3 as const,
			worldId: 'world',
			seed: 'seed',
			player: {
				playerId: 'player',
				worldId: 'world',
				position: { x: 0, y: 8, z: 0 },
				yaw: 0,
				pitch: 0
			},
			character: {},
			inventory: {},
			placedBlocks: [],
			removedBlocks: [],
			changes: [],
			environment: {
				version: 1,
				clock: { timeOfDaySeconds: 0, dayNumber: 0 },
				dayLengthSeconds: 1200,
				weather: { current: 'clear', next: 'clear', transition: 0, seed: 0 }
			},
			updatedAt: 1
		};
		const withRemovals = {
			...base,
			removedVegetationIds: ['ground:forest_fern:1:8:2']
		} as unknown as WorldSaveV3;
		expect(parseWorldSave(serializeWorldSave(withRemovals))).toEqual(withRemovals);
		expect(parseWorldSave(JSON.stringify(base))).toEqual(base);
	});

	test('replaces one renderer layer without deleting another layer in the same chunk', () => {
		const index = new VegetationInteractionIndex();
		const chunk = { x: 0, z: 0 };
		const grass = instance('grass', 'tall-grass', 0, 0, -2);
		const flower = instance('flower', 'ground-foliage', 0, 0, -3);
		index.replaceChunk('tall-grass', chunk, [grass]);
		index.replaceChunk('ground-foliage', chunk, [flower]);
		expect(index.size).toBe(2);

		index.replaceChunk('tall-grass', chunk, []);
		expect(index.get('grass')).toBeNull();
		expect(index.get('flower')).not.toBeNull();
	});

	test('selects the nearest planted vegetation intersected by the ray', () => {
		const index = new VegetationInteractionIndex();
		index.replaceChunk('ground-foliage', { x: 0, z: -1 }, [
			instance('far', 'ground-foliage', 0.5, 0.6, -5),
			instance('near', 'ground-foliage', 0.5, 0.6, -2),
			instance('off-ray', 'ground-foliage', 3, 0.6, -1)
		]);
		const target = new VegetationRaycaster().raycastFrom(
			new Vector3(0.5, 0.6, 0.5),
			new Vector3(0, 0, -1),
			index,
			8
		);
		expect(target?.instanceId).toBe('near');
		expect(target?.distance).toBeGreaterThan(1);
		expect(target?.distance).toBeLessThan(3);
	});

	test('routes the universal hammer to vegetation or voxel removal', () => {
		const blockBreak = vi.fn(() => true);
		const removeVegetation = vi.fn(() => instance('flower', 'ground-foliage', 0.5, 0.5, -2));
		const vegetationChanged = vi.fn();
		const removal = new CreationRemovalSystem(
			{} as VoxelWorld,
			{ break: blockBreak } as never,
			{ removeVegetation },
			vegetationChanged
		);

		expect(
			removal.remove({
				kind: 'vegetation',
				distance: 2,
				...instance('flower', 'ground-foliage', 0.5, 0.5, -2)
			})
		).toEqual({ kind: 'vegetation', label: 'Yellow meadow flower' });
		expect(removeVegetation).toHaveBeenCalledWith({}, 'flower');
		expect(vegetationChanged).toHaveBeenCalledOnce();

		expect(
			removal.remove({
				kind: 'block',
				distance: 3,
				block: {
					block: { x: 0, y: 0, z: -3 },
					normal: { x: 0, y: 0, z: 1 },
					type: 'stone'
				}
			})
		).toEqual({ kind: 'block', label: 'stone' });
		expect(blockBreak).toHaveBeenCalledOnce();
	});

	test('chooses vegetation in front of a voxel and the voxel when it is nearer', () => {
		const camera = new PerspectiveCamera(62, 1, 0.05, 100);
		camera.position.set(0.5, 0.5, 0.5);
		camera.updateMatrixWorld(true);
		const index = new VegetationInteractionIndex();
		const raycaster = new CreationRaycaster(index, 8);

		index.replaceChunk('ground-foliage', { x: 0, z: -1 }, [
			instance('front-flower', 'ground-foliage', 0.5, 0.5, -2)
		]);
		const vegetationFirst = raycaster.raycast(camera, fakeWorld(-4), 0);
		expect(vegetationFirst.target?.kind).toBe('vegetation');

		index.replaceChunk('ground-foliage', { x: 0, z: -1 }, [
			instance('behind-flower', 'ground-foliage', 0.5, 0.5, -6)
		]);
		const blockFirst = raycaster.raycast(camera, fakeWorld(-3), 0);
		expect(blockFirst.target?.kind).toBe('block');
		expect(blockFirst.blockTarget?.block).toEqual({ x: 0, y: 0, z: -3 });
	});
});

function instance(
	instanceId: string,
	layer: VegetationInteractionInstance['layer'],
	x: number,
	y: number,
	z: number
): VegetationInteractionInstance {
	return {
		instanceId,
		layer,
		speciesId: layer === 'tall-grass' ? 'tall_grass' : 'yellow_flower',
		label: layer === 'tall-grass' ? 'Tall grass' : 'Yellow meadow flower',
		family: layer === 'tall-grass' ? 'grass' : 'flower',
		chunk: { x: Math.floor(x / 16), z: Math.floor(z / 16) },
		position: { x, y, z },
		halfExtents: { x: 0.35, y: 0.5, z: 0.35 }
	};
}

function fakeWorld(blockZ: number): VoxelWorld {
	return {
		getLoadedBlock(position: BlockCoordinate): VoxelBlock {
			if (position.x === 0 && position.y === 0 && position.z === blockZ) {
				return block(position, 'stone', true);
			}

			return block(position, 'air', false);
		}
	} as VoxelWorld;
}

function block(position: BlockCoordinate, type: VoxelBlock['type'], solid: boolean): VoxelBlock {
	return {
		type,
		position: { ...position },
		solid,
		passable: !solid,
		collectable: solid,
		transparent: !solid
	};
}
