import { describe, expect, it } from 'vitest';
import { VoxelWorld } from '../VoxelWorld';
import { CHUNK_SIZE, type BlockType } from '../voxel-types';
import type { WorldTerrainGenerator } from '../TerrainGenerator';

const generator: WorldTerrainGenerator = {
	heightAt: () => 4,
	visualHeightAt: () => 4,
	isWater: () => false,
	zoneAt: () => 'Test Basin',
	isPath: () => false,
	generateChunk(chunkX, chunkZ) {
		const blocks: Array<{ position: { x: number; y: number; z: number }; type: BlockType }> = [];
		for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
			for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
				const x = chunkX * CHUNK_SIZE + localX;
				const z = chunkZ * CHUNK_SIZE + localZ;
				for (let y = 0; y <= 4; y += 1) {
					blocks.push({
						position: { x, y, z },
						type: y === 4 ? 'grass' : y >= 2 ? 'dirt' : 'stone'
					});
				}
			}
		}
		return { blocks };
	}
};

describe('VoxelWorld natural erosion overrides', () => {
	it('remodels generated terrain without recording a player block change', () => {
		const world = new VoxelWorld('erosion-test', generator);
		world.loadChunk({ x: 0, z: 0 });
		const before = world.exportModifications();
		const mutation = world.erodeNaturalSurface(1, 1);
		expect(mutation?.type).toBe('grass');
		expect(world.getErosionSurfaceProfile(1, 1).surfaceY).toBe(3);
		expect(world.exportModifications()).toEqual(before);
		expect(world.exportNaturalTerrainEdits()).toContainEqual({
			position: { x: 1, y: 4, z: 1 },
			type: 'air'
		});
	});

	it('protects a column after the player modifies it', () => {
		const world = new VoxelWorld('erosion-protection', generator);
		world.loadChunk({ x: 0, z: 0 });
		expect(world.setBlock({ x: 2, y: 5, z: 2 }, 'brick')).toBe(true);
		expect(world.getErosionSurfaceProfile(2, 2).protectedByPlayer).toBe(true);
		expect(world.erodeNaturalSurface(2, 2)).toBeNull();
		expect(world.depositNaturalSurface(2, 2, 'sand')).toBeNull();
	});

	it('restores deposited and eroded natural terrain independently of player edits', () => {
		const world = new VoxelWorld('erosion-save', generator);
		world.loadChunk({ x: 0, z: 0 });
		world.erodeNaturalSurface(3, 3);
		world.depositNaturalSurface(4, 4, 'sand');
		const edits = world.exportNaturalTerrainEdits();

		const restored = new VoxelWorld('erosion-save', generator);
		restored.loadChunk({ x: 0, z: 0 });
		restored.loadNaturalTerrainEdits(edits);
		expect(restored.getErosionSurfaceProfile(3, 3).surfaceY).toBe(3);
		expect(restored.getErosionSurfaceProfile(4, 4).type).toBe('sand');
	});
});
